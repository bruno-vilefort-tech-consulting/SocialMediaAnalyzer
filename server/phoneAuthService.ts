import { Boom } from '@hapi/boom';

interface PhoneAuthSession {
  phoneNumber: string;
  code: string;
  expiresAt: Date;
  attempts: number;
  clientId: string;
}

class PhoneAuthService {
  private sessions: Map<string, PhoneAuthSession> = new Map();
  private baileys: any = null;
  private connectedSockets: Map<string, any> = new Map();

  constructor() {
    this.initializeBaileys();
  }

  private async initializeBaileys() {
    try {
      this.baileys = await import('@whiskeysockets/baileys');
    } catch (error) {
      console.error('❌ Erro ao inicializar Baileys:', error);
    }
  }

  async requestVerificationCode(phoneNumber: string, clientId: string): Promise<{ success: boolean; message: string; code?: string }> {
    try {
      if (!this.baileys) {
        await this.initializeBaileys();
      }

      // Limpar código anterior se existir
      this.sessions.delete(phoneNumber);

      // Gerar código de 8 dígitos para WhatsApp Business API
      const code = Math.floor(10000000 + Math.random() * 90000000).toString();
      
      // Armazenar sessão
      this.sessions.set(phoneNumber, {
        phoneNumber,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutos
        attempts: 0,
        clientId
      });

      // Em um ambiente real, você enviaria via API de SMS
      // Por ora, vamos simular o envio via próprio WhatsApp
      return {
        success: true,
        message: `Código enviado para ${phoneNumber}`,
        code // Em produção, não retornar o código
      };

    } catch (error: any) {
      console.error('❌ Erro ao solicitar código:', error);
      return {
        success: false,
        message: error.message || 'Erro ao solicitar código de verificação'
      };
    }
  }

  async verifyCodeAndConnect(phoneNumber: string, code: string, clientId: string): Promise<{ success: boolean; message: string }> {
    try {
      const session = this.sessions.get(phoneNumber);

      if (!session) {
        return {
          success: false,
          message: 'Nenhum código foi solicitado para este número'
        };
      }

      if (session.clientId !== clientId) {
        return {
          success: false,
          message: 'Código não pertence a este cliente'
        };
      }

      if (new Date() > session.expiresAt) {
        this.sessions.delete(phoneNumber);
        return {
          success: false,
          message: 'Código expirado. Solicite um novo código'
        };
      }

      if (session.attempts >= 3) {
        this.sessions.delete(phoneNumber);
        return {
          success: false,
          message: 'Muitas tentativas. Solicite um novo código'
        };
      }

      session.attempts++;

      if (session.code !== code) {
        return {
          success: false,
          message: 'Código inválido'
        };
      }

      // Código válido - criar conexão WhatsApp
      const connectionResult = await this.createWhatsAppConnection(phoneNumber, clientId);
      
      if (connectionResult.success) {
        this.sessions.delete(phoneNumber);
      }

      return connectionResult;

    } catch (error: any) {
      console.error('❌ Erro ao verificar código:', error);
      return {
        success: false,
        message: error.message || 'Erro ao verificar código'
      };
    }
  }

  private async createWhatsAppConnection(phoneNumber: string, clientId: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.baileys) {
        await this.initializeBaileys();
      }

      const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = this.baileys;
      
      // Diretório de sessão específico para este cliente e número
      const sessionPath = `./whatsapp-sessions/phone_${clientId}_${phoneNumber.replace(/\D/g, '')}`;
      
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 10000,
        browser: ['Sistema Entrevistas', 'Phone', '1.0.0'],
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        phoneNumber: phoneNumber, // Usar número fornecido
        getMessage: async (key) => {
          return { conversation: '' };
        }
      });

      return new Promise((resolve) => {
        socket.ev.on('connection.update', async (update: any) => {
          const { connection, lastDisconnect } = update;

          if (connection === 'open') {
            this.connectedSockets.set(clientId, socket);
            
            // Salvar status no Firebase
            // Aqui você salvaria o status de conexão
            
            resolve({
              success: true,
              message: 'WhatsApp conectado com sucesso!'
            });
          } else if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            
            if (!shouldReconnect) {
              this.connectedSockets.delete(clientId);
              resolve({
                success: false,
                message: 'Falha na autenticação. Verifique o número'
              });
            }
          }
        });

        socket.ev.on('creds.update', saveCreds);

        // Timeout de 30 segundos
        setTimeout(() => {
          resolve({
            success: false,
            message: 'Timeout na conexão. Tente novamente'
          });
        }, 30000);
      });

    } catch (error: any) {
      console.error('❌ Erro ao criar conexão WhatsApp:', error);
      return {
        success: false,
        message: error.message || 'Erro ao conectar WhatsApp'
      };
    }
  }

  isConnected(clientId: string): boolean {
    return this.connectedSockets.has(clientId);
  }

  async disconnect(clientId: string): Promise<boolean> {
    try {
      const socket = this.connectedSockets.get(clientId);
      if (socket) {
        await socket.logout();
        this.connectedSockets.delete(clientId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Erro ao desconectar:', error);
      return false;
    }
  }

  // Limpar sessões expiradas periodicamente
  private cleanExpiredSessions() {
    const now = new Date();
    for (const [phoneNumber, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(phoneNumber);
      }
    }
  }
}

export const phoneAuthService = new PhoneAuthService();

// Limpar sessões expiradas a cada 5 minutos
setInterval(() => {
  (phoneAuthService as any).cleanExpiredSessions();
}, 5 * 60 * 1000);