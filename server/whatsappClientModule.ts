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

      // Limpar sessão anterior se existir
      const existingSession = this.sessions.get(clientId);
      if (existingSession) {
        try {
          if (existingSession.socket) {
            await existingSession.socket.logout();
          }
        } catch (error) {
          console.log(`⚠️ Erro ao limpar sessão anterior: ${error}`);
        }
        this.sessions.delete(clientId);
      }

      // Limpar diretório de sessão para forçar novo QR
      const sessionPath = this.getSessionPath(clientId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🗑️ Diretório de sessão removido: ${sessionPath}`);
      }

      if (!this.baileys) {
        await this.initializeBaileys();
        if (!this.baileys) {
          return { success: false, message: 'Erro ao inicializar Baileys' };
        }
      }

      const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = this.baileys;

      // Garantir diretório da sessão específico do cliente
      await this.ensureSessionDirectory(clientId);

      // Configurar autenticação isolada por cliente
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      // Criar logger silencioso para evitar spam
      const logger = {
        level: 'silent',
        child: () => logger,
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {}
      };

      // Criar socket WhatsApp com configurações otimizadas
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: logger,
        browser: ['WhatsApp Business', 'Chrome', '118.0.0.0'],
        connectTimeoutMs: 45000,
        defaultQueryTimeoutMs: 45000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 1000,
        maxMsgRetryCount: 3,
        qrTimeout: 90000, // 90 segundos para QR Code
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        shouldSyncHistoryMessage: () => false,
        shouldIgnoreJid: (jid: string) => jid.includes('@newsletter'),
        emitOwnEvents: false,
        getMessage: async () => ({ conversation: 'Hi' })
      });

      let qrCodeGenerated = false;
      let qrCodeString = '';
      let connectionResolved = false;

      return new Promise((resolve) => {
        // Timeout global para a operação
        const globalTimeout = setTimeout(() => {
          if (!connectionResolved) {
            connectionResolved = true;
            console.log(`⏰ Timeout global para cliente ${clientId}`);
            resolve({ success: false, message: 'Timeout ao conectar WhatsApp' });
          }
        }, 60000); // 60 segundos total

        // Evento QR Code
        socket.ev.on('connection.update', async (update: any) => {
          try {
            const { connection, lastDisconnect, qr } = update;

            console.log(`📱 [CLIENT ${clientId}] Connection update:`, { 
              connection, 
              hasQR: !!qr,
              hasDisconnect: !!lastDisconnect 
            });

            if (qr && !qrCodeGenerated && !connectionResolved) {
              try {
                qrCodeString = await qrcode.toDataURL(qr, { 
                  width: 256, 
                  margin: 2,
                  color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                  }
                });
                qrCodeGenerated = true;
                connectionResolved = true;
                clearTimeout(globalTimeout);
                
                console.log(`✅ QR Code gerado para cliente ${clientId} - ${qrCodeString.length} chars`);
                
                // Atualizar configuração no Firebase imediatamente
                await this.updateClientConfig(clientId, {
                  isConnected: false,
                  qrCode: qrCodeString,
                  phoneNumber: null,
                  lastConnection: null
                });

                resolve({ 
                  success: true, 
                  qrCode: qrCodeString, 
                  message: 'QR Code gerado - escaneie em até 90 segundos (tempo estendido)' 
                });
              } catch (qrError) {
                console.error(`❌ Erro ao gerar QR Code para cliente ${clientId}:`, qrError);
                if (!connectionResolved) {
                  connectionResolved = true;
                  clearTimeout(globalTimeout);
                  resolve({ success: false, message: 'Erro ao gerar QR Code' });
                }
              }
            }
            
            if (connection === 'connecting') {
              console.log(`🔗 Cliente ${clientId}: WhatsApp conectando...`);
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
              console.log(`💾 Sessão ativa salva para cliente ${clientId} - número: ${phoneNumber}`);

              // Atualizar status no Firebase
              await this.updateClientConfig(clientId, {
                isConnected: true,
                qrCode: null,
                phoneNumber,
                lastConnection: new Date()
              });
            }

            if (connection === 'close') {
              console.log(`❌ WhatsApp desconectado para cliente ${clientId}`);
              this.sessions.delete(clientId);

              await this.updateClientConfig(clientId, {
                isConnected: false,
                qrCode: null,
                phoneNumber: null,
                lastConnection: null
              });

              if (!qrCodeGenerated && !connectionResolved) {
                connectionResolved = true;
                clearTimeout(globalTimeout);
                resolve({ success: false, message: 'Conexão falhou - tente novamente' });
              }
            }
          } catch (updateError) {
            console.error(`❌ Erro no handler de conexão para cliente ${clientId}:`, updateError);
          }
        });

        // Salvar credenciais
        socket.ev.on('creds.update', async () => {
          try {
            await saveCreds();
          } catch (credsError) {
            console.error(`❌ Erro ao salvar credenciais cliente ${clientId}:`, credsError);
          }
        });

        // Adicionar à sessão temporária mesmo antes da conexão
        this.sessions.set(clientId, {
          socket,
          isConnected: false,
          phoneNumber: null,
          qrCode: null,
          lastConnection: null
        });

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
      // Verificar sessão ativa em memória primeiro
      const session = this.sessions.get(clientId);
      if (session) {
        if (session.isConnected) {
          return {
            isConnected: true,
            qrCode: null,
            phoneNumber: session.phoneNumber,
            lastConnection: session.lastConnection
          };
        } else if (session.qrCode) {
          // Sessão com QR Code disponível
          return {
            isConnected: false,
            qrCode: session.qrCode,
            phoneNumber: null,
            lastConnection: null
          };
        }
      }

      // Buscar status no Firebase
      const config = await storage.getApiConfig('client', clientId);
      if (config) {
        // Verificar se há QR Code salvo no Firebase (temporariamente)
        const hasQrCode = config.whatsappQrCode && config.whatsappQrCode.length > 100;
        
        return {
          isConnected: config.whatsappQrConnected || false,
          qrCode: hasQrCode ? config.whatsappQrCode : null,
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
          whatsappQrCode: null,
          openaiVoice: 'nova',
          firebaseProjectId: null,
          firebaseServiceAccount: null
        });
      }

      // Atualizar configuração com novos valores incluindo QR Code
      const configUpdate = {
        entityType: 'client' as const,
        entityId: clientId,
        whatsappQrConnected: updates.isConnected ?? apiConfig.whatsappQrConnected ?? false,
        whatsappQrPhoneNumber: updates.phoneNumber ?? apiConfig.whatsappQrPhoneNumber ?? null,
        whatsappQrLastConnection: updates.lastConnection ?? apiConfig.whatsappQrLastConnection ?? null,
        whatsappQrCode: updates.qrCode ?? null, // Salvar QR Code temporariamente
        openaiVoice: apiConfig.openaiVoice || 'nova',
        firebaseProjectId: apiConfig.firebaseProjectId ?? null,
        firebaseServiceAccount: apiConfig.firebaseServiceAccount ?? null
      };

      await storage.upsertApiConfig(configUpdate);
      
      // Atualizar sessão em memória também
      const session = this.sessions.get(clientId);
      if (session) {
        session.isConnected = updates.isConnected ?? session.isConnected;
        session.phoneNumber = updates.phoneNumber ?? session.phoneNumber;
        session.qrCode = updates.qrCode ?? session.qrCode;
        session.lastConnection = updates.lastConnection ?? session.lastConnection;
      }
      
      console.log(`💾 Configuração WhatsApp atualizada para cliente ${clientId}:`, {
        connected: configUpdate.whatsappQrConnected,
        hasQrCode: !!configUpdate.whatsappQrCode,
        phoneNumber: configUpdate.whatsappQrPhoneNumber
      });
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