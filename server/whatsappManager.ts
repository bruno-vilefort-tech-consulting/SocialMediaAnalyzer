import { storage } from './storage';

// Usar import dinâmico para baileys e qrcode
let makeWASocket: any;
let useMultiFileAuthState: any;
let DisconnectReason: any;
let QRCode: any;

async function initializeDependencies() {
  if (!makeWASocket) {
    console.log('📦 Carregando dependências Baileys...');
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default || baileys.makeWASocket;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    const qrCodeModule = await import('qrcode');
    QRCode = qrCodeModule.default || qrCodeModule;
    console.log('📦 Dependências carregadas com sucesso');
  }
}

interface WhatsAppConnection {
  socket: any;
  qrCode: string | null;
  isConnected: boolean;
  phoneNumber: string | null;
  clientId: string;
  lastActivity: Date;
}

class WhatsAppManager {
  private connections: Map<string, WhatsAppConnection> = new Map();
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    await initializeDependencies();
    this.initialized = true;
    console.log('✅ WhatsApp Manager inicializado');
  }

  async connectClient(clientId: string): Promise<{ success: boolean; qrCode?: string; message: string }> {
    try {
      await this.initialize();
      
      console.log(`🔗 Conectando cliente ${clientId}`);
      
      // Verificar conexão existente
      const existing = this.connections.get(clientId);
      if (existing && existing.isConnected) {
        return {
          success: true,
          message: `Cliente ${clientId} já conectado`
        };
      }

      // Criar nova conexão
      const authDir = `whatsapp-sessions/client_${clientId}`;
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Replit WhatsApp Bot', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true
      });

      const connection: WhatsAppConnection = {
        socket,
        qrCode: null,
        isConnected: false,
        phoneNumber: null,
        clientId,
        lastActivity: new Date()
      };

      this.connections.set(clientId, connection);

      // Event handlers
      socket.ev.on('connection.update', async (update: any) => {
        const { connection: connState, lastDisconnect, qr } = update;
        
        if (qr) {
          try {
            const qrCodeDataURL = await QRCode.toDataURL(qr);
            connection.qrCode = qrCodeDataURL;
            await this.saveConnectionToDB(clientId);
            console.log(`📱 QR Code gerado para cliente ${clientId}`);
          } catch (error) {
            console.error('❌ Erro ao gerar QR Code:', error);
          }
        }

        if (connState === 'open') {
          connection.isConnected = true;
          connection.phoneNumber = socket.user?.id?.split(':')[0] || null;
          connection.qrCode = null;
          await this.saveConnectionToDB(clientId);
          console.log(`✅ Cliente ${clientId} conectado: ${connection.phoneNumber}`);
        }

        if (connState === 'close') {
          connection.isConnected = false;
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
          
          if (shouldReconnect) {
            console.log(`🔄 Reconectando cliente ${clientId}...`);
            setTimeout(() => this.connectClient(clientId), 3000);
          } else {
            console.log(`❌ Cliente ${clientId} desconectado (401 - QR expirado)`);
            connection.qrCode = null;
            await this.saveConnectionToDB(clientId);
          }
        }
      });

      socket.ev.on('creds.update', saveCreds);

      // Message handler para entrevistas
      socket.ev.on('messages.upsert', async ({ messages }: any) => {
        const msg = messages[0];
        if (!msg || msg.key.fromMe) return;

        const from = msg.key.remoteJid?.replace('@s.whatsapp.net', '');
        let messageText = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || '';

        // Processar áudio
        let audioMessage = null;
        if (msg.message?.audioMessage) {
          audioMessage = msg.message.audioMessage;
        } else if (msg.message?.viewOnceMessageV2?.message?.audioMessage) {
          audioMessage = msg.message.viewOnceMessageV2.message.audioMessage;
        }

        // Encaminhar para o serviço de entrevistas
        try {
          const { interactiveInterviewService } = await import('./interactiveInterviewService');
          await interactiveInterviewService.handleMessage(from, messageText, audioMessage, clientId);
        } catch (error) {
          console.error('❌ Erro ao processar mensagem:', error);
        }
      });

      // Keep-alive
      const keepAliveInterval = setInterval(() => {
        if (connection.isConnected && socket.user) {
          socket.sendPresenceUpdate('available').catch(() => {});
          connection.lastActivity = new Date();
        } else {
          clearInterval(keepAliveInterval);
        }
      }, 25000);

      return {
        success: true,
        qrCode: connection.qrCode || undefined,
        message: 'Conexão iniciada'
      };

    } catch (error) {
      console.error(`❌ Erro ao conectar cliente ${clientId}:`, error);
      return {
        success: false,
        message: `Erro: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async disconnectClient(clientId: string): Promise<{ success: boolean; message: string }> {
    try {
      const connection = this.connections.get(clientId);
      if (!connection) {
        return { success: false, message: 'Cliente não encontrado' };
      }

      if (connection.socket) {
        await connection.socket.logout();
        connection.socket.end();
      }

      connection.isConnected = false;
      connection.qrCode = null;
      await this.saveConnectionToDB(clientId);
      
      this.connections.delete(clientId);
      
      return { success: true, message: 'Cliente desconectado' };
    } catch (error) {
      console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
      return { success: false, message: 'Erro ao desconectar' };
    }
  }

  async sendMessage(clientId: string, phoneNumber: string, message: string): Promise<{ success: boolean; message: string; messageId?: string }> {
    try {
      const connection = this.connections.get(clientId);
      if (!connection || !connection.isConnected) {
        return { success: false, message: 'Cliente não conectado' };
      }

      const jid = `${phoneNumber}@s.whatsapp.net`;
      const result = await connection.socket.sendMessage(jid, { text: message });
      
      connection.lastActivity = new Date();
      
      return {
        success: true,
        message: 'Mensagem enviada',
        messageId: result.key.id
      };
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para ${phoneNumber}:`, error);
      return { success: false, message: 'Erro ao enviar mensagem' };
    }
  }

  async getClientStatus(clientId: string): Promise<{
    isConnected: boolean;
    qrCode: string | null;
    phoneNumber: string | null;
    lastActivity: Date | null;
  }> {
    // Buscar do banco primeiro
    const dbConfig = await this.loadConnectionFromDB(clientId);
    
    // Verificar conexão ativa em memória
    const connection = this.connections.get(clientId);
    
    return {
      isConnected: connection?.isConnected || false,
      qrCode: dbConfig?.whatsappQrCode || connection?.qrCode || null,
      phoneNumber: dbConfig?.whatsappPhoneNumber || connection?.phoneNumber || null,
      lastActivity: connection?.lastActivity || null
    };
  }

  private async saveConnectionToDB(clientId: string): Promise<void> {
    try {
      const connection = this.connections.get(clientId);
      if (!connection) return;

      const apiConfig = await storage.getApiConfig('client', clientId) || {};
      
      await storage.updateApiConfig('client', clientId, {
        ...apiConfig,
        whatsappConnected: connection.isConnected,
        whatsappQrCode: connection.qrCode || null,
        whatsappPhoneNumber: connection.phoneNumber || null,
        whatsappLastConnection: connection.isConnected ? new Date() : null
      });
      
      console.log(`💾 Status salvo para cliente ${clientId}: ${connection.isConnected ? 'CONECTADO' : 'DESCONECTADO'}`);
    } catch (error) {
      console.error('❌ Erro ao salvar no banco:', error);
    }
  }

  private async loadConnectionFromDB(clientId: string) {
    try {
      return await storage.getApiConfig('client', clientId);
    } catch (error) {
      console.error('❌ Erro ao carregar do banco:', error);
      return null;
    }
  }
}

export const whatsappManager = new WhatsAppManager();