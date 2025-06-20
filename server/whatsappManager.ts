import { makeWASocket, useMultiFileAuthState, DisconnectReason, proto } from '@whiskeysockets/baileys';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { firebaseDb } from './db';
import { WhatsAppConnection } from '@shared/schema';
import * as path from 'path';
import * as fs from 'fs';
import QRCode from 'qrcode';

interface ActiveConnection {
  socket: any;
  clientId: string;
  clientName: string;
  phoneNumber?: string;
  isConnected: boolean;
  qrCode?: string;
  connectionId: string;
  authDir: string;
}

export class WhatsAppManager {
  private activeConnections: Map<string, ActiveConnection> = new Map();
  private qrListeners: Map<string, ((qr: string | null) => void)[]> = new Map();
  private connectionListeners: Map<string, ((isConnected: boolean) => void)[]> = new Map();

  constructor() {
    // Initialize manager without auto-loading connections to prevent startup loops
    console.log('🚀 WhatsApp Manager criado - inicialização sob demanda');
    
    // Garantir que o diretório de sessões existe
    const sessionsDir = path.join(process.cwd(), 'whatsapp-sessions');
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }
  }

  private async initializeManager() {
    console.log('🚀 Inicializando WhatsApp Manager com Firebase');
    
    // Carregar conexões ativas do Firebase apenas quando necessário
    await this.loadActiveConnections();
  }

  private async loadActiveConnections() {
    try {
      const connectionsRef = collection(firebaseDb, 'whatsappConnections');
      const snapshot = await getDocs(connectionsRef);
      
      console.log(`📱 Carregando ${snapshot.size} conexões do Firebase`);
      
      for (const docSnap of snapshot.docs) {
        const connection = docSnap.data() as WhatsAppConnection;
        if (connection.status === 'connected') {
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
      const authDir = path.join(process.cwd(), 'whatsapp-sessions', `client_${connection.clientId}`);
      
      if (!fs.existsSync(authDir)) {
        console.log(`⚠️ Diretório de autenticação não encontrado para ${connection.clientName}`);
        await this.updateConnectionStatus(connection.id, 'disconnected');
        return;
      }

      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['WhatsApp Manager', 'Chrome', '1.0.0'],
      });

      const activeConnection: ActiveConnection = {
        socket,
        clientId: connection.clientId,
        clientName: connection.clientName,
        phoneNumber: connection.phoneNumber || undefined,
        isConnected: true,
        connectionId: connection.id,
        authDir
      };

      this.activeConnections.set(connection.id, activeConnection);
      this.setupSocketEvents(connection.id, socket, saveCreds);

      console.log(`✅ Conexão restaurada para ${connection.clientName}`);
    } catch (error) {
      console.error(`❌ Erro ao restaurar conexão ${connection.clientName}:`, error);
      await this.updateConnectionStatus(connection.id, 'disconnected');
    }
  }

  async createConnection(clientId: string, clientName: string): Promise<string> {
    const connectionId = `client_${clientId}_${Date.now()}`;
    
    console.log(`📱 Criando nova conexão WhatsApp para ${clientName} (ID: ${connectionId})`);

    try {
      // Criar diretório de autenticação específico para o cliente
      const authDir = path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}`);
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      // Salvar conexão no Firebase
      const connectionData: any = {
        id: connectionId,
        clientId,
        clientName,
        status: 'connecting',
        createdAt: new Date(),
        isConnected: false,
        phoneNumber: null,
        qrCode: null
      };

      await setDoc(doc(firebaseDb, 'whatsappConnections', connectionId), connectionData);

      // Inicializar socket WhatsApp
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['WhatsApp Manager', 'Chrome', '1.0.0'],
      });

      const activeConnection: ActiveConnection = {
        socket,
        clientId,
        clientName,
        phoneNumber: undefined,
        isConnected: false,
        connectionId,
        authDir
      };

      this.activeConnections.set(connectionId, activeConnection);
      this.setupSocketEvents(connectionId, socket, saveCreds);

      console.log(`📱 QR Code gerado para ${clientName}`);
      return connectionId;
    } catch (error) {
      console.error(`❌ Erro ao criar conexão para ${clientName}:`, error);
      throw new Error(`Falha ao criar conexão: ${error.message}`);
    }
  }

  private setupSocketEvents(connectionId: string, socket: any, saveCreds: () => Promise<void>) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) return;

    socket.ev.on('connection.update', async (update: any) => {
      const { connection: conn, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`🔄 QR Code recebido para ${connection.clientName}`);
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          connection.qrCode = qrDataUrl;
          
          // Atualizar no Firebase
          await updateDoc(doc(firebaseDb, 'whatsappConnections', connectionId), {
            qrCode: qrDataUrl,
            status: 'connecting'
          });

          // Notificar listeners
          const listeners = this.qrListeners.get(connectionId) || [];
          listeners.forEach(listener => listener(qrDataUrl));
        } catch (error) {
          console.error('❌ Erro ao gerar QR Code:', error);
        }
      }

      if (conn === 'close') {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(`🔌 Conexão fechada para ${connection.clientName}. Reconectar: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          setTimeout(() => this.createConnection(connection.clientId, connection.clientName), 3000);
        } else {
          await this.updateConnectionStatus(connectionId, 'disconnected');
          this.activeConnections.delete(connectionId);
        }
      } else if (conn === 'open') {
        console.log(`✅ WhatsApp conectado para ${connection.clientName}`);
        connection.isConnected = true;
        connection.phoneNumber = socket.user?.id?.split(':')[0] || undefined;
        
        await this.updateConnectionStatus(connectionId, 'connected', connection.phoneNumber);
        
        // Notificar listeners
        const listeners = this.connectionListeners.get(connectionId) || [];
        listeners.forEach(listener => listener(true));
      }
    });

    socket.ev.on('creds.update', saveCreds);
  }

  private async updateConnectionStatus(connectionId: string, status: 'connecting' | 'connected' | 'disconnected', phoneNumber?: string) {
    try {
      const updateData: any = { 
        status,
        isConnected: status === 'connected',
        lastConnection: new Date()
      };

      if (phoneNumber) {
        updateData.phoneNumber = phoneNumber;
      }

      if (status === 'disconnected') {
        updateData.qrCode = null;
      }

      await updateDoc(doc(firebaseDb, 'whatsappConnections', connectionId), updateData);
      
      // Atualizar conexão ativa
      const connection = this.activeConnections.get(connectionId);
      if (connection) {
        connection.isConnected = status === 'connected';
        if (phoneNumber) connection.phoneNumber = phoneNumber;
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar status da conexão:', error);
    }
  }

  async disconnectClient(connectionId: string): Promise<void> {
    console.log(`🔌 Desconectando cliente: ${connectionId}`);
    
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      try {
        await connection.socket?.logout();
        connection.socket?.end();
      } catch (error) {
        console.log('⚠️ Erro ao desconectar socket:', error);
      }
      
      this.activeConnections.delete(connectionId);
    }

    await this.updateConnectionStatus(connectionId, 'disconnected');
  }

  async deleteConnection(connectionId: string): Promise<void> {
    console.log(`🗑️ Deletando conexão: ${connectionId}`);
    
    // Desconectar primeiro
    await this.disconnectClient(connectionId);
    
    // Remover do Firebase
    await deleteDoc(doc(firebaseDb, 'whatsappConnections', connectionId));
    
    // Remover diretório de autenticação
    const connection = this.activeConnections.get(connectionId);
    if (connection && fs.existsSync(connection.authDir)) {
      fs.rmSync(connection.authDir, { recursive: true, force: true });
    }
  }

  private formatBrazilianPhoneNumber(phoneNumber: string): string {
    // Remove todos os caracteres não numéricos
    let cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Se já tem código do país, usa como está
    if (cleanNumber.startsWith('55') && cleanNumber.length >= 12) {
      return cleanNumber;
    }
    
    // Se não tem código do país, adiciona +55
    if (cleanNumber.length === 11 || cleanNumber.length === 10) {
      return `55${cleanNumber}`;
    }
    
    // Se já tem 55 mas não está completo, retorna como está
    return cleanNumber;
  }

  async sendMessage(connectionId: string, phoneNumber: string, message: string): Promise<boolean> {
    const connection = this.activeConnections.get(connectionId);
    
    if (!connection || !connection.isConnected) {
      console.log(`❌ Conexão ${connectionId} não está ativa`);
      return false;
    }

    try {
      // Formatar número brasileiro com código do país
      const formattedPhoneNumber = this.formatBrazilianPhoneNumber(phoneNumber);
      
      const whatsappNumber = formattedPhoneNumber.includes('@s.whatsapp.net') 
        ? formattedPhoneNumber 
        : `${formattedPhoneNumber}@s.whatsapp.net`;

      console.log(`📱 Enviando mensagem para: ${phoneNumber} → ${formattedPhoneNumber}`);
      await connection.socket.sendMessage(whatsappNumber, { text: message });
      console.log(`✅ Mensagem enviada via ${connection.clientName} para ${formattedPhoneNumber}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via ${connection.clientName}:`, error);
      return false;
    }
  }

  getConnectionStatus(connectionId: string): any {
    const connection = this.activeConnections.get(connectionId);
    
    return {
      isConnected: connection?.isConnected || false,
      phoneNumber: connection?.phoneNumber,
      qrCode: connection?.qrCode,
      clientName: connection?.clientName
    };
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

  // Métodos para listeners (para uso futuro com WebSockets)
  onQRUpdate(connectionId: string, callback: (qr: string | null) => void) {
    if (!this.qrListeners.has(connectionId)) {
      this.qrListeners.set(connectionId, []);
    }
    this.qrListeners.get(connectionId)!.push(callback);
  }

  onConnectionUpdate(connectionId: string, callback: (isConnected: boolean) => void) {
    if (!this.connectionListeners.has(connectionId)) {
      this.connectionListeners.set(connectionId, []);
    }
    this.connectionListeners.get(connectionId)!.push(callback);
  }
}

// Singleton instance
export const whatsappManager = new WhatsAppManager();