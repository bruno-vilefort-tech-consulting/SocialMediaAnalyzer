import makeWASocket, { useMultiFileAuthState, ConnectionState, WASocket, proto } from '@whiskeysockets/baileys';
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
  private socket: WASocket | null = null;
  private config: WhatsAppQRConfig = {
    isConnected: false,
    qrCode: null,
    phoneNumber: null,
    lastConnection: null
  };
  private qrCodeListeners: ((qr: string | null) => void)[] = [];
  private connectionListeners: ((isConnected: boolean) => void)[] = [];

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection() {
    try {
      console.log('🔗 Inicializando conexão WhatsApp QR...');
      
      const { state, saveCreds } = await useMultiFileAuthState('./whatsapp-auth');
      
      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Vamos gerar nosso próprio QR
      });

      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          console.log('📱 Novo QR Code gerado');
          qrcodeTerminal.generate(qr, { small: true });
          
          // Gerar QR Code como string base64 para exibir no frontend
          const qrString = await qrcode.toDataURL(qr);
          this.config.qrCode = qrString;
          this.notifyQRListeners(qrString);
        }

        if (connection === 'close') {
          console.log('❌ Conexão WhatsApp fechada');
          this.config.isConnected = false;
          this.config.qrCode = null;
          this.notifyConnectionListeners(false);
          
          // Tentar reconectar
          setTimeout(() => {
            this.initializeConnection();
          }, 5000);
        } else if (connection === 'open') {
          console.log('✅ WhatsApp conectado com sucesso!');
          this.config.isConnected = true;
          this.config.qrCode = null;
          this.config.lastConnection = new Date();
          this.config.phoneNumber = this.socket?.user?.id?.split('@')[0] || null;
          this.notifyConnectionListeners(true);
          this.notifyQRListeners(null);
        }
      });

      this.socket.ev.on('messages.upsert', async ({ messages }) => {
        await this.handleIncomingMessages(messages);
      });

      this.socket.ev.on('creds.update', saveCreds);

    } catch (error) {
      console.error('❌ Erro ao inicializar WhatsApp QR:', error);
    }
  }

  private async handleIncomingMessages(messages: proto.IWebMessageInfo[]) {
    for (const msg of messages) {
      if (!msg.key.fromMe && msg.message) {
        const from = msg.key.remoteJid;
        const messageText = msg.message.conversation || 
                           msg.message.extendedTextMessage?.text || '';
        
        console.log(`📩 Mensagem recebida de ${from}: ${messageText}`);
        
        // Aqui você pode implementar lógica para processar mensagens de entrevista
        // Por exemplo, verificar se é uma resposta de entrevista em andamento
        await this.processInterviewMessage(from!, messageText, msg);
      }
    }
  }

  private async processInterviewMessage(from: string, text: string, message: proto.IWebMessageInfo) {
    try {
      // Extrair número de telefone
      const phoneNumber = from.split('@')[0];
      
      // Verificar se há uma entrevista em andamento para este número
      const interviewState = await this.getInterviewState(phoneNumber);
      
      if (interviewState) {
        // Processar resposta da entrevista
        console.log(`🎤 Processando resposta de entrevista de ${phoneNumber}`);
        
        // Se for áudio, processar o áudio
        if (message.message?.audioMessage) {
          await this.handleAudioResponse(phoneNumber, message.message.audioMessage);
        } else {
          // Se for texto, processar como resposta de texto
          await this.handleTextResponse(phoneNumber, text);
        }
      } else {
        // Mensagem geral - responder com informações básicas
        await this.sendTextMessage(phoneNumber, 'Olá! Este é o sistema de entrevistas da empresa. Aguarde instruções ou entre em contato com o RH.');
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem de entrevista:', error);
    }
  }

  private async handleAudioResponse(phone: string, audioMessage: any) {
    // Implementar processamento de áudio similar ao whatsappService.ts
    console.log(`🎵 Processando áudio de ${phone}`);
    // TODO: Integrar com OpenAI para transcrição
  }

  private async handleTextResponse(phone: string, text: string) {
    // Implementar processamento de texto
    console.log(`💬 Processando texto de ${phone}: ${text}`);
    // TODO: Integrar com lógica de entrevista
  }

  private async getInterviewState(phone: string): Promise<any> {
    // TODO: Implementar busca de estado de entrevista no Firebase/storage
    return null;
  }

  public async sendTextMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      if (!this.socket || !this.config.isConnected) {
        console.error('❌ WhatsApp não está conectado');
        return false;
      }

      // Formatar número para WhatsApp (adicionar @s.whatsapp.net)
      const formattedNumber = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      
      await this.socket.sendMessage(formattedNumber, { text: message });
      console.log(`✅ Mensagem enviada para ${phoneNumber}: ${message}`);
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return false;
    }
  }

  public async sendInterviewInvitation(
    candidateName: string,
    phoneNumber: string,
    jobTitle: string,
    message: string,
    selectionId: number
  ): Promise<boolean> {
    try {
      const personalizedMessage = message
        .replace(/\[nome do candidato\]/gi, candidateName)
        .replace(/\[cargo\]/gi, jobTitle);

      return await this.sendTextMessage(phoneNumber, personalizedMessage);
    } catch (error) {
      console.error('❌ Erro ao enviar convite de entrevista:', error);
      return false;
    }
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
    if (this.socket) {
      await this.socket.logout();
      this.socket = null;
      this.config.isConnected = false;
      this.config.qrCode = null;
      console.log('🔌 WhatsApp desconectado');
    }
  }

  public async reconnect() {
    await this.disconnect();
    setTimeout(() => {
      this.initializeConnection();
    }, 2000);
  }
}

export const whatsappQRService = new WhatsAppQRService();