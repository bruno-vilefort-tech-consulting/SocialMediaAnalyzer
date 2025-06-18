import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  WASocket,
  ConnectionState,
  BaileysEventMap
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { storage } from './storage';

interface WhatsAppClientSession {
  socket: WASocket | null;
  qrCode: string | null;
  isConnected: boolean;
  phoneNumber: string | null;
  clientId: string;
  lastConnection: Date | null;
}

class WhatsAppClientManager {
  private sessions: Map<string, WhatsAppClientSession> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 3;

  constructor() {
    console.log('🔧 WhatsAppClientManager inicializado');
  }

  private getSessionPath(clientId: string): string {
    const sessionPath = path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}`);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
    return sessionPath;
  }

  private async saveConnectionStatus(clientId: string, isConnected: boolean, phoneNumber?: string, qrCode?: string) {
    try {
      console.log(`💾 Salvando status WhatsApp para cliente ${clientId}: ${isConnected ? 'CONECTADO' : 'DESCONECTADO'}`);
      
      const configData: any = {
        whatsappQrConnected: isConnected,
        whatsappQrLastConnection: isConnected ? new Date() : null,
      };

      if (phoneNumber) {
        configData.whatsappQrPhoneNumber = phoneNumber;
      }

      if (qrCode) {
        configData.whatsappQrCode = qrCode;
      }

      await storage.upsertApiConfig({
        entityType: 'client',
        entityId: clientId,
        ...configData
      });
      console.log(`✅ Status salvo no Firebase para cliente ${clientId}`);
    } catch (error) {
      console.error(`❌ Erro ao salvar status para cliente ${clientId}:`, error);
    }
  }

  async createConnection(clientId: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      console.log(`🔗 Criando conexão WhatsApp para cliente ${clientId}`);

      // Verificar se já existe uma sessão ativa
      const existingSession = this.sessions.get(clientId);
      if (existingSession?.isConnected) {
        console.log(`✅ Cliente ${clientId} já possui conexão ativa`);
        return { 
          success: true, 
          qrCode: existingSession.qrCode || undefined 
        };
      }

      // Limpar sessão anterior se existir
      if (existingSession?.socket) {
        try {
          existingSession.socket.end(undefined);
        } catch (e) {
          console.log(`🧹 Limpeza de socket anterior para cliente ${clientId}`);
        }
      }

      const sessionPath = this.getSessionPath(clientId);
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      let qrCodeGenerated = false;
      let currentQR: string | null = null;

      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: [`Sistema Entrevistas - Cliente ${clientId}`, 'Desktop', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
      });

      // Inicializar sessão
      const session: WhatsAppClientSession = {
        socket,
        qrCode: null,
        isConnected: false,
        phoneNumber: null,
        clientId,
        lastConnection: null
      };

      this.sessions.set(clientId, session);

      return new Promise((resolve) => {
        let resolved = false;

        // Timeout para gerar QR Code
        const qrTimeout = setTimeout(() => {
          if (!resolved && !qrCodeGenerated) {
            console.log(`⏰ Timeout aguardando QR Code para cliente ${clientId}`);
            resolved = true;
            resolve({ 
              success: false, 
              error: 'Timeout aguardando QR Code' 
            });
          }
        }, 30000);

        socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
          const { connection, lastDisconnect, qr } = update;

          console.log(`📱 Status conexão cliente ${clientId}:`, { connection, hasQR: !!qr });

          if (qr && !qrCodeGenerated) {
            try {
              console.log(`📱 Gerando QR Code para cliente ${clientId}`);
              currentQR = await QRCode.toDataURL(qr);
              session.qrCode = currentQR;
              qrCodeGenerated = true;

              await this.saveConnectionStatus(clientId, false, undefined, currentQR);

              if (!resolved) {
                clearTimeout(qrTimeout);
                resolved = true;
                console.log(`✅ QR Code gerado com sucesso para cliente ${clientId}`);
                resolve({ success: true, qrCode: currentQR });
              }
            } catch (qrError) {
              console.error(`❌ Erro ao gerar QR Code para cliente ${clientId}:`, qrError);
              if (!resolved) {
                clearTimeout(qrTimeout);
                resolved = true;
                resolve({ success: false, error: 'Erro ao gerar QR Code' });
              }
            }
          }

          if (connection === 'open') {
            console.log(`🎉 WhatsApp conectado com sucesso para cliente ${clientId}`);
            const phoneNumber = socket.user?.id?.split(':')[0] || null;
            
            session.isConnected = true;
            session.phoneNumber = phoneNumber;
            session.lastConnection = new Date();
            session.qrCode = null; // Limpar QR após conexão

            await this.saveConnectionStatus(clientId, true, phoneNumber || undefined);
            
            this.reconnectAttempts.delete(clientId);

            if (!resolved) {
              clearTimeout(qrTimeout);
              resolved = true;
              resolve({ success: true });
            }
          }

          if (connection === 'close') {
            console.log(`❌ Conexão fechada para cliente ${clientId}`);
            session.isConnected = false;
            session.phoneNumber = null;

            const shouldReconnect = lastDisconnect?.error instanceof Boom
              ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
              : true;

            if (shouldReconnect) {
              const attempts = this.reconnectAttempts.get(clientId) || 0;
              if (attempts < this.maxReconnectAttempts) {
                console.log(`🔄 Tentativa de reconexão ${attempts + 1} para cliente ${clientId}`);
                this.reconnectAttempts.set(clientId, attempts + 1);
                setTimeout(() => this.createConnection(clientId), 5000);
              } else {
                console.log(`⛔ Máximo de tentativas atingido para cliente ${clientId}`);
                this.reconnectAttempts.delete(clientId);
              }
            } else {
              console.log(`🚪 Logout detectado para cliente ${clientId} - limpando sessão`);
              await this.cleanSession(clientId);
            }

            await this.saveConnectionStatus(clientId, false);
          }
        });

        socket.ev.on('creds.update', saveCreds);
      });

    } catch (error) {
      console.error(`❌ Erro ao criar conexão para cliente ${clientId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  async getStatus(clientId: string): Promise<{
    isConnected: boolean;
    phoneNumber: string | null;
    qrCode: string | null;
    hasQrCode: boolean;
  }> {
    const session = this.sessions.get(clientId);
    
    // Buscar do Firebase se não tiver na memória
    if (!session) {
      try {
        const config = await storage.getApiConfig('client', clientId);
        return {
          isConnected: config?.whatsappQrConnected || false,
          phoneNumber: config?.whatsappQrPhoneNumber || null,
          qrCode: config?.whatsappQrCode || null,
          hasQrCode: !!(config?.whatsappQrCode)
        };
      } catch (error) {
        console.error(`❌ Erro ao buscar status do cliente ${clientId}:`, error);
        return {
          isConnected: false,
          phoneNumber: null,
          qrCode: null,
          hasQrCode: false
        };
      }
    }

    return {
      isConnected: session.isConnected,
      phoneNumber: session.phoneNumber,
      qrCode: session.qrCode,
      hasQrCode: !!session.qrCode
    };
  }

  async disconnect(clientId: string): Promise<boolean> {
    try {
      console.log(`🔌 Desconectando cliente ${clientId}`);
      
      const session = this.sessions.get(clientId);
      if (session?.socket) {
        session.socket.end(undefined);
      }

      await this.cleanSession(clientId);
      await this.saveConnectionStatus(clientId, false);

      console.log(`✅ Cliente ${clientId} desconectado com sucesso`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
      return false;
    }
  }

  async sendMessage(clientId: string, phoneNumber: string, message: string): Promise<boolean> {
    try {
      const session = this.sessions.get(clientId);
      
      if (!session?.isConnected || !session.socket) {
        console.error(`❌ Cliente ${clientId} não está conectado`);
        return false;
      }

      const formattedNumber = phoneNumber.includes('@') 
        ? phoneNumber 
        : `${phoneNumber}@s.whatsapp.net`;

      console.log(`📤 Enviando mensagem para ${formattedNumber} via cliente ${clientId}`);
      
      await session.socket.sendMessage(formattedNumber, { text: message });
      
      console.log(`✅ Mensagem enviada com sucesso via cliente ${clientId}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via cliente ${clientId}:`, error);
      return false;
    }
  }

  private async cleanSession(clientId: string): Promise<void> {
    try {
      // Remover da memória
      this.sessions.delete(clientId);
      this.reconnectAttempts.delete(clientId);

      // Limpar arquivos de sessão
      const sessionPath = this.getSessionPath(clientId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🧹 Sessão limpa para cliente ${clientId}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao limpar sessão do cliente ${clientId}:`, error);
    }
  }

  async cleanAllSessions(): Promise<void> {
    console.log('🧹 Limpando todas as sessões WhatsApp...');
    
    for (const [clientId, session] of Array.from(this.sessions.entries())) {
      if (session.socket) {
        try {
          session.socket.end(undefined);
        } catch (e) {
          // Ignorar erros de desconexão
        }
      }
      await this.cleanSession(clientId);
    }

    this.sessions.clear();
    this.reconnectAttempts.clear();
    
    console.log('✅ Todas as sessões WhatsApp foram limpas');
  }
}

export const whatsappClientManager = new WhatsAppClientManager();

// Limpeza ao fechar aplicação
process.on('SIGINT', async () => {
  console.log('🛑 Aplicação sendo fechada, limpando sessões WhatsApp...');
  await whatsappClientManager.cleanAllSessions();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Aplicação sendo terminada, limpando sessões WhatsApp...');
  await whatsappClientManager.cleanAllSessions();
  process.exit(0);
});