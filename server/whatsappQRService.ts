import qrcode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import { storage } from './storage';

interface WhatsAppQRConfig {
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
}

export class WhatsAppQRService {
  private socket: any = null;
  private config: WhatsAppQRConfig = {
    isConnected: false,
    qrCode: null,
    phoneNumber: null,
    lastConnection: null
  };
  private qrCodeListeners: ((qr: string | null) => void)[] = [];
  private connectionListeners: ((isConnected: boolean) => void)[] = [];
  private makeWASocket: any = null;
  private useMultiFileAuthState: any = null;
  private baileys: any = null;

  constructor() {
    this.initializeBaileys().then(() => {
      this.loadConnectionFromDB().then(() => {
        this.initializeConnection();
      });
    }).catch(error => {
      console.error('❌ Erro ao inicializar WhatsApp QR:', error.message);
    });
  }

  private async initializeBaileys() {
    try {
      this.baileys = await import('@whiskeysockets/baileys');
      this.makeWASocket = this.baileys.default || this.baileys.makeWASocket;
      this.useMultiFileAuthState = this.baileys.useMultiFileAuthState;
      
      if (!this.makeWASocket) {
        throw new Error('makeWASocket não encontrado na biblioteca Baileys');
      }
    } catch (error) {
      console.error('❌ Erro ao importar Baileys:', error);
      throw error;
    }
  }

  private async loadConnectionFromDB() {
    try {
      const config = await storage.getApiConfig();
      if (config && config.whatsappQrConnected) {
        this.config.isConnected = config.whatsappQrConnected;
        this.config.phoneNumber = config.whatsappQrPhoneNumber || null;
        this.config.lastConnection = config.whatsappQrLastConnection;
        console.log('📱 Dados WhatsApp QR carregados do banco:', {
          connected: this.config.isConnected,
          phone: this.config.phoneNumber,
          lastConnection: this.config.lastConnection
        });
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados WhatsApp QR do banco:', error);
    }
  }

  private async saveConnectionToDB() {
    try {
      const currentConfig = await storage.getApiConfig();
      await storage.upsertApiConfig({
        ...currentConfig,
        whatsappQrConnected: this.config.isConnected,
        whatsappQrPhoneNumber: this.config.phoneNumber,
        whatsappQrLastConnection: this.config.lastConnection
      });
      console.log('💾 Conexão WhatsApp QR salva no banco de dados');
    } catch (error) {
      console.error('❌ Erro ao salvar conexão WhatsApp QR no banco:', error);
    }
  }

  private async initializeConnection() {
    try {
      if (!this.makeWASocket || !this.useMultiFileAuthState) {
        throw new Error('Baileys não foi inicializado corretamente');
      }

      console.log('🔗 Inicializando conexão WhatsApp QR...');
      
      const { state, saveCreds } = await this.useMultiFileAuthState('./whatsapp-auth');
      
      this.socket = this.makeWASocket({
        auth: state,
        printQRInTerminal: true,
      });

      this.socket.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          this.generateQRCode(qr);
        }
        
        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
          console.log('🔌 Conexão fechada devido a:', lastDisconnect?.error?.message);
          
          this.config.isConnected = false;
          this.config.phoneNumber = null;
          this.config.lastConnection = null;
          this.notifyConnectionListeners(false);
          
          // Salvar desconexão no banco de dados
          this.saveConnectionToDB();
          
          if (shouldReconnect) {
            console.log('🔄 Reconectando...');
            setTimeout(() => this.initializeConnection(), 5000);
          }
        } else if (connection === 'open') {
          console.log('✅ WhatsApp QR conectado com sucesso!');
          this.config.isConnected = true;
          this.config.qrCode = null;
          this.config.phoneNumber = this.socket.user?.id?.split(':')[0] || 'Conectado';
          this.config.lastConnection = new Date();
          this.notifyQRListeners(null);
          this.notifyConnectionListeners(true);
          
          // Salvar conexão no banco de dados
          this.saveConnectionToDB();
        }
      });

      this.socket.ev.on('creds.update', saveCreds);
      this.socket.ev.on('messages.upsert', this.handleIncomingMessages.bind(this));

    } catch (error) {
      console.error('❌ Erro ao inicializar conexão WhatsApp QR:', error);
      this.config.isConnected = false;
      this.notifyConnectionListeners(false);
    }
  }

  private async generateQRCode(qr: string) {
    try {
      const qrCodeDataURL = await qrcode.toDataURL(qr);
      this.config.qrCode = qrCodeDataURL;
      this.notifyQRListeners(qrCodeDataURL);
      
      console.log('📱 QR Code gerado! Escaneie com seu WhatsApp.');
      qrcodeTerminal.generate(qr, { small: true });
    } catch (error) {
      console.error('❌ Erro ao gerar QR Code:', error);
    }
  }

  private async handleIncomingMessages({ messages }: any) {
    for (const message of messages) {
      if (!message.key.fromMe && message.message) {
        const from = message.key.remoteJid;
        const text = message.message.conversation || 
                    message.message.extendedTextMessage?.text || '';
        
        if (text && from) {
          console.log(`📨 Mensagem recebida de ${from}: ${text}`);
          await this.processInterviewMessage(from, text, message);
        }
      }
    }
  }

  private async processInterviewMessage(from: string, text: string, message: any) {
    try {
      // Aqui implementaria a lógica de entrevista similar ao whatsappService.ts
      console.log(`🤖 Processando mensagem de entrevista de ${from}: ${text}`);
      
      // Por agora, apenas responde com uma mensagem padrão
      await this.sendTextMessage(from, "Olá! Sua mensagem foi recebida via WhatsApp QR. Sistema de entrevistas em desenvolvimento.");
    } catch (error) {
      console.error('❌ Erro ao processar mensagem de entrevista:', error);
    }
  }

  public async sendTextMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      if (!this.socket || !this.config.isConnected) {
        throw new Error('WhatsApp QR não está conectado');
      }

      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      await this.socket.sendMessage(jid, { text: message });
      
      console.log(`✅ Mensagem enviada via QR para ${phoneNumber}: ${message}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via QR para ${phoneNumber}:`, error);
      return false;
    }
  }

  public async sendInterviewInvitation(
    phoneNumber: string, 
    candidateName: string, 
    jobTitle: string, 
    interviewLink: string
  ): Promise<boolean> {
    const message = `Olá ${candidateName}! 👋

Você foi selecionado(a) para a próxima etapa da vaga: *${jobTitle}*

🎤 *Entrevista por Voz Online*
- Sistema inteligente com perguntas por áudio
- Responda também por áudio
- Processo rápido e moderno

🔗 *Acesse sua entrevista:*
${interviewLink}

⏰ Complete quando estiver pronto(a)!

_Mensagem enviada via WhatsApp QR - Sistema de Entrevistas IA_`;

    return await this.sendTextMessage(phoneNumber, message);
  }

  public getConnectionStatus(): WhatsAppQRConfig {
    return { ...this.config };
  }

  public onQRCode(callback: (qr: string | null) => void) {
    this.qrCodeListeners.push(callback);
  }

  public onConnectionChange(callback: (isConnected: boolean) => void) {
    this.connectionListeners.push(callback);
  }

  private notifyQRListeners(qr: string | null) {
    this.qrCodeListeners.forEach(callback => callback(qr));
  }

  private notifyConnectionListeners(isConnected: boolean) {
    this.connectionListeners.forEach(callback => callback(isConnected));
  }

  public async disconnect() {
    try {
      if (this.socket) {
        await this.socket.logout();
        this.socket = null;
      }
      
      this.config.isConnected = false;
      this.config.qrCode = null;
      this.config.phoneNumber = null;
      this.config.lastConnection = null;
      
      this.notifyConnectionListeners(false);
      this.notifyQRListeners(null);
      
      console.log('🔌 WhatsApp QR desconectado');
    } catch (error) {
      console.error('❌ Erro ao desconectar WhatsApp QR:', error);
    }
  }

  public async reconnect() {
    await this.disconnect();
    setTimeout(() => this.initializeConnection(), 2000);
  }
}

export const whatsappQRService = new WhatsAppQRService();