import { storage } from './storage';

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');

interface WhatsAppState {
  qrCode: string;
  isConnected: boolean;
  phoneNumber: string | null;
  socket: any;
}

class WhatsAppBaileyService {
  private connections: Map<string, WhatsAppState> = new Map();

  async initWhatsApp(clientId: string) {
    console.log(`🔑 Inicializando WhatsApp para cliente ${clientId}`);
    
    if (this.connections.has(clientId)) {
      const existing = this.connections.get(clientId)!;
      if (existing.isConnected) {
        console.log(`✅ Cliente ${clientId} já conectado`);
        return existing;
      }
    }

    try {
      const authDir = `whatsapp-sessions/client_${clientId}`;
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      
      const sock = makeWASocket({ 
        auth: state, 
        printQRInTerminal: false,
        browser: ["WhatsApp Business", "Chrome", "118.0.0.0"],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000
      });

      const connectionState: WhatsAppState = {
        qrCode: '',
        isConnected: false,
        phoneNumber: null,
        socket: sock
      };

      this.connections.set(clientId, connectionState);

      sock.ev.on('connection.update', async ({ connection, qr }: any) => {
        if (qr) {
          connectionState.qrCode = await QRCode.toDataURL(qr);
          console.log(`📱 QR Code gerado para cliente ${clientId}`);
          await this.saveConnectionToDB(clientId, connectionState);
        }
        
        if (connection === 'open') {
          console.log(`✅ WhatsApp conectado para cliente ${clientId}`);
          connectionState.isConnected = true;
          connectionState.phoneNumber = sock.user?.id?.split(':')[0] || null;
          connectionState.qrCode = '';
          await this.saveConnectionToDB(clientId, connectionState);
        }
        
        if (connection === 'close') {
          console.log(`🔌 WhatsApp desconectado para cliente ${clientId}`);
          connectionState.isConnected = false;
          connectionState.phoneNumber = null;
          // Reconecta automaticamente após 2 segundos
          setTimeout(() => this.initWhatsApp(clientId), 2000);
        }
      });

      sock.ev.on('creds.update', saveCreds);

      // Keep-alive a cada 25 segundos
      setInterval(() => {
        if (sock?.sendPresenceUpdate && connectionState.isConnected) {
          sock.sendPresenceUpdate('available');
        }
      }, 25000);

      return connectionState;
    } catch (error) {
      console.error(`❌ Erro ao inicializar WhatsApp para cliente ${clientId}:`, error);
      throw error;
    }
  }

  private async saveConnectionToDB(clientId: string, state: WhatsAppState) {
    try {
      const currentConfig = await storage.getApiConfig('client', clientId);
      
      await storage.upsertApiConfig({
        ...currentConfig,
        entityType: 'client',
        entityId: clientId,
        whatsappQrConnected: state.isConnected,
        whatsappQrPhoneNumber: state.phoneNumber,
        whatsappQrCode: state.qrCode,
        whatsappQrLastConnection: state.isConnected ? new Date() : null,
        updatedAt: new Date()
      });
      
      console.log(`💾 Status WhatsApp salvo para cliente ${clientId}: ${state.isConnected ? 'CONECTADO' : 'DESCONECTADO'}`);
    } catch (error) {
      console.error('❌ Erro ao salvar no banco:', error);
    }
  }

  getQR(clientId: string): string {
    const connection = this.connections.get(clientId);
    return connection?.qrCode || '';
  }

  isConnected(clientId: string): boolean {
    const connection = this.connections.get(clientId);
    return connection?.isConnected || false;
  }

  getPhoneNumber(clientId: string): string | null {
    const connection = this.connections.get(clientId);
    return connection?.phoneNumber || null;
  }

  async sendMessage(clientId: string, phone: string, text: string): Promise<boolean> {
    const connection = this.connections.get(clientId);
    
    if (!connection || !connection.isConnected) {
      throw new Error('WhatsApp não conectado para este cliente');
    }

    try {
      const formattedNumber = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
      const result = await connection.socket.sendMessage(formattedNumber, { text });
      console.log(`✅ Mensagem enviada para ${phone} via cliente ${clientId}:`, result?.key?.id);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via cliente ${clientId}:`, error);
      return false;
    }
  }

  getStatus(clientId: string) {
    const connection = this.connections.get(clientId);
    return {
      isConnected: connection?.isConnected || false,
      qrCode: connection?.qrCode || null,
      phoneNumber: connection?.phoneNumber || null
    };
  }

  async connect(clientId: string) {
    return await this.initWhatsApp(clientId);
  }

  async disconnect(clientId: string) {
    const connection = this.connections.get(clientId);
    if (connection?.socket) {
      await connection.socket.logout();
      this.connections.delete(clientId);
      console.log(`🔌 Cliente ${clientId} desconectado`);
    }
  }
}

export const whatsappBaileyService = new WhatsAppBaileyService();