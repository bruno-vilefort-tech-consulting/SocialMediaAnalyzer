import { storage } from '../../server/storage';
import { interactiveInterviewService } from '../../server/interactiveInterviewService';

// Usar import dinâmico para baileys e qrcode
let makeWASocket: any;
let useMultiFileAuthState: any;
let QRCode: any;

async function initializeDependencies() {
  if (!makeWASocket) {
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.makeWASocket;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    const qrCodeModule = await import('qrcode');
    QRCode = qrCodeModule.default || qrCodeModule;
  }
}

// Interface padronizada para retorno de conexões
export interface InitResult {
  success: boolean;
  qrCode?: string;
  isConnected: boolean;
  message?: string;
}

interface WhatsAppState {
  qrCode: string;
  isConnected: boolean;
  phoneNumber: string | null;
  socket: any;
}

class WhatsAppBaileyService {
  private connections: Map<string, WhatsAppState> = new Map();

  async initWhatsApp(clientId: string): Promise<InitResult> {
    await initializeDependencies();
    
    if (this.connections.has(clientId)) {
      const existing = this.connections.get(clientId)!;
      if (existing.isConnected) {
        return {
          success: true,
          isConnected: true,
          message: 'Já conectado'
        };
      }
    }

    return new Promise<InitResult>(async (resolve, reject) => {
      try {
        const authDir = `whatsapp-sessions/client_${clientId}`;
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        
        // Configuração de versão WhatsApp Web corrigida
        let latestVersion: number[] = [2, 2419, 6]; // Versão fixa como fallback
        try {
          const baileys = await import('@whiskeysockets/baileys');
          if (baileys.fetchLatestBaileysVersion) {
            const versionInfo = await baileys.fetchLatestBaileysVersion();
            if (versionInfo && typeof versionInfo === 'object' && 'version' in versionInfo) {
              latestVersion = versionInfo.version as number[];
            }
          }
        } catch (error) {
        }
        
        const sock = makeWASocket({ 
          auth: state,
          version: latestVersion,
          printQRInTerminal: false,
          browser: ['Chrome (Linux)', '', ''], // Browser padrão web
          logger: {
            level: 'silent',
            child: () => ({ level: 'silent' }),
            trace: () => {},
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            fatal: () => {}
          },
          // Timeouts ajustados para ambiente Replit
          keepAliveIntervalMs: 30000,     // ping a cada 30s
          connectTimeoutMs: 60000,
          defaultQueryTimeoutMs: 60000,
          qrTimeout: 90000,
          retryRequestDelayMs: 5000,
          maxMsgRetryCount: 3,
          syncFullHistory: false, // Reduz frames WebSocket grandes
          getMessage: async () => undefined
        });

        const connectionState: WhatsAppState = {
          qrCode: '',
          isConnected: false,
          phoneNumber: null,
          socket: sock
        };

        this.connections.set(clientId, connectionState);

        sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect, isNewLogin }: any) => {
          if (qr) {
            const dataURL = await QRCode.toDataURL(qr);
            connectionState.qrCode = dataURL;
            await this.saveConnectionToDB(clientId, connectionState);
            
            // 🔥 CORREÇÃO: Resolver Promise com QR Code
            resolve({
              success: true,
              qrCode: dataURL,
              isConnected: false,
              message: 'QR Code gerado'
            });
          }
          
          // Tratamento especial para isNewLogin - crítico para resolver erro 515
          if (isNewLogin) {
            // Enviar presença imediatamente após nova autenticação
            setTimeout(async () => {
              try {
                await sock.sendPresenceUpdate('available');
              } catch (error) {
              }
            }, 2000);
          }
          
          if (connection === 'open') {
            connectionState.isConnected = true;
            connectionState.phoneNumber = sock.user?.id?.split(':')[0] || null;
            connectionState.qrCode = '';
            
            // 🔥 CORREÇÃO: Resolver Promise com conexão estabelecida
            resolve({
              success: true,
              isConnected: true,
              message: 'Conectado com sucesso'
            });
            
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
              } as any);
            } catch (error) {
            }
          }
          
          if (connection === 'close') {
            const errorCode = (lastDisconnect?.error as any)?.output?.statusCode;
            
            // Códigos transitórios conforme instruções ChatGPT
            const transientCodes = [408, 428, 515];
            
            if (transientCodes.includes(errorCode)) {
              setTimeout(async () => {
                // Limpar conexão anterior antes de reiniciar
                this.connections.delete(clientId);
                await this.initWhatsApp(clientId);
              }, 5000);
              return; // Não marca como desconectado para erros transitórios
            }
            
            connectionState.isConnected = false;
            connectionState.phoneNumber = null;
            
            reject(new Error(`Conexão fechada: ${errorCode}`));
          }
        });

        // Handler de mensagens com correção para download de áudio
        sock.ev.on('messages.upsert', async ({ messages }: any) => {
          for (const message of messages) {
            if (message.key.fromMe || !message.message) continue;
            
            const from = message.key.remoteJid;
            if (!from || !from.includes('@s.whatsapp.net')) continue;
            
            // Extrair texto da mensagem
            let messageText = '';
            if (message.message.conversation) {
              messageText = message.message.conversation;
            } else if (message.message.extendedTextMessage?.text) {
              messageText = message.message.extendedTextMessage.text;
            }
            
            // Verificar se é mensagem de áudio
            let audioMessage = null;
            if (message.message.audioMessage) {
              // Passar a mensagem completa com todos os metadados necessários para download
              audioMessage = message;
            }
            
            // Processar mensagem via interactiveInterviewService
            try {
              await interactiveInterviewService.handleMessage(from, messageText, audioMessage, clientId);
            } catch (error) {
            }
          }
        });

        sock.ev.on('creds.update', async () => {
          try {
            await saveCreds();
          } catch (error) {
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private async saveConnectionToDB(clientId: string, state: WhatsAppState): Promise<void> {
    try {
      const currentConfig = await storage.getApiConfig('client', clientId) || {};
      await storage.upsertApiConfig({
        ...currentConfig,
        entityType: 'client',
        entityId: clientId,
        whatsappQrConnected: state.isConnected,
        whatsappQrPhoneNumber: state.phoneNumber,
        whatsappQrCode: state.qrCode,
        whatsappQrLastConnection: new Date()
      } as any);
    } catch (error) {
    }
  }

  getQR(clientId: string): string | null {
    const connection = this.connections.get(clientId);
    return connection?.qrCode || null;
  }

  isConnected(clientId: string): boolean {
    const connection = this.connections.get(clientId);
    return connection?.isConnected || false;
  }

  getPhoneNumber(clientId: string): string | null {
    const connection = this.connections.get(clientId);
    return connection?.phoneNumber || null;
  }

  getConnection(clientId: string): WhatsAppState | undefined {
    return this.connections.get(clientId);
  }

  async sendMessage(phone: string, text: string): Promise<boolean> {
    const connection = this.connections.values().next().value;
    if (connection && connection.isConnected) {
      try {
        const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
        await connection.socket.sendMessage(jid, { text });
        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  }
}

export const whatsappBaileyService = new WhatsAppBaileyService();