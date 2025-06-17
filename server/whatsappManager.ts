import { makeWASocket, useMultiFileAuthState, DisconnectReason, proto } from '@whiskeysockets/baileys';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { firebaseDb } from './db';
import { WhatsAppConnection } from '@shared/schema';
import * as path from 'path';
import * as fs from 'fs';

interface ActiveConnection {
  socket: any;
  clientId: string;
  clientName: string;
  phoneNumber?: string;
  isConnected: boolean;
  qrCode?: string;
  connectionId: string;
}

export class WhatsAppManager {
  private activeConnections: Map<string, ActiveConnection> = new Map();
  private qrListeners: Map<string, ((qr: string | null) => void)[]> = new Map();
  private connectionListeners: Map<string, ((isConnected: boolean) => void)[]> = new Map();

  constructor() {
    this.initializeManager();
  }

  private async initializeManager() {
    console.log('🚀 Inicializando WhatsApp Manager com Firebase');
    
    // Carregar conexões ativas do Firebase
    await this.loadActiveConnections();
  }

  private async loadActiveConnections() {
    try {
      const connectionsRef = collection(firebaseDb, 'whatsappConnections');
      const snapshot = await getDocs(connectionsRef);
      
      console.log(`📱 Carregando ${snapshot.size} conexões do Firebase`);
      
      for (const docSnap of snapshot.docs) {
        const connection = docSnap.data() as WhatsAppConnection;
        if (connection.isConnected) {
          console.log(`🔄 Tentando restaurar conexão: ${connection.clientName}`);
          await this.restoreConnection(connection);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar conexões:', error);
    }
  }

  private async restoreConnection(connection: WhatsAppConnection) {
    try {
      const sessionPath = this.getSessionPath(connection.clientId);
      
      if (fs.existsSync(sessionPath)) {
        console.log(`🔄 Restaurando sessão para cliente: ${connection.clientName}`);
        await this.createConnection(connection.clientId, connection.clientName, connection.id);
      } else {
        console.log(`⚠️ Sessão não encontrada para ${connection.clientName}, marcando como desconectado`);
        await this.updateConnectionStatus(connection.id, false);
      }
    } catch (error) {
      console.error(`❌ Erro ao restaurar conexão ${connection.clientName}:`, error);
      await this.updateConnectionStatus(connection.id, false);
    }
  }

  async getClientConnections(): Promise<WhatsAppConnection[]> {
    try {
      const connectionsRef = collection(firebaseDb, 'whatsappConnections');
      const snapshot = await getDocs(connectionsRef);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as WhatsAppConnection));
    } catch (error) {
      console.error('❌ Erro ao buscar conexões:', error);
      return [];
    }
  }

  async createConnection(clientId: string, clientName: string, connectionId?: string): Promise<string> {
    try {
      const connId = connectionId || `conn_${clientId}_${Date.now()}`;
      const sessionPath = this.getSessionPath(clientId);
      
      console.log(`🔌 Criando conexão WhatsApp para cliente: ${clientName}`);
      
      // Garantir que o diretório de sessão existe
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        connectTimeoutMs: 30000,
        defaultQueryTimeoutMs: 15000,
        browser: [clientName, 'WhatsApp Manager', '1.0.0'],
        getMessage: async (key) => {
          return {
            conversation: ""
          };
        }
      });

      // Salvar referência da conexão ativa
      const activeConn: ActiveConnection = {
        socket,
        clientId,
        clientName,
        isConnected: false,
        connectionId: connId
      };
      
      this.activeConnections.set(connId, activeConn);

      // Event handlers
      socket.ev.on('connection.update', async (update) => {
        await this.handleConnectionUpdate(connId, update);
      });

      socket.ev.on('creds.update', saveCreds);

      socket.ev.on('messages.upsert', async (m) => {
        // Integrar com sistema de entrevistas existente
        await this.handleIncomingMessage(connId, m);
      });

      // Salvar no Firebase
      await this.saveConnectionToFirebase(connId, clientId, clientName);
      
      return connId;
    } catch (error) {
      console.error(`❌ Erro ao criar conexão para ${clientName}:`, error);
      throw error;
    }
  }

  private async handleConnectionUpdate(connectionId: string, update: any) {
    const activeConn = this.activeConnections.get(connectionId);
    if (!activeConn) return;

    const { connection, lastDisconnect, qr } = update;

    // Gerar QR Code específico para este cliente
    if (qr) {
      console.log(`📱 QR Code gerado para ${activeConn.clientName}`);
      activeConn.qrCode = qr;
      
      // Atualizar no Firebase com QR Code específico do cliente
      await this.updateConnectionFirebase(connectionId, {
        qrCode: qr
      });
      
      // Notificar listeners
      this.notifyQRListeners(connectionId, qr);
    }

    if (connection === 'open') {
      console.log(`✅ ${activeConn.clientName} conectado com sucesso!`);
      activeConn.isConnected = true;
      activeConn.phoneNumber = activeConn.socket.user?.id?.split(':')[0] || 'Conectado';
      activeConn.qrCode = undefined;
      
      await this.updateConnectionFirebase(connectionId, {
        isConnected: true,
        phoneNumber: activeConn.phoneNumber,
        qrCode: null,
        lastConnection: new Date().toISOString()
      });
      
      this.notifyQRListeners(connectionId, null);
      this.notifyConnectionListeners(connectionId, true);
      
    } else if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
      const errorCode = lastDisconnect?.error?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || '';
      
      console.log(`🔌 Conexão fechada para ${activeConn.clientName}: ${errorMessage} (código: ${errorCode})`);
      
      activeConn.isConnected = false;
      await this.updateConnectionFirebase(connectionId, { isConnected: false });
      this.notifyConnectionListeners(connectionId, false);

      // Tratar diferentes tipos de erro
      if (errorCode === 515 || errorMessage.includes('Stream Errored')) {
        console.log(`🔄 Erro de stream detectado para ${activeConn.clientName} - limpando sessão`);
        await this.clearSession(activeConn.clientId);
        
        // Reconectar após limpeza
        setTimeout(() => {
          this.reconnectClient(connectionId);
        }, 5000);
        
      } else if (errorCode === 440 || errorMessage.includes('conflict') || errorMessage.includes('replaced')) {
        console.log(`⚠️ Conflito detectado para ${activeConn.clientName} - sessão ativa em outro dispositivo`);
        await this.clearSession(activeConn.clientId);
        
      } else if (shouldReconnect) {
        console.log(`🔄 Tentando reconectar ${activeConn.clientName} em 30 segundos`);
        setTimeout(() => {
          this.reconnectClient(connectionId);
        }, 30000);
      }
    }
  }

  private async handleIncomingMessage(connectionId: string, m: any) {
    const activeConn = this.activeConnections.get(connectionId);
    if (!activeConn) return;

    // Integrar com o sistema de entrevistas existente
    for (const message of m.messages) {
      if (message.key.fromMe) continue;

      const from = message.key.remoteJid;
      const text = message.message?.conversation || 
                  message.message?.extendedTextMessage?.text || '';
      const audioMessage = message.message?.audioMessage;

      console.log(`📱 Mensagem recebida no ${activeConn.clientName} de ${from}: ${text}`);

      // Importar e usar o sistema de entrevistas existente
      try {
        const { simpleInterviewService } = await import('./simpleInterviewService');
        simpleInterviewService.setWhatsAppService({
          sendMessage: (to: string, msg: string) => this.sendMessage(connectionId, to, msg),
          downloadMediaMessage: (message: any) => this.downloadMediaMessage(connectionId, message)
        });
        
        await simpleInterviewService.handleMessage(from, text, audioMessage);
      } catch (error) {
        console.error('❌ Erro ao processar mensagem no sistema de entrevistas:', error);
      }
    }
  }

  async sendMessage(connectionId: string, to: string, message: string): Promise<boolean> {
    try {
      const activeConn = this.activeConnections.get(connectionId);
      if (!activeConn || !activeConn.isConnected) {
        console.error(`❌ Conexão ${connectionId} não está ativa`);
        return false;
      }

      await activeConn.socket.sendMessage(to, { text: message });
      console.log(`✅ Mensagem enviada via ${activeConn.clientName} para ${to}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via ${connectionId}:`, error);
      return false;
    }
  }

  async downloadMediaMessage(connectionId: string, message: any): Promise<Buffer | null> {
    try {
      const activeConn = this.activeConnections.get(connectionId);
      if (!activeConn || !activeConn.isConnected) {
        return null;
      }

      const buffer = await activeConn.socket.downloadMediaMessage(message);
      return buffer;
    } catch (error) {
      console.error(`❌ Erro ao baixar mídia via ${connectionId}:`, error);
      return null;
    }
  }

  private async reconnectClient(connectionId: string) {
    const activeConn = this.activeConnections.get(connectionId);
    if (!activeConn) return;

    try {
      console.log(`🔄 Reconectando ${activeConn.clientName}`);
      await this.createConnection(activeConn.clientId, activeConn.clientName, connectionId);
    } catch (error) {
      console.error(`❌ Erro na reconexão de ${activeConn.clientName}:`, error);
    }
  }

  private async clearSession(clientId: string) {
    try {
      const sessionPath = this.getSessionPath(clientId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🗑️ Sessão limpa para cliente ${clientId}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao limpar sessão do cliente ${clientId}:`, error);
    }
  }

  async disconnectClient(connectionId: string): Promise<void> {
    try {
      const activeConn = this.activeConnections.get(connectionId);
      if (!activeConn) return;

      console.log(`🔌 Desconectando ${activeConn.clientName}`);
      
      if (activeConn.socket) {
        activeConn.socket.end();
      }
      
      await this.clearSession(activeConn.clientId);
      await this.updateConnectionFirebase(connectionId, { 
        isConnected: false, 
        qrCode: null,
        phoneNumber: null 
      });
      
      this.activeConnections.delete(connectionId);
      this.notifyConnectionListeners(connectionId, false);
      
      console.log(`✅ ${activeConn.clientName} desconectado com sucesso`);
    } catch (error) {
      console.error(`❌ Erro ao desconectar ${connectionId}:`, error);
    }
  }

  getConnectionStatus(connectionId: string): { isConnected: boolean; qrCode?: string; phoneNumber?: string } {
    const activeConn = this.activeConnections.get(connectionId);
    if (!activeConn) {
      return { isConnected: false };
    }

    return {
      isConnected: activeConn.isConnected,
      qrCode: activeConn.qrCode,
      phoneNumber: activeConn.phoneNumber
    };
  }

  onQRCode(connectionId: string, callback: (qr: string | null) => void) {
    if (!this.qrListeners.has(connectionId)) {
      this.qrListeners.set(connectionId, []);
    }
    this.qrListeners.get(connectionId)!.push(callback);
  }

  onConnectionChange(connectionId: string, callback: (isConnected: boolean) => void) {
    if (!this.connectionListeners.has(connectionId)) {
      this.connectionListeners.set(connectionId, []);
    }
    this.connectionListeners.get(connectionId)!.push(callback);
  }

  private notifyQRListeners(connectionId: string, qr: string | null) {
    const listeners = this.qrListeners.get(connectionId) || [];
    listeners.forEach(callback => callback(qr));
  }

  private notifyConnectionListeners(connectionId: string, isConnected: boolean) {
    const listeners = this.connectionListeners.get(connectionId) || [];
    listeners.forEach(callback => callback(isConnected));
  }

  private getSessionPath(clientId: string): string {
    return path.resolve(`./whatsapp-sessions/client_${clientId}`);
  }

  private async saveConnectionToFirebase(connectionId: string, clientId: string, clientName: string) {
    try {
      const connectionData: WhatsAppConnection = {
        id: connectionId,
        clientId,
        clientName,
        status: 'disconnected',
        isConnected: false,
        sessionPath: this.getSessionPath(clientId),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(firebaseDb, 'whatsappConnections', connectionId), connectionData);
      console.log(`💾 Conexão salva no Firebase: ${clientName}`);
    } catch (error) {
      console.error('❌ Erro ao salvar conexão no Firebase:', error);
    }
  }

  private async updateConnectionFirebase(connectionId: string, updates: Partial<WhatsAppConnection>) {
    try {
      await updateDoc(doc(firebaseDb, 'whatsappConnections', connectionId), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar conexão no Firebase:', error);
    }
  }

  private async updateConnectionStatus(connectionId: string, isConnected: boolean) {
    await this.updateConnectionFirebase(connectionId, { isConnected });
  }

  async deleteConnection(connectionId: string): Promise<void> {
    try {
      const activeConn = this.activeConnections.get(connectionId);
      if (activeConn) {
        await this.disconnectClient(connectionId);
      }

      await deleteDoc(doc(firebaseDb, 'whatsappConnections', connectionId));
      console.log(`🗑️ Conexão removida: ${connectionId}`);
    } catch (error) {
      console.error(`❌ Erro ao deletar conexão ${connectionId}:`, error);
    }
  }
}

// Instância singleton
export const whatsappManager = new WhatsAppManager();