import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import { storage } from './storage';

interface WhatsAppClientConfig {
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
  clientId: string;
}

interface WhatsAppSession {
  socket: any;
  config: WhatsAppClientConfig;
  makeWASocket: any;
  useMultiFileAuthState: any;
}

export class ClientWhatsAppService {
  private sessions: Map<string, WhatsAppSession> = new Map();
  private baileys: any = null;

  constructor() {
    this.initializeBaileys();
  }

  private async initializeBaileys() {
    try {
      console.log('📱 Baileys inicializado para ClientWhatsAppService');
      this.baileys = { makeWASocket, useMultiFileAuthState };
    } catch (error) {
      console.error('❌ Erro ao inicializar Baileys:', error);
    }
  }

  private getSessionPath(clientId: string): string {
    return path.join(process.cwd(), 'whatsapp-sessions', `client-${clientId}`);
  }

  private async ensureSessionDirectory(clientId: string) {
    const sessionPath = this.getSessionPath(clientId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
  }

  async connectClient(clientId: string): Promise<{ success: boolean; qrCode?: string; message: string }> {
    try {
      console.log(`🔗 Iniciando conexão WhatsApp para cliente ${clientId}...`);
      
      if (!this.baileys) {
        await this.initializeBaileys();
      }

      await this.ensureSessionDirectory(clientId);

      const { state, saveCreds } = await this.baileys.useMultiFileAuthState(this.getSessionPath(clientId));
      
      const socket = this.baileys.makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '22.04.4']
      });

      return new Promise((resolve) => {
        let resolved = false;

        socket.ev.on('connection.update', async (update: any) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr && !resolved) {
            console.log(`📱 QR Code gerado para cliente ${clientId}`);
            
            // Atualizar configuração do cliente
            await this.updateClientConfig(clientId, {
              qrCode: qr,
              isConnected: false,
              phoneNumber: null,
              lastConnection: new Date(),
              clientId
            });

            resolved = true;
            resolve({
              success: true,
              qrCode: qr,
              message: 'QR Code gerado com sucesso'
            });
          }

          if (connection === 'open') {
            console.log(`✅ WhatsApp conectado para cliente ${clientId}`);
            
            const phoneNumber = socket.user?.id?.split(':')[0] || null;
            
            await this.updateClientConfig(clientId, {
              isConnected: true,
              phoneNumber,
              lastConnection: new Date(),
              qrCode: null,
              clientId
            });

            // Armazenar sessão ativa
            const session: WhatsAppSession = {
              socket,
              config: {
                isConnected: true,
                qrCode: null,
                phoneNumber,
                lastConnection: new Date(),
                clientId
              },
              makeWASocket: this.baileys.makeWASocket,
              useMultiFileAuthState: this.baileys.useMultiFileAuthState
            };

            this.sessions.set(clientId, session);
          }

          if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`🔌 Conexão fechada para cliente ${clientId}, reconectar:`, shouldReconnect);

            if (!shouldReconnect) {
              await this.updateClientConfig(clientId, {
                isConnected: false,
                phoneNumber: null,
                qrCode: null,
                lastConnection: new Date(),
                clientId
              });
            }
          }
        });

        socket.ev.on('creds.update', saveCreds);

        // Timeout para QR Code
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve({
              success: false,
              message: 'Timeout ao gerar QR Code'
            });
          }
        }, 30000);
      });
    } catch (error) {
      console.error(`❌ Erro ao conectar WhatsApp para cliente ${clientId}:`, error);
      return {
        success: false,
        message: 'Erro interno ao conectar WhatsApp'
      };
    }
  }

  async disconnectClient(clientId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔌 Desconectando WhatsApp para cliente ${clientId}...`);

      const session = this.sessions.get(clientId);
      if (session?.socket) {
        try {
          await session.socket.logout();
        } catch (logoutError) {
          console.log('Erro ao fazer logout, continuando...', logoutError);
        }
      }

      this.sessions.delete(clientId);

      // Limpar pasta de sessão
      const sessionPath = this.getSessionPath(clientId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }

      await this.updateClientConfig(clientId, {
        isConnected: false,
        phoneNumber: null,
        qrCode: null,
        lastConnection: new Date(),
        clientId
      });

      return {
        success: true,
        message: 'WhatsApp desconectado com sucesso'
      };
    } catch (error) {
      console.error(`❌ Erro ao desconectar WhatsApp para cliente ${clientId}:`, error);
      return {
        success: false,
        message: 'Erro ao desconectar WhatsApp'
      };
    }
  }

  async sendTestMessage(clientId: string, phoneNumber: string, message: string): Promise<{ success: boolean; message: string }> {
    try {
      const session = this.sessions.get(clientId);
      
      if (!session?.socket || !session.config.isConnected) {
        return {
          success: false,
          message: 'WhatsApp não está conectado para este cliente'
        };
      }

      const formattedNumber = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      
      await session.socket.sendMessage(formattedNumber, { text: message });
      
      console.log(`✅ Mensagem teste enviada para ${phoneNumber} via cliente ${clientId}`);
      
      return {
        success: true,
        message: 'Mensagem enviada com sucesso'
      };
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem teste para cliente ${clientId}:`, error);
      return {
        success: false,
        message: 'Erro ao enviar mensagem'
      };
    }
  }

  async getClientStatus(clientId: string): Promise<WhatsAppClientConfig> {
    const session = this.sessions.get(clientId);
    
    if (session) {
      return session.config;
    }

    // Buscar do banco de dados se não estiver em memória
    try {
      const apiConfig = await storage.getApiConfig('client', clientId);
      
      return {
        isConnected: apiConfig?.whatsappQrConnected || false,
        qrCode: null, // QR codes não são persistidos
        phoneNumber: apiConfig?.whatsappQrPhoneNumber || null,
        lastConnection: apiConfig?.whatsappQrLastConnection || null,
        clientId
      };
    } catch (error) {
      console.error(`❌ Erro ao buscar status para cliente ${clientId}:`, error);
      return {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null,
        clientId
      };
    }
  }

  private async updateClientConfig(clientId: string, updates: Partial<WhatsAppClientConfig>) {
    try {
      // Buscar configuração existente
      let apiConfig = await storage.getApiConfig('client', clientId);
      
      if (!apiConfig) {
        // Criar configuração se não existir
        await storage.upsertApiConfig({
          entityType: 'client',
          entityId: clientId,
          openaiVoice: 'nova',
          whatsappQrConnected: false,
          whatsappQrPhoneNumber: null,
          whatsappQrLastConnection: null,
          firebaseProjectId: null,
          firebaseServiceAccount: null
        });
        
        // Buscar novamente após criação
        apiConfig = await storage.getApiConfig('client', clientId);
      }

      if (!apiConfig) {
        console.error(`❌ Não foi possível criar/buscar configuração para cliente ${clientId}`);
        return;
      }

      // Atualizar configuração usando upsertApiConfig
      await storage.upsertApiConfig({
        entityType: 'client',
        entityId: clientId,
        whatsappQrConnected: updates.isConnected ?? apiConfig.whatsappQrConnected,
        whatsappQrPhoneNumber: updates.phoneNumber ?? apiConfig.whatsappQrPhoneNumber,
        whatsappQrLastConnection: updates.lastConnection ?? apiConfig.whatsappQrLastConnection,
        openaiVoice: apiConfig.openaiVoice || 'nova',
        firebaseProjectId: apiConfig.firebaseProjectId,
        firebaseServiceAccount: apiConfig.firebaseServiceAccount
      });

      console.log(`💾 Configuração WhatsApp atualizada para cliente ${clientId}`);
    } catch (error) {
      console.error(`❌ Erro ao atualizar configuração do cliente ${clientId}:`, error);
    }
  }

  // Limpar todas as sessões (para manutenção)
  async clearAllSessions(): Promise<void> {
    console.log('🧹 Limpando todas as sessões WhatsApp...');
    
    for (const [clientId, session] of this.sessions.entries()) {
      try {
        if (session.socket) {
          await session.socket.logout();
        }
      } catch (error) {
        console.log(`Erro ao limpar sessão ${clientId}:`, error);
      }
    }
    
    this.sessions.clear();
  }
}

// Instância singleton
export const clientWhatsAppService = new ClientWhatsAppService();