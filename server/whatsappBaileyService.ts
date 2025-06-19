import { storage } from './storage';

// Usar import dinâmico para baileys e qrcode
let makeWASocket: any;
let useMultiFileAuthState: any;
let QRCode: any;

async function initializeDependencies() {
  if (!makeWASocket) {
    console.log('📦 Carregando dependências Baileys...');
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    const qrCodeModule = await import('qrcode');
    QRCode = qrCodeModule.default || qrCodeModule;
    console.log('📦 Dependências carregadas com sucesso');
  }
}

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
    
    // Inicializar dependências primeiro
    await initializeDependencies();
    
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
          console.log(`📱 QR Code gerado para cliente ${clientId} - Length: ${connectionState.qrCode.length}`);
          console.log(`📱 QR Code Preview: ${connectionState.qrCode.substring(0, 50)}...`);
          await this.saveConnectionToDB(clientId, connectionState);
        }
        
        if (connection === 'open') {
          console.log(`✅ WhatsApp conectado para cliente ${clientId}`);
          connectionState.isConnected = true;
          connectionState.phoneNumber = sock.user?.id?.split(':')[0] || null;
          connectionState.qrCode = '';
          
          // Salvar status CONECTADO no banco
          try {
            const config = await storage.getApiConfig('client', clientId) || {};
            await storage.upsertApiConfig({
              ...config,
              entityType: 'client',
              entityId: clientId,
              whatsappQrConnected: true,
              whatsappQrPhoneNumber: connectionState.phoneNumber,
              whatsappQrCode: null, // Limpar QR Code quando conectado
              whatsappQrLastConnection: new Date()
            });
            console.log(`💾 Status CONECTADO salvo no banco para cliente ${clientId}`);
          } catch (error) {
            console.log(`❌ Erro ao salvar status conectado:`, error.message);
          }
        }
        
        if (connection === 'close') {
          console.log(`🔌 WhatsApp desconectado para cliente ${clientId}`);
          connectionState.isConnected = false;
          connectionState.phoneNumber = null;
          
          // Salvar status DESCONECTADO no banco
          try {
            const config = await storage.getApiConfig('client', clientId) || {};
            await storage.upsertApiConfig({
              ...config,
              entityType: 'client',
              entityId: clientId,
              whatsappQrConnected: false,
              whatsappQrPhoneNumber: null,
              whatsappQrLastConnection: new Date()
            });
            console.log(`💾 Status DESCONECTADO salvo no banco para cliente ${clientId}`);
          } catch (error) {
            console.log(`❌ Erro ao salvar status desconectado:`, error.message);
          }
          
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
        whatsappQrLastConnection: state.isConnected ? new Date() : null
      });
      
      console.log(`💾 Status WhatsApp salvo para cliente ${clientId}: ${state.isConnected ? 'CONECTADO' : 'DESCONECTADO'}`);
      console.log(`💾 QR Code salvo: ${state.qrCode ? 'SIM' : 'NÃO'} - Length: ${state.qrCode?.length || 0}`);
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

  getAllConnections() {
    return this.connections;
  }

  async connect(clientId: string) {
    const existingConnection = this.connections.get(clientId);
    if (existingConnection?.isConnected) {
      console.log(`📱 Cliente ${clientId} já conectado`);
      return {
        success: true,
        qrCode: null,
        message: 'Já conectado'
      };
    }
    
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

  async restoreConnections() {
    try {
      console.log('🔄 Restaurando conexões WhatsApp após restart...');
      
      const fs = await import('fs');
      if (fs.existsSync('./whatsapp-sessions')) {
        const sessions = fs.readdirSync('./whatsapp-sessions');
        
        for (const sessionDir of sessions) {
          if (sessionDir.startsWith('client_')) {
            const clientId = sessionDir.replace('client_', '');
            const credsPath = `./whatsapp-sessions/${sessionDir}/creds.json`;
            
            if (fs.existsSync(credsPath)) {
              console.log(`📱 Restaurando sessão para cliente ${clientId}...`);
              try {
                await this.initWhatsApp(clientId);
              } catch (error) {
                console.log(`❌ Erro ao restaurar cliente ${clientId}:`, error.message);
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`❌ Erro na restauração:`, error.message);
    }
  }
}

export const whatsappBaileyService = new WhatsAppBaileyService();