import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { storage } from './storage.js';

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
      this.baileys = await import('@whiskeysockets/baileys');
      console.log('📱 Baileys inicializado para ClientWhatsAppService');
    } catch (error) {
      console.error('❌ Erro ao importar Baileys:', error);
    }
  }

  private getSessionPath(clientId: string): string {
    return path.join('./whatsapp-sessions', `client-${clientId}`);
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
          throw new Error('Baileys não disponível');
        }
      }

      // Garantir diretório da sessão
      await this.ensureSessionDirectory(clientId);

      const { makeWASocket, useMultiFileAuthState } = this.baileys;
      const sessionPath = this.getSessionPath(clientId);

      // Configurar autenticação
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      // Criar socket
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        connectTimeoutMs: 10000,
        defaultQueryTimeoutMs: 5000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 1000,
        maxMsgRetryCount: 3,
      });

      // Configurar eventos
      let qrCodeGenerated: string | null = null;

      socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log(`📱 QR Code gerado para cliente ${clientId}`);
          try {
            const qrCodeDataURL = await qrcode.toDataURL(qr);
            qrCodeGenerated = qrCodeDataURL;
            
            // Atualizar configuração no banco
            await this.updateClientConfig(clientId, {
              qrCode: qrCodeDataURL,
              isConnected: false,
              lastConnection: new Date()
            });
          } catch (qrError) {
            console.error(`❌ Erro ao gerar QR Code para cliente ${clientId}:`, qrError);
          }
        }

        if (connection === 'close') {
          console.log(`❌ Conexão fechada para cliente ${clientId}`);
          await this.updateClientConfig(clientId, {
            isConnected: false,
            qrCode: null,
            phoneNumber: null,
            lastConnection: new Date()
          });
          this.sessions.delete(clientId);
        } else if (connection === 'open') {
          console.log(`✅ WhatsApp conectado para cliente ${clientId}`);
          const phoneNumber = socket.user?.id?.split(':')[0] || 'unknown';
          
          await this.updateClientConfig(clientId, {
            isConnected: true,
            qrCode: null,
            phoneNumber,
            lastConnection: new Date()
          });
        }
      });

      socket.ev.on('creds.update', saveCreds);

      // Armazenar sessão
      const session: WhatsAppSession = {
        socket,
        config: {
          clientId,
          isConnected: false,
          qrCode: null,
          phoneNumber: null,
          lastConnection: new Date()
        },
        makeWASocket,
        useMultiFileAuthState
      };

      this.sessions.set(clientId, session);

      // Aguardar QR Code ou conexão (timeout de 10 segundos)
      await new Promise(resolve => setTimeout(resolve, 3000));

      if (qrCodeGenerated) {
        return {
          success: true,
          qrCode: qrCodeGenerated,
          message: 'QR Code gerado. Escaneie com seu WhatsApp.'
        };
      }

      return {
        success: true,
        message: 'Conexão iniciada. Aguarde...'
      };

    } catch (error) {
      console.error(`❌ Erro ao conectar WhatsApp cliente ${clientId}:`, error);
      return {
        success: false,
        message: `Erro na conexão: ${error.message}`
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
          console.log(`⚠️ Erro no logout para cliente ${clientId}:`, logoutError.message);
        }
      }

      // Limpar diretório da sessão
      const sessionPath = this.getSessionPath(clientId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }

      // Atualizar configuração no banco
      await this.updateClientConfig(clientId, {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: new Date()
      });

      // Remover sessão
      this.sessions.delete(clientId);

      return {
        success: true,
        message: 'WhatsApp desconectado com sucesso'
      };

    } catch (error) {
      console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
      return {
        success: false,
        message: `Erro na desconexão: ${error.message}`
      };
    }
  }

  async sendTestMessage(clientId: string, phoneNumber: string, message: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`💬 Enviando teste WhatsApp para cliente ${clientId}: ${phoneNumber}`);

      const session = this.sessions.get(clientId);
      if (!session?.socket) {
        return {
          success: false,
          message: 'Cliente não conectado ao WhatsApp'
        };
      }

      // Formatar número
      const formattedNumber = phoneNumber.replace(/[^\d]/g, '');
      const jid = formattedNumber.includes('@') ? formattedNumber : `${formattedNumber}@s.whatsapp.net`;

      // Enviar mensagem
      await session.socket.sendMessage(jid, { text: message });

      console.log(`✅ Mensagem enviada para ${phoneNumber} via cliente ${clientId}`);

      return {
        success: true,
        message: 'Mensagem enviada com sucesso'
      };

    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para cliente ${clientId}:`, error);
      return {
        success: false,
        message: `Erro no envio: ${error.message}`
      };
    }
  }

  async getClientStatus(clientId: string): Promise<WhatsAppClientConfig> {
    try {
      // Buscar configuração do banco
      const apiConfig = await storage.getApiConfig('client', clientId);
      
      return {
        clientId,
        isConnected: apiConfig?.whatsappQrConnected || false,
        phoneNumber: apiConfig?.whatsappQrPhoneNumber || null,
        lastConnection: apiConfig?.whatsappQrLastConnection || null,
        qrCode: null // QR Code não é persistido
      };
    } catch (error) {
      console.error(`❌ Erro ao buscar status do cliente ${clientId}:`, error);
      return {
        clientId,
        isConnected: false,
        phoneNumber: null,
        lastConnection: null,
        qrCode: null
      };
    }
  }

  private async updateClientConfig(clientId: string, updates: Partial<WhatsAppClientConfig>) {
    try {
      // Buscar configuração existente
      let apiConfig = await storage.getApiConfig('client', clientId);
      
      if (!apiConfig) {
        // Criar configuração se não existir
        apiConfig = await storage.createApiConfig({
          entityType: 'client',
          entityId: clientId,
          openaiVoice: 'nova',
          whatsappQrConnected: false,
          whatsappQrPhoneNumber: null,
          whatsappQrLastConnection: null,
          firebaseProjectId: null,
          firebaseServiceAccount: null
        });
      }

      // Atualizar configuração
      await storage.updateApiConfig(apiConfig.id, {
        whatsappQrConnected: updates.isConnected ?? apiConfig.whatsappQrConnected,
        whatsappQrPhoneNumber: updates.phoneNumber ?? apiConfig.whatsappQrPhoneNumber,
        whatsappQrLastConnection: updates.lastConnection ?? apiConfig.whatsappQrLastConnection,
        updatedAt: new Date()
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
        console.log(`⚠️ Erro ao fazer logout da sessão ${clientId}:`, error.message);
      }
    }

    this.sessions.clear();

    // Limpar diretórios de sessão
    const sessionsDir = './whatsapp-sessions';
    if (fs.existsSync(sessionsDir)) {
      const files = fs.readdirSync(sessionsDir);
      for (const file of files) {
        if (file.startsWith('client-')) {
          const filePath = path.join(sessionsDir, file);
          fs.rmSync(filePath, { recursive: true, force: true });
        }
      }
    }

    console.log('✅ Limpeza de sessões concluída');
  }
}

// Instância única do serviço
export const clientWhatsAppService = new ClientWhatsAppService();