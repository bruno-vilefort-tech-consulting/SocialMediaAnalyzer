import { storage } from "./storage";
import path from "path";
import fs from "fs";
import qrcode from "qrcode";

interface WhatsAppClientStatus {
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
}

interface WhatsAppSession {
  socket: any;
  isConnected: boolean;
  phoneNumber: string | null;
  qrCode: string | null;
  lastConnection: Date | null;
}

class WhatsAppClientModule {
  private sessions: Map<string, WhatsAppSession> = new Map();
  private baileys: any = null;

  constructor() {
    this.initializeBaileys();
  }

  private async initializeBaileys() {
    try {
      this.baileys = await import('@whiskeysockets/baileys');
      console.log('📱 Baileys inicializado para WhatsApp Client Module');
    } catch (error) {
      console.error('❌ Erro ao inicializar Baileys:', error);
    }
  }

  private getSessionPath(clientId: string): string {
    return path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}`);
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
        if (!this.baileys) {
          return { success: false, message: 'Erro ao inicializar Baileys' };
        }
      }

      const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = this.baileys;

      // Garantir diretório da sessão
      await this.ensureSessionDirectory(clientId);
      const sessionPath = this.getSessionPath(clientId);

      // Configurar autenticação
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      // Criar socket WhatsApp
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '22.04.4'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined
      });

      let qrCodeGenerated = false;
      let qrCodeString = '';

      return new Promise((resolve) => {
        // Evento QR Code
        socket.ev.on('connection.update', async (update: any) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr && !qrCodeGenerated) {
            try {
              qrCodeString = await qrcode.toDataURL(qr);
              qrCodeGenerated = true;
              console.log(`📱 QR Code gerado para cliente ${clientId}`);
              
              // Atualizar configuração no Firebase
              await this.updateClientConfig(clientId, {
                isConnected: false,
                qrCode: qrCodeString,
                phoneNumber: null,
                lastConnection: null
              });

              resolve({ 
                success: true, 
                qrCode: qrCodeString, 
                message: 'QR Code gerado. Escaneie com WhatsApp para conectar.' 
              });
            } catch (error) {
              console.error(`❌ Erro ao gerar QR Code para cliente ${clientId}:`, error);
              resolve({ success: false, message: 'Erro ao gerar QR Code' });
            }
          }

          if (connection === 'open') {
            console.log(`✅ WhatsApp conectado para cliente ${clientId}`);
            const phoneNumber = socket.user?.id?.split(':')[0] || null;
            
            const session: WhatsAppSession = {
              socket,
              isConnected: true,
              phoneNumber,
              qrCode: null,
              lastConnection: new Date()
            };

            this.sessions.set(clientId, session);

            // Atualizar configuração no Firebase
            await this.updateClientConfig(clientId, {
              isConnected: true,
              qrCode: null,
              phoneNumber,
              lastConnection: new Date()
            });

            if (qrCodeGenerated) {
              // Já resolveu com QR Code
              return;
            }

            resolve({ 
              success: true, 
              message: `WhatsApp conectado com sucesso! Número: ${phoneNumber}` 
            });
          }

          if (connection === 'close') {
            console.log(`❌ WhatsApp desconectado para cliente ${clientId}`);
            this.sessions.delete(clientId);

            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            
            await this.updateClientConfig(clientId, {
              isConnected: false,
              qrCode: null,
              phoneNumber: null,
              lastConnection: null
            });

            if (!qrCodeGenerated) {
              resolve({ success: false, message: 'Conexão falhou' });
            }
          }
        });

        // Salvar credenciais
        socket.ev.on('creds.update', saveCreds);

        // Timeout para QR Code
        setTimeout(() => {
          if (!qrCodeGenerated) {
            resolve({ success: false, message: 'Timeout ao gerar QR Code' });
          }
        }, 30000);
      });

    } catch (error) {
      console.error(`❌ Erro ao conectar WhatsApp cliente ${clientId}:`, error);
      return { success: false, message: 'Erro interno ao conectar WhatsApp' };
    }
  }

  async disconnectClient(clientId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔌 Desconectando WhatsApp para cliente ${clientId}...`);

      const session = this.sessions.get(clientId);
      if (session?.socket) {
        try {
          await session.socket.logout();
        } catch (error) {
          console.log(`Erro ao fazer logout: ${error}`);
        }
      }

      // Remover sessão da memória
      this.sessions.delete(clientId);

      // Limpar diretório de sessão
      const sessionPath = this.getSessionPath(clientId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }

      // Atualizar configuração no Firebase
      await this.updateClientConfig(clientId, {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null
      });

      return { success: true, message: 'WhatsApp desconectado com sucesso' };
    } catch (error) {
      console.error(`❌ Erro ao desconectar WhatsApp cliente ${clientId}:`, error);
      return { success: false, message: 'Erro ao desconectar WhatsApp' };
    }
  }

  async getClientStatus(clientId: string): Promise<WhatsAppClientStatus> {
    try {
      // Verificar sessão ativa em memória
      const session = this.sessions.get(clientId);
      if (session?.isConnected) {
        return {
          isConnected: true,
          qrCode: null,
          phoneNumber: session.phoneNumber,
          lastConnection: session.lastConnection
        };
      }

      // Buscar status no Firebase
      const config = await storage.getApiConfig('client', clientId);
      if (config) {
        return {
          isConnected: config.whatsappQrConnected || false,
          qrCode: null, // QR codes não são persistidos
          phoneNumber: config.whatsappQrPhoneNumber,
          lastConnection: config.whatsappQrLastConnection
        };
      }

      // Status padrão se não encontrar configuração
      return {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null
      };
    } catch (error) {
      console.error(`❌ Erro ao buscar status WhatsApp cliente ${clientId}:`, error);
      return {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null
      };
    }
  }

  async sendTestMessage(clientId: string, phoneNumber: string, message: string): Promise<{ success: boolean; message: string }> {
    try {
      const session = this.sessions.get(clientId);
      if (!session?.isConnected || !session.socket) {
        return { success: false, message: 'WhatsApp não conectado para este cliente' };
      }

      // Formatar número de telefone
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      const jid = formattedNumber.includes('@') ? formattedNumber : `${formattedNumber}@s.whatsapp.net`;

      // Enviar mensagem
      await session.socket.sendMessage(jid, { text: message });

      console.log(`📱 Mensagem teste enviada para ${phoneNumber} via cliente ${clientId}`);
      return { success: true, message: 'Mensagem de teste enviada com sucesso!' };
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem teste cliente ${clientId}:`, error);
      return { success: false, message: 'Erro ao enviar mensagem de teste' };
    }
  }

  private async updateClientConfig(clientId: string, updates: Partial<WhatsAppClientStatus>) {
    try {
      // Buscar configuração existente ou criar uma nova
      let apiConfig = await storage.getApiConfig('client', clientId);
      
      if (!apiConfig) {
        // Criar configuração padrão se não existir
        apiConfig = await storage.upsertApiConfig({
          entityType: 'client',
          entityId: clientId,
          whatsappQrConnected: false,
          whatsappQrPhoneNumber: null,
          whatsappQrLastConnection: null,
          openaiVoice: 'nova',
          firebaseProjectId: null,
          firebaseServiceAccount: null
        });
      }

      // Atualizar configuração com novos valores
      const configUpdate = {
        entityType: 'client' as const,
        entityId: clientId,
        whatsappQrConnected: updates.isConnected ?? apiConfig.whatsappQrConnected ?? false,
        whatsappQrPhoneNumber: updates.phoneNumber ?? apiConfig.whatsappQrPhoneNumber ?? null,
        whatsappQrLastConnection: updates.lastConnection ?? apiConfig.whatsappQrLastConnection ?? null,
        openaiVoice: apiConfig.openaiVoice || 'nova',
        firebaseProjectId: apiConfig.firebaseProjectId ?? null,
        firebaseServiceAccount: apiConfig.firebaseServiceAccount ?? null
      };

      await storage.upsertApiConfig(configUpdate);
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
    console.log('✅ Todas as sessões WhatsApp limpas');
  }
}

// Exportar instância única
export const whatsappClientModule = new WhatsAppClientModule();