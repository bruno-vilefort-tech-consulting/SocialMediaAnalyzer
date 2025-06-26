import { storage } from '../../server/storage';
import fs from 'fs';
import path from 'path';
// Tentativa de múltiplas estratégias de importação para debug
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from '@whiskeysockets/baileys';

// Debug adicional - tentar importar de formas diferentes
let debugMakeWASocket: any;
let debugBaileys: any;

// Estratégia 1: Dynamic import para debug
const testDynamicImport = async () => {
  try {
    const baileysDynamic = await import('@whiskeysockets/baileys');
    console.log('🔍 [DEBUG] Dynamic import baileys:', Object.keys(baileysDynamic));
    console.log('🔍 [DEBUG] Dynamic default:', typeof baileysDynamic.default);
    debugBaileys = baileysDynamic;
    debugMakeWASocket = baileysDynamic.default;
  } catch (err) {
    console.error('❌ [DEBUG] Erro dynamic import:', err);
  }
};

// Estratégia 2: Require como fallback
try {
  const baileysCjs = require('@whiskeysockets/baileys');
  console.log('🔍 [DEBUG] Require baileys keys:', Object.keys(baileysCjs));
  console.log('🔍 [DEBUG] Require default type:', typeof baileysCjs.default);
  if (!debugMakeWASocket && baileysCjs.default) {
    debugMakeWASocket = baileysCjs.default;
    console.log('🔧 [DEBUG] Usando makeWASocket do require');
  }
} catch (err) {
  console.error('❌ [DEBUG] Erro require:', err);
}
import QRCode from 'qrcode';

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

  constructor() {
    // Não mais necessário - usando importações estáticas diretas
  }

  private getSessionPath(clientId: string): string {
    return path.join(process.cwd(), 'whatsapp/sessions/whatsapp-sessions', `client_${clientId}`);
  }

  private async ensureSessionDirectory(clientId: string) {
    const sessionPath = this.getSessionPath(clientId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
  }

  async connectClient(clientId: string): Promise<{ success: boolean; qrCode?: string; message: string }> {
    try {
      console.log(`🔗 [BAILEYS] Iniciando conexão REAL WhatsApp para cliente ${clientId}...`);
      
      // Testar imports dinâmicos primeiro para debug
      console.log('🔍 [DEBUG] Executando testDynamicImport...');
      await testDynamicImport();
      console.log('🔍 [DEBUG] testDynamicImport concluído');
      
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

      const { state, saveCreds } = await useMultiFileAuthState(this.getSessionPath(clientId));
      
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

      // Garantir que temos uma versão válida antes de criar o socket
      if (!this.waVersion || !Array.isArray(this.waVersion)) {
        console.log('⚠️ Versão inválida detectada, forçando fallback...');
        this.waVersion = [2, 3000, 1014398374]; // Versão recente compatível
      }

      console.log('🔧 Criando socket com versão:', this.waVersion);

      console.log('🔧 [DEBUG] Configurações do socket:', {
        version: this.waVersion,
        browser: ['Samsung', 'SM-G991B', '13'],
        // mobile: true, // REMOVIDO: API móvel não é mais suportada no Baileys
        connectTimeoutMs: 60000,
        qrTimeout: 90000
      });

      // Obter versão do WhatsApp Web com fallback
      let version: number[];
      try {
        const { version: v } = await fetchLatestBaileysVersion();
        version = v;
        console.log('🌐 WA Web version obtida:', version);
      } catch (versionError) {
        version = [2, 2419, 6];
        console.log('🔄 Usando versão fallback:', version);
      }

      // Debug detalhado da função makeWASocket
      console.log('🔍 [DEBUG] Verificando makeWASocket...');
      console.log('🔍 [DEBUG] Tipo de makeWASocket:', typeof makeWASocket);
      console.log('🔍 [DEBUG] makeWASocket é função?', typeof makeWASocket === 'function');
      console.log('🔍 [DEBUG] makeWASocket content:', makeWASocket);
      
      // Tentar usar debugMakeWASocket se makeWASocket não funcionar
      let finalMakeWASocket = makeWASocket;
      if (typeof makeWASocket !== 'function') {
        console.log('🔧 [DEBUG] Tentando usar debugMakeWASocket...');
        console.log('🔍 [DEBUG] Tipo de debugMakeWASocket:', typeof debugMakeWASocket);
        if (typeof debugMakeWASocket === 'function') {
          finalMakeWASocket = debugMakeWASocket;
          console.log('✅ [DEBUG] Usando debugMakeWASocket como fallback');
        } else {
          console.error('❌ [DEBUG] Nenhuma função makeWASocket disponível!');
          console.log('🔍 [DEBUG] debugBaileys:', debugBaileys ? Object.keys(debugBaileys) : 'undefined');
          throw new Error('makeWASocket não é uma função - problema de importação Baileys');
        }
      }

      const socket = finalMakeWASocket({
        version,
        auth: state,
        logger: logger,
        // Configuração desktop browser para WhatsApp Web
        browser: ['Replit WhatsApp Bot', 'Chrome', '120.0.0.0'],
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        
        // Timeouts ajustados para ambiente Replit
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        qrTimeout: 90000,
        
        // Keep-alive agressivo para manter conexão
        keepAliveIntervalMs: 10000,
        networkIdleTimeoutMs: 60000,
        
        retryRequestDelayMs: 3000,
        maxMsgRetryCount: 3,
        syncFullHistory: false,              // CRÍTICO: evita frames grandes
        fireInitQueries: true,
        shouldIgnoreJid: (jid: string) => jid.includes('@newsletter'),
        emitOwnEvents: false,
        
        // Configurações adicionais para estabilidade Replit
        msgRetryCountMap: {},
        shouldSyncHistoryMessage: () => false,
        getMessage: async () => undefined
      });
      
      console.log('✅ [DEBUG] Socket criado com sucesso');

      return new Promise((resolve) => {
        let resolved = false;
        
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.log(`⏰ [DEBUG] Timeout de QR Code (90s) para cliente ${clientId}`);
            
            try {
              socket?.end();
            } catch (e) {
              console.log('🔌 [DEBUG] Socket já fechado durante timeout');
            }
            
            resolve({
              success: false,
              message: 'Timeout: QR Code não foi escaneado em 90 segundos'
            });
          }
        }, 90000); // 90 segundos (match com qrTimeout)

        socket.ev.on('connection.update', async (update: any) => {
          const { connection, lastDisconnect, qr } = update;
          
          console.log(`🔄 [DEBUG] CONNECTION UPDATE:`, {
            connection,
            hasQR: !!qr,
            hasDisconnect: !!lastDisconnect,
            resolved,
            timestamp: new Date().toISOString()
          });

          if (qr && !resolved) {
            console.log(`📱 [DEBUG] QR CODE recebido para cliente ${clientId}`);
            console.log(`📱 [DEBUG] QR String length: ${qr.length}`);
            console.log(`📱 [DEBUG] QR válido: ${qr.includes('@')}`);
            
            try {
              const QRCode = await import('qrcode');
              const qrDataURL = await QRCode.toDataURL(qr, {
                errorCorrectionLevel: 'M',
                margin: 1,
                width: 300
              });
              
              console.log(`✅ [DEBUG] QR DataURL gerado: ${qrDataURL.length} chars`);
              
              // Salvar no Firebase
              console.log(`💾 [DEBUG] Salvando QR no Firebase...`);
              await this.updateClientConfig(clientId, {
                qrCode: qrDataURL,
                isConnected: false,
                lastConnection: null
              });
              console.log(`✅ [DEBUG] QR salvo no Firebase com sucesso`);

              resolved = true;
              clearTimeout(timeoutId);
              resolve({
                success: true,
                qrCode: qrDataURL,
                message: 'QR Code gerado com sucesso'
              });
            } catch (qrError) {
              console.error(`❌ [DEBUG] Erro ao gerar QR:`, qrError);
              if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                resolve({
                  success: false,
                  message: 'Erro ao gerar QR Code'
                });
              }
            }
          }

          if (connection === 'open') {
            console.log(`🎉 [BAILEYS] WhatsApp CONECTADO com sucesso para cliente ${clientId}!`);
            console.log(`📱 [BAILEYS] Socket user data:`, socket.user);
            
            // Enviar presença para confirmar conexão ativa
            try {
              await socket.sendPresenceUpdate('available');
              console.log(`✅ [BAILEYS] Presença 'available' enviada`);
            } catch (presenceError) {
              console.warn(`⚠️ [BAILEYS] Erro ao enviar presença:`, presenceError);
            }
            
            const phoneNumber = socket.user?.id?.split(':')[0] || null;
            console.log(`📞 [BAILEYS] Número do telefone extraído:`, phoneNumber);
            
            await this.updateClientConfig(clientId, {
              isConnected: true,
              phoneNumber,
              lastConnection: new Date(),
              qrCode: null,
              clientId
            });
            
            console.log(`💾 [BAILEYS] Configuração atualizada - Cliente conectado!`);

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
              makeWASocket,
              useMultiFileAuthState
            };

            this.sessions.set(clientId, session);
            console.log(`📝 [DEBUG] Sessão ativa criada para cliente ${clientId}`);

            resolved = true;
            clearTimeout(timeoutId);
            resolve({ 
              success: true, 
              message: `WhatsApp conectado! Número: ${phoneNumber}` 
            });
          }

          if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ [DEBUG] Conexão fechada - código: ${statusCode}`);
            console.log(`❌ [DEBUG] Erro: ${lastDisconnect?.error?.message}`);
            
            // Tratamento específico para erro 515 pós-login
            if (statusCode === 515) {
              console.log(`🔄 [515 FIX] Erro 515 detectado - aplicando correção específica Replit`);
              
              // Para erro 515, limpar sessão e tentar reconectar imediatamente
              if (!resolved) {
                console.log(`🔄 [515 FIX] Limpando sessão e reconectando...`);
                await this.clearClientSession(clientId);
                
                // Reconectar após 5 segundos
                setTimeout(() => {
                  if (!resolved) {
                    console.log(`🔄 [515 FIX] Iniciando reconexão pós erro 515`);
                    this.connectClient(clientId);
                  }
                }, 5000);
                return;
              }
            }
            
            // Atualizar status no Firebase
            console.log(`💾 [DEBUG] Atualizando status desconectado no Firebase...`);
            await this.updateClientConfig(clientId, {
              isConnected: false,
              qrCode: null,
              lastConnection: new Date()
            });
            console.log(`✅ [DEBUG] Status desconectado salvo no Firebase`);
            
            // Auto-reconexão para erros de rede (exceto 515)
            if ([428, 408].includes(statusCode) && !resolved) {
              console.log(`🔄 [DEBUG] Erro ${statusCode} - reconectando em 5s...`);
              setTimeout(async () => {
                await this.clearClientSession(clientId);
                this.connectClient(clientId);
              }, 5000);
            }
            
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              resolve({
                success: false,
                message: `Conexão fechada: ${lastDisconnect?.error?.message || 'Erro desconhecido'}`
              });
            }
          }
        });

        // Salvar credenciais imediatamente a cada atualização
        socket.ev.on('creds.update', async (creds) => {
          console.log(`🔐 [BAILEYS] CREDENCIAIS ATUALIZADAS para cliente ${clientId}!`);
          console.log(`🔐 [BAILEYS] Tipo de credenciais:`, Object.keys(creds || {}));
          console.log(`🔐 [BAILEYS] Promise resolvida:`, resolved);
          
          try {
            await saveCreds();
            console.log(`✅ [BAILEYS] Credenciais salvas imediatamente`);
          } catch (saveError) {
            console.error(`❌ [BAILEYS] ERRO CRÍTICO ao salvar credenciais:`, saveError);
            // Tentar salvar novamente após delay
            setTimeout(async () => {
              try {
                await saveCreds();
                console.log(`✅ [BAILEYS] Credenciais salvas na segunda tentativa`);
              } catch (retryError) {
                console.error(`❌ [BAILEYS] Falha definitiva ao salvar:`, retryError);
              }
            }, 1000);
          }
        });

        // Event listener adicional para debug completo
        socket.ev.on('connection.update', (update) => {
          console.log(`🐛 [BAILEYS] EVENT LISTENER ADICIONAL:`, JSON.stringify(update, null, 2));
        });
        
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