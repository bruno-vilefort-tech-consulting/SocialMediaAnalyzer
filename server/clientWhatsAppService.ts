import { storage } from './storage';
import fs from 'fs';
import path from 'path';

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
      }

      await this.ensureSessionDirectory(clientId);
      
      // Verificar se já existe sessão válida
      const sessionPath = this.getSessionPath(clientId);
      const fs = await import('fs');
      const credsPath = `${sessionPath}/creds.json`;
      
      if (fs.existsSync(credsPath)) {
        console.log(`📂 [${clientId}] Credenciais existentes encontradas - tentando restaurar sessão`);
        try {
          const credsContent = fs.readFileSync(credsPath, 'utf8');
          const creds = JSON.parse(credsContent);
          if (creds.me && creds.me.id) {
            console.log(`✅ [${clientId}] Credenciais válidas - tentando reconexão sem QR Code`);
          }
        } catch (parseError) {
          console.log(`⚠️ [${clientId}] Credenciais corrompidas - será necessário novo QR Code`);
          await this.clearClientSession(clientId);
        }
      }

      const { state, saveCreds } = await this.baileys.useMultiFileAuthState(this.getSessionPath(clientId));
      
      // Criar logger completamente silenciado
      const logger = {
        level: 'silent',
        child: () => logger,
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
        silent: () => {}
      };

      const socket = this.baileys.makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: logger,
        browser: ['Replit WhatsApp Bot', 'Chrome', '1.0.0'],
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 60000, // Aumentado para Replit
        qrTimeout: 120000,
        retryRequestDelayMs: 2000,
        maxMsgRetryCount: 5,
        syncFullHistory: false,
        fireInitQueries: true, // Mudado para true
        shouldIgnoreJid: (jid: string) => jid.includes('@newsletter'),
        emitOwnEvents: false,
        getMessage: async (key: any) => {
          return { conversation: 'Sistema de entrevistas ativo' };
        }
      });

      return new Promise((resolve) => {
        let resolved = false;
        
        // Timeout de segurança conforme documentação
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            console.log(`⏰ [${clientId}] Timeout na conexão WhatsApp (130s)`);
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
        }, 130000); // 2 minutos + 10 segundos de buffer

        socket.ev.on('connection.update', async (update: any) => {
          const { connection, lastDisconnect, qr } = update;
          
          console.log(`🔄 [${clientId}] Connection update:`, { connection, hasQR: !!qr });

          if (qr && !resolved) {
            console.log(`📱 NOVO QR CODE GERADO para cliente ${clientId}!`);
            console.log(`⏰ QR Code válido por 2 minutos - escaneie rapidamente!`);
            
            try {
              // Converter QR Code string para DataURL com configurações otimizadas
              const QRCode = await import('qrcode');
              const qrCodeDataUrl = await QRCode.toDataURL(qr, { 
                errorCorrectionLevel: 'M',
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                  dark: '#000000FF',
                  light: '#FFFFFFFF'
                },
                width: 400
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

              clearTimeout(timeoutId);
              resolved = true;
              resolve({
                success: true,
                qrCode: qrCodeDataUrl,
                message: 'QR Code gerado - escaneie em até 90 segundos (tempo estendido)'
              });
            } catch (error) {
              console.error(`❌ Erro ao converter QR Code para cliente ${clientId}:`, error);
              clearTimeout(timeoutId);
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

            if (!resolved) {
              clearTimeout(timeoutId);
              resolved = true;
              resolve({ 
                success: true, 
                message: `WhatsApp conectado com sucesso! Número: ${phoneNumber}` 
              });
            }
          }

          if (connection === 'close') {
            const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = reason !== 401 && reason !== 403;
            
            console.log(`🔌 [${clientId}] Conexão fechada - Código: ${reason}, Reconectar: ${shouldReconnect}`);
            
            // Atualizar status no banco apenas se não for reconectável
            if (!shouldReconnect) {
              await this.updateClientConfig(clientId, {
                isConnected: false,
                qrCode: null,
                phoneNumber: null
              });
              
              // Só limpar sessão em casos específicos (logout real)
              if (reason === 401) {
                console.log(`🧹 [${clientId}] Logout detectado - limpando credenciais`);
                try {
                  await this.clearClientSession(clientId);
                } catch (clearError) {
                  console.error(`❌ Erro ao limpar sessão: ${clearError}`);
                }
              }
              
              // Remove sessão da memória apenas se não reconectável
              this.sessions.delete(clientId);
            } else {
              console.log(`🔄 [${clientId}] Desconexão temporária - mantendo credenciais`);
              // Atualizar apenas status de conexão
              await this.updateClientConfig(clientId, {
                isConnected: false
              });
            }
            
            if (!resolved) {
              clearTimeout(timeoutId);
              resolved = true;
              resolve({ 
                success: false, 
                message: shouldReconnect 
                  ? 'Conexão perdida temporariamente - suas credenciais foram preservadas'
                  : 'Sessão expirada - será necessário escanear novo QR Code'
              });
            }
          }
        });

        socket.ev.on('creds.update', saveCreds);
        
        // Adicionar heartbeat para manter conexão viva
        const heartbeatInterval = setInterval(() => {
          if (socket.ws && socket.ws.readyState === 1) {
            socket.ws.ping();
          }
        }, 25000); // Ping a cada 25 segundos
        
        // Limpar heartbeat quando socket fechar
        socket.ev.on('connection.update', (update: any) => {
          if (update.connection === 'close') {
            clearInterval(heartbeatInterval);
          }
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
      console.log(`📱 [WHATSAPP TEST] Iniciando envio para cliente ${clientId}`);
      console.log(`📱 [WHATSAPP TEST] Telefone: ${phoneNumber}`);
      console.log(`📱 [WHATSAPP TEST] Mensagem: ${message.substring(0, 50)}...`);

      // Verificar status do banco
      const apiConfig = await storage.getApiConfig('client', clientId);
      const session = this.sessions.get(clientId);
      
      console.log(`📱 [WHATSAPP TEST] Status do WhatsApp para cliente ${clientId}:`, {
        isConnected: apiConfig?.whatsappQrConnected || false,
        qrCode: apiConfig?.whatsappQrCode ? 'exists' : null,
        phoneNumber: apiConfig?.whatsappQrPhoneNumber || null
      });
      
      console.log(`📱 [WHATSAPP TEST] Sessão em memória:`, {
        hasSession: !!session,
        hasSocket: !!session?.socket,
        configConnected: session?.config?.isConnected || false
      });

      // Se o banco indica conectado mas não há sessão, tentar restaurar
      if (apiConfig?.whatsappQrConnected && !session?.socket) {
        console.log(`🔄 [WHATSAPP TEST] Banco indica conectado mas sem sessão ativa. Tentando restaurar...`);
        try {
          await this.connectClient(clientId);
          // Aguardar um pouco para a sessão ser criada
          await new Promise(resolve => setTimeout(resolve, 2000));
          const newSession = this.sessions.get(clientId);
          
          if (newSession?.socket) {
            console.log(`✅ [WHATSAPP TEST] Sessão restaurada com sucesso`);
          } else {
            console.log(`❌ [WHATSAPP TEST] Falha ao restaurar sessão`);
            return {
              success: false,
              message: 'WhatsApp conectado no banco mas sessão indisponível. Tente reconectar.'
            };
          }
        } catch (restoreError) {
          console.error(`❌ [WHATSAPP TEST] Erro ao restaurar sessão:`, restoreError);
          return {
            success: false,
            message: 'Erro ao restaurar conexão WhatsApp. Tente reconectar.'
          };
        }
      }

      const finalSession = this.sessions.get(clientId);
      if (!finalSession?.socket) {
        console.log(`❌ [WHATSAPP TEST] Erro: Sem sessão ativa após tentativa de restauração`);
        return {
          success: false,
          message: 'WhatsApp não está conectado. Gere um novo QR Code para conectar.'
        };
      }

      if (!apiConfig?.whatsappQrConnected) {
        console.log(`❌ [WHATSAPP TEST] Erro: Status desconectado no banco`);
        return {
          success: false,
          message: 'WhatsApp não está conectado no sistema. Gere um novo QR Code.'
        };
      }

      // Formatar número para WhatsApp
      let formattedNumber = phoneNumber.replace(/\D/g, ''); // Remove caracteres não numéricos
      
      // Adicionar código do país se necessário
      if (!formattedNumber.startsWith('55')) {
        formattedNumber = '55' + formattedNumber;
      }
      
      // Adicionar sufixo WhatsApp
      if (!formattedNumber.includes('@')) {
        formattedNumber = formattedNumber + '@s.whatsapp.net';
      }
      
      console.log(`📤 [WHATSAPP TEST] Enviando para: ${formattedNumber}`);
      await finalSession.socket.sendMessage(formattedNumber, { text: message });
      
      console.log(`✅ [WHATSAPP TEST] Mensagem enviada com sucesso para ${phoneNumber}`);
      
      return {
        success: true,
        message: 'Mensagem enviada com sucesso'
      };
    } catch (error) {
      console.error(`❌ [WHATSAPP TEST] Erro ao enviar mensagem:`, error);
      return {
        success: false,
        message: `Erro ao enviar mensagem: ${error.message || 'Erro desconhecido'}`
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

  async clearClientSession(clientId: string): Promise<void> {
    try {
      // Remover sessão da memória
      this.sessions.delete(clientId);
      
      // Limpar diretório de sessão específico
      const sessionPath = this.getSessionPath(clientId);
      
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🗑️ Sessão do cliente ${clientId} limpa`);
      }
    } catch (error) {
      console.error(`❌ Erro ao limpar sessão do cliente ${clientId}:`, error);
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
    
    // Limpar diretórios de sessão no sistema de arquivos
    try {
      const sessionsDir = path.join(process.cwd(), 'whatsapp-sessions');
      
      if (fs.existsSync(sessionsDir)) {
        const files = fs.readdirSync(sessionsDir);
        
        for (const file of files) {
          const filePath = path.join(sessionsDir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        }
        
        console.log('🧹 Todas as sessões WhatsApp foram limpas');
      }
    } catch (error) {
      console.error('❌ Erro ao limpar sessões:', error);
    }
  }
}

// Instância singleton
export const clientWhatsAppService = new ClientWhatsAppService();