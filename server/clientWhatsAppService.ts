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
      
      // Criar logger compatível com Baileys
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

      const socket = this.baileys.makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: logger,
        browser: ['WhatsApp Business', 'Chrome', '118.0.0.0'],
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        defaultQueryTimeoutMs: 45000,
        connectTimeoutMs: 45000,
        keepAliveIntervalMs: 30000,
        qrTimeout: 90000,
        retryRequestDelayMs: 500,
        maxMsgRetryCount: 7,
        syncFullHistory: false,
        fireInitQueries: true,
        shouldIgnoreJid: (jid: string) => jid.includes('@newsletter'),
        emitOwnEvents: false,
        getMessage: async (key: any) => {
          return { conversation: 'Hi' };
        }
      });

      return new Promise((resolve) => {
        let resolved = false;

        socket.ev.on('connection.update', async (update: any) => {
          const { connection, lastDisconnect, qr } = update;
          
          console.log(`🔄 [${clientId}] Connection update:`, { connection, hasQR: !!qr });

          if (qr && !resolved) {
            console.log(`📱 QR Code gerado para cliente ${clientId}`);
            console.log(`🕐 QR Code válido por 90 segundos - tempo estendido`);
            console.log(`📱 Dica: Abra WhatsApp > Menu (3 pontos) > Dispositivos conectados > Conectar dispositivo`);
            console.log(`📱 IMPORTANTE: Escaneie o QR Code para conectar seu WhatsApp ao sistema`);
            
            try {
              // Converter QR Code string para DataURL
              const QRCode = await import('qrcode');
              const qrCodeDataUrl = await QRCode.toDataURL(qr, { 
                width: 400, 
                margin: 2,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF'
                }
              });
              console.log(`🖼️ QR Code convertido para DataURL, length: ${qrCodeDataUrl.length}`);
              
              // Atualizar configuração do cliente com DataURL
              await this.updateClientConfig(clientId, {
                qrCode: qrCodeDataUrl,
                isConnected: false,
                phoneNumber: null,
                lastConnection: new Date(),
                clientId
              });

              resolved = true;
              resolve({
                success: true,
                qrCode: qrCodeDataUrl,
                message: 'QR Code gerado - escaneie em até 90 segundos (tempo estendido)'
              });
            } catch (error) {
              console.error(`❌ Erro ao converter QR Code para cliente ${clientId}:`, error);
              resolved = true;
              resolve({
                success: false,
                message: 'Erro ao gerar QR Code'
              });
            }
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
            const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
            console.log(`❌ [${clientId}] Conexão fechada - Código: ${reason}, Reconectar: ${shouldReconnect}`);
            
            if (reason === 408 || reason === 440) {
              console.log(`⏰ [${clientId}] Timeout detectado - QR Code expirou`);
              await this.updateClientConfig(clientId, {
                isConnected: false,
                qrCode: null,
                phoneNumber: null,
                lastConnection: new Date(),
                clientId
              });
            } else if (!shouldReconnect) {
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

        // Timeout estendido para QR Code - 90 segundos
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            console.log(`⏰ [${clientId}] Timeout na conexão WhatsApp (90s)`);
            resolved = true;
            try {
              socket?.end();
            } catch (e) {
              console.log('Socket já fechado');
            }
            resolve({
              success: false,
              message: 'Timeout - QR Code não foi escaneado a tempo. Tente novamente.'
            });
          }
        }, 90000);
        
        // Limpar timeout se resolver antes
        socket.ev.on('connection.update', () => {
          if (resolved) clearTimeout(timeoutId);
        });
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
      
      console.log(`📊 Status DB para cliente ${clientId}:`, {
        hasConfig: !!apiConfig,
        isConnected: apiConfig?.whatsappQrConnected || false,
        hasQrCode: !!apiConfig?.whatsappQrCode,
        qrCodeLength: apiConfig?.whatsappQrCode ? apiConfig.whatsappQrCode.length : 0,
        phoneNumber: apiConfig?.whatsappQrPhoneNumber || null
      });
      
      return {
        isConnected: apiConfig?.whatsappQrConnected || false,
        qrCode: apiConfig?.whatsappQrCode || null, // Retornar QR Code do banco se existir
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

      // Preparar dados para atualização
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

      // Adicionar QR Code se fornecido
      if (updates.qrCode !== undefined) {
        configUpdate.whatsappQrCode = updates.qrCode;
        console.log(`📱 Salvando QR Code para cliente ${clientId}, tamanho: ${updates.qrCode ? updates.qrCode.length : 0}`);
      }

      await storage.upsertApiConfig(configUpdate);

      console.log(`💾 Configuração WhatsApp atualizada para cliente ${clientId}`, {
        isConnected: configUpdate.whatsappQrConnected,
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
  }
}

// Instância singleton
export const clientWhatsAppService = new ClientWhatsAppService();