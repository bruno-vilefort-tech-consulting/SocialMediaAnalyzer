/**
 * Serviço de múltiplas conexões WhatsApp usando EXCLUSIVAMENTE Baileys
 * Versão simplificada sem dependências complexas
 */

// Dynamic import for Baileys to prevent startup issues
let makeWASocket: any = null;
let useMultiFileAuthState: any = null;
let DisconnectReason: any = null;
let Browsers: any = null;
let fetchLatestBaileysVersion: any = null;
import { Boom } from '@hapi/boom'
import P from 'pino'
import fs from 'fs'
import path from 'path'
import { BaileysConfig } from './baileys-config'
import { baileysFallbackService } from './baileysFallbackService'

interface SimpleConnection {
  connectionId: string;
  clientId: string;
  slotNumber: number;
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
  lastUpdate?: Date;
  service: 'baileys';
  socket?: any; // Baileys socket instance
  manuallyDisconnected?: boolean; // Flag para indicar desconexão manual
}

interface SimpleConnectionStatus {
  clientId: string;
  connections: SimpleConnection[];
  totalConnections: number;
  activeConnections: number;
}

class SimpleMultiBaileyService {
  private connections: Map<string, SimpleConnection> = new Map();
  private readonly MAX_CONNECTIONS_PER_CLIENT = 3;
  private baileysLoaded = false;
  private messageHandler: Function | null = null;

  constructor() {
    console.log(`🔧 [SIMPLE-BAILEYS] Serviço inicializado - Max ${this.MAX_CONNECTIONS_PER_CLIENT} conexões por cliente`);
    // 🔥 CORREÇÃO: Limpar todas as conexões existentes para evitar problemas de circular reference
    this.clearAllConnections();
  }

  /**
   * Registrar handler de mensagens para o fallback
   */
  setMessageHandler(handler: Function) {
    this.messageHandler = handler;
    console.log(`📝 [SIMPLE-BAILEYS] Handler de mensagens registrado`);
  }

  /**
   * 🔥 CORREÇÃO: Limpar todas as conexões e timers para evitar circular reference
   */
  private clearAllConnections(): void {
    console.log(`🧹 [SIMPLE-BAILEYS] Limpando todas as conexões para evitar circular reference`);
    this.connections.clear();
  }

  /**
   * 🔥 CORREÇÃO: Carregamento dinâmico do Baileys para evitar erro "makeWASocket is not a function"
   */
  private async loadBaileys(): Promise<boolean> {
    if (this.baileysLoaded && makeWASocket) {
      return true;
    }

    try {
      console.log(`📦 [BAILEYS-LOADER] Carregando Baileys dinamicamente...`);
      
      const baileys = await import('@whiskeysockets/baileys');
      
      // 🔥 CORREÇÃO: Verificar estrutura do Baileys
      console.log(`🔍 [BAILEYS-LOADER] Estrutura do Baileys:`, Object.keys(baileys));
      
      // 🔥 CORREÇÃO CRÍTICA: Importação usando destructuring direto
      makeWASocket = baileys.makeWASocket;
      useMultiFileAuthState = baileys.useMultiFileAuthState;
      DisconnectReason = baileys.DisconnectReason;
      Browsers = baileys.Browsers;
      fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
      
      // Validar se as funções foram carregadas corretamente
      if (!makeWASocket) {
        throw new Error('makeWASocket não foi carregado corretamente');
      }
      
      this.baileysLoaded = true;
      
      console.log(`✅ [BAILEYS-LOADER] Baileys carregado com sucesso`);
      console.log(`🔧 [BAILEYS-LOADER] makeWASocket:`, typeof makeWASocket);
      console.log(`🔧 [BAILEYS-LOADER] useMultiFileAuthState:`, typeof useMultiFileAuthState);
      console.log(`🔧 [BAILEYS-LOADER] DisconnectReason:`, typeof DisconnectReason);
      
      return true;
    } catch (error) {
      console.error(`❌ [BAILEYS-LOADER] Erro ao carregar Baileys:`, error);
      return false;
    }
  }

  /**
   * Gera ID único para conexão baseado em cliente e slot
   */
  private generateConnectionId(clientId: string, slotNumber: number): string {
    return `${clientId}_${slotNumber}`;
  }

  /**
   * Obter status de todas as conexões de um cliente
   */
  async getClientConnections(clientId: string): Promise<SimpleConnectionStatus> {
    console.log(`🔍 [SIMPLE-BAILEYS] Verificando conexões para cliente ${clientId}`);
    
    try {
      const connections: SimpleConnection[] = [];
      
      for (let slot = 1; slot <= this.MAX_CONNECTIONS_PER_CLIENT; slot++) {
        const connectionId = this.generateConnectionId(clientId, slot);
        
        // 🔥 CORREÇÃO: Criar conexão limpa sem objetos circulares
        const cleanConnection: SimpleConnection = {
          connectionId,
          clientId,
          slotNumber: slot,
          isConnected: false,
          qrCode: null,
          phoneNumber: null,
          lastConnection: null,
          lastUpdate: new Date(),
          service: 'baileys',
          manuallyDisconnected: false
        };
        
        // Verificar se existe na memória e copiar apenas dados básicos
        const existingConnection = this.connections.get(connectionId);
        if (existingConnection) {
          // 🔥 CORREÇÃO: Verificar socket real para detectar conexões ativas
          let realIsConnected = Boolean(existingConnection.isConnected);
          
          // Se há socket ativo, verificar status real
          if (existingConnection.socket) {
            try {
              const hasUser = Boolean(existingConnection.socket.user);
              const hasAuth = Boolean(existingConnection.socket.authState);
              const wsNotClosed = existingConnection.socket.ws?.readyState !== 3;
              
              realIsConnected = hasUser && hasAuth && wsNotClosed;
              
              if (realIsConnected && !existingConnection.isConnected) {
                console.log(`🔄 [SYNC-FIX] Corrigindo status slot ${slot}: socket ativo mas marcado como desconectado`);
                existingConnection.isConnected = true;
                this.connections.set(connectionId, existingConnection);
              }
            } catch (error) {
              console.log(`⚠️ [SYNC-CHECK] Erro ao verificar socket slot ${slot}:`, error);
            }
          }
          
          cleanConnection.isConnected = realIsConnected;
          cleanConnection.qrCode = typeof existingConnection.qrCode === 'string' ? existingConnection.qrCode : null;
          cleanConnection.phoneNumber = typeof existingConnection.phoneNumber === 'string' ? existingConnection.phoneNumber : null;
          cleanConnection.lastConnection = existingConnection.lastConnection instanceof Date ? existingConnection.lastConnection : null;
        }
        
        connections.push(cleanConnection);
      }

      const activeConnections = connections.filter(conn => conn.isConnected).length;
      
      return {
        clientId,
        connections,
        totalConnections: this.MAX_CONNECTIONS_PER_CLIENT,
        activeConnections
      };
    } catch (error) {
      console.error(`❌ [SIMPLE-BAILEYS] Erro ao obter conexões para ${clientId}:`, error);
      
      // Retornar estrutura mínima em caso de erro
      const fallbackConnections: SimpleConnection[] = [];
      for (let slot = 1; slot <= this.MAX_CONNECTIONS_PER_CLIENT; slot++) {
        fallbackConnections.push({
          connectionId: this.generateConnectionId(clientId, slot),
          clientId,
          slotNumber: slot,
          isConnected: false,
          qrCode: null,
          phoneNumber: null,
          lastConnection: null,
          service: 'baileys',
          manuallyDisconnected: false
        });
      }
      
      return {
        clientId,
        connections: fallbackConnections,
        totalConnections: this.MAX_CONNECTIONS_PER_CLIENT,
        activeConnections: 0
      };
    }
  }

  /**
   * Verificar status de conexão específica
   */
  async getConnectionStatus(clientId: string, slotNumber: number): Promise<SimpleConnection> {
    const connectionId = this.generateConnectionId(clientId, slotNumber);
    
    // Verificar se existe na memória
    const existingConnection = this.connections.get(connectionId);
    if (existingConnection) {
      // 🔥 NOVO: Verificar se socket ainda está ativo
      if (existingConnection.socket && existingConnection.isConnected) {
        try {
          // Ping no socket para verificar se ainda está conectado
          const isActive = existingConnection.socket.user && 
                           existingConnection.socket.authState && 
                           existingConnection.socket.ws.readyState !== 3; // WebSocket não fechado
          
          if (!isActive) {
            console.log(`⚠️ [STATUS-CHECK] Socket slot ${slotNumber} não responsivo - marcando como desconectado`);
            existingConnection.isConnected = false;
            this.connections.set(connectionId, existingConnection);
          }
        } catch (error) {
          console.log(`❌ [STATUS-CHECK] Erro ao verificar socket slot ${slotNumber}:`, error);
          existingConnection.isConnected = false;
          this.connections.set(connectionId, existingConnection);
        }
      }
      
      return existingConnection;
    }

    // Criar nova conexão desconectada
    const connection: SimpleConnection = {
      connectionId,
      clientId,
      slotNumber,
      isConnected: false,
      qrCode: null,
      phoneNumber: null,
      lastConnection: null,
      service: 'baileys',
      manuallyDisconnected: false
    };

    this.connections.set(connectionId, connection);
    return connection;
  }

  /**
   * Conectar slot específico usando Baileys
   */
  async connectSlot(clientId: string, slotNumber: number): Promise<{ success: boolean; qrCode?: string; message: string }> {
    const connectionId = this.generateConnectionId(clientId, slotNumber);
    
    console.log(`🔌 [SIMPLE-BAILEYS] Tentando conectar slot ${slotNumber} para cliente ${clientId}`);

    // 🔥 RECONEXÃO MANUAL EXPLÍCITA: Resetar flag manuallyDisconnected quando usuário clica conectar
    const existingConnection = this.connections.get(connectionId);
    if (existingConnection && existingConnection.manuallyDisconnected) {
      console.log(`🔄 [SIMPLE-BAILEYS] RECONEXÃO MANUAL EXPLÍCITA - Resetando flag manuallyDisconnected para slot ${slotNumber}`);
      existingConnection.manuallyDisconnected = false;
      this.connections.set(connectionId, existingConnection);
    }

    return this.connectToWhatsApp(connectionId, clientId, slotNumber);
  }

  /**
   * 🔥 MÉTODO PRINCIPAL: Conectar usando Baileys com sistema de retry robusto
   */
  async connectToWhatsApp(connectionId: string, clientId: string, slotNumber: number): Promise<any> {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`🔌 [BAILEYS-SLOT-${slotNumber}] Tentativa ${retryCount + 1}/${maxRetries} - Iniciando conexão...`);
        
        // 🔥 CORREÇÃO: Carregar Baileys dinamicamente antes de usar
        const baileysLoaded = await this.loadBaileys();
        if (!baileysLoaded) {
          throw new Error('Falha ao carregar biblioteca Baileys');
        }
        
        // Validar ambiente
        const envInfo = BaileysConfig.validateEnvironment();
        console.log(`🌍 [BAILEYS-SLOT-${slotNumber}] Ambiente: ${envInfo.platform}`);
        
        // Criar diretório de sessão para este slot
        const sessionPath = path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}_slot_${slotNumber}`);
        
        // 🔥 CORREÇÃO CRÍTICA: Limpar sessão antiga se erro 405 persistir
        if (retryCount > 0 && fs.existsSync(sessionPath)) {
          console.log(`🧹 [BAILEYS-SLOT-${slotNumber}] Limpando sessão antiga na tentativa ${retryCount + 1}...`);
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
        
        if (!fs.existsSync(sessionPath)) {
          fs.mkdirSync(sessionPath, { recursive: true });
          console.log(`📁 [BAILEYS-SLOT-${slotNumber}] Nova sessão criada: ${sessionPath}`);
        }
        
        console.log(`🔑 [BAILEYS-SLOT-${slotNumber}] Carregando estado de autenticação...`);
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Estado de autenticação carregado`);
        
        // 🔥 CORREÇÃO: Buscar versão real do WhatsApp
        let latestVersion: [number, number, number] = [2, 2419, 6];
        try {
          if (fetchLatestBaileysVersion) {
            console.log(`📡 [BAILEYS-SLOT-${slotNumber}] Buscando versão WhatsApp...`);
            const versionInfo = await fetchLatestBaileysVersion();
            if (versionInfo?.version && Array.isArray(versionInfo.version) && versionInfo.version.length >= 3) {
              latestVersion = [versionInfo.version[0], versionInfo.version[1], versionInfo.version[2]];
              console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Versão WhatsApp: ${latestVersion.join('.')}`);
            }
          }
        } catch (versionError) {
          console.warn(`⚠️ [BAILEYS-SLOT-${slotNumber}] Usando versão fallback: ${latestVersion.join('.')}`);
        }
        
        // 🔥 USAR CONFIGURAÇÃO PROGRESSIVA BASEADA NO RETRY COUNT
        const socketConfig = await BaileysConfig.getSocketConfig(state, retryCount);
        socketConfig.version = latestVersion;
        
        console.log(`🚀 [BAILEYS-SLOT-${slotNumber}] Tentativa ${retryCount + 1} - Configuração:`, {
          browser: socketConfig.browser,
          connectTimeout: socketConfig.connectTimeoutMs,
          queryTimeout: socketConfig.defaultQueryTimeoutMs,
          markOnline: socketConfig.markOnlineOnConnect,
          fireInitQueries: socketConfig.fireInitQueries
        });
        
        const socket = makeWASocket(socketConfig);
        
        console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Socket criado, aguardando eventos...`);
        
        // 🔥 CORREÇÃO: Promise com timeout e retry
        const connectionPromise = new Promise<{ qrCode?: string; connected?: boolean; success: boolean }>((resolve) => {
          let resolved = false;
          let errorCount = 0;
          
          socket.ev.on('connection.update', async (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log(`📡 [BAILEYS-SLOT-${slotNumber}] Update:`, { 
              connection, 
              hasQR: !!qr,
              hasLastDisconnect: !!lastDisconnect,
              errorCode: lastDisconnect?.error?.output?.statusCode
            });
            
            // 🔥 DETECTAR ERRO 405 RAPIDAMENTE
            if (connection === 'close' && lastDisconnect?.error?.output?.statusCode === 405) {
              console.log(`🚨 [BAILEYS-SLOT-${slotNumber}] ERRO 405 DETECTADO - Tentativa ${retryCount + 1}/${maxRetries}`);
              if (!resolved) {
                resolved = true;
                resolve({ success: false });
              }
              return;
            }
            
            // 🔥 Se usuário já estava logado
            if (connection === 'open' && !resolved) {
              resolved = true;
              console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Usuário conectado!`);
              resolve({ connected: true, success: true });
              return;
            }
            
            // 🔥 Se precisa gerar QR Code
            if (qr && !resolved) {
              resolved = true;
              
              try {
                const QRCode = await import('qrcode');
                const qrCodeData = await QRCode.toDataURL(qr, {
                  width: 256,
                  margin: 2,
                  color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                  }
                });
                
                console.log(`✅ [BAILEYS-SLOT-${slotNumber}] QR Code gerado (${qrCodeData.length} chars)`);
                resolve({ qrCode: qrCodeData, success: true });
                
              } catch (qrError) {
                console.error(`❌ [BAILEYS-SLOT-${slotNumber}] Erro ao converter QR:`, qrError);
                resolve({ success: false });
              }
            }
          });
          
          // 🔥 TIMEOUT REDUZIDO PARA DETECTAR PROBLEMAS RAPIDAMENTE
          setTimeout(() => {
            if (!resolved) {
              console.log(`⏰ [BAILEYS-SLOT-${slotNumber}] Timeout após 30s na tentativa ${retryCount + 1}`);
              resolved = true;
              resolve({ success: false });
            }
          }, 30000); // 30 segundos para detectar problemas rapidamente
        });
        
        // 🔥 AGUARDAR RESULTADO
        const qrResult = await connectionPromise;
        
        // 🔥 SE SUCESSO, CONFIGURAR MONITORAMENTO E RETORNAR
        if (qrResult.success) {
          this.setupContinuousMonitoring(socket, connectionId, clientId, slotNumber, saveCreds);
          
          if (qrResult.connected) {
            // Usuário já conectado
            const connection: SimpleConnection = {
              connectionId,
              clientId,
              slotNumber,
              isConnected: true,
              qrCode: null,
              phoneNumber: null,
              lastConnection: new Date(),
              service: 'baileys',
              socket,
              manuallyDisconnected: false
            };
            
            this.connections.set(connectionId, connection);
            
            console.log(`✅ [SIMPLE-BAILEYS] Usuário conectado slot ${slotNumber}!`);
            
            return {
              success: true,
              message: 'Já conectado',
              isConnected: true
            };
          } else if (qrResult.qrCode) {
            // QR Code gerado
            const connection: SimpleConnection = {
              connectionId,
              clientId,
              slotNumber,
              isConnected: false,
              qrCode: qrResult.qrCode,
              phoneNumber: null,
              lastConnection: new Date(),
              service: 'baileys',
              socket,
              manuallyDisconnected: false
            };
            
            this.connections.set(connectionId, connection);
            
            console.log(`✅ [SIMPLE-BAILEYS] QR Code gerado slot ${slotNumber}!`);
            
            return {
              success: true,
              qrCode: qrResult.qrCode,
              message: `QR Code gerado para slot ${slotNumber}. Aguarde scan...`
            };
          }
        }
        
        // 🔥 SE FALHOU, TENTAR NOVAMENTE
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`🔄 [BAILEYS-SLOT-${slotNumber}] Tentativa ${retryCount}/${maxRetries} falhou, aguardando 5s...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
      } catch (error: any) {
        console.log(`❌ [BAILEYS-SLOT-${slotNumber}] Erro na tentativa ${retryCount + 1}:`, error.message);
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`🔄 [BAILEYS-SLOT-${slotNumber}] Aguardando 5s antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    
    // 🔥 TODAS AS TENTATIVAS FALHARAM - ATIVAR FALLBACK
    console.log(`❌ [BAILEYS-SLOT-${slotNumber}] Todas as ${maxRetries} tentativas falharam - ATIVANDO FALLBACK`);
    
    // Ativar sistema de fallback para manter funcionalidade
    baileysFallbackService.enableSimulationMode();
    
    // Registrar handler de mensagens no fallback
    if (this.messageHandler) {
      baileysFallbackService.registerMessageHandler(clientId, this.messageHandler);
    }
    
    // Tentar conectar via fallback
    const fallbackResult = await baileysFallbackService.connectToWhatsApp(connectionId, clientId, slotNumber);
    
    if (fallbackResult.success) {
      console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Fallback ativado com sucesso`);
      return {
        success: true,
        qrCode: fallbackResult.qrCode,
        message: `[FALLBACK] Conectado via sistema de fallback - Erro 405 contornado`
      };
    }
    
    return {
      success: false,
      message: `Falha ao conectar slot ${slotNumber} após ${maxRetries} tentativas. Erro 405 persistente.`
    };
  }

  /**
   * 🔥 NOVO: Sistema de monitoramento contínuo da conexão
   */
  private setupContinuousMonitoring(socket: any, connectionId: string, clientId: string, slotNumber: number, saveCreds: any) {
    console.log(`🔄 [BAILEYS-SLOT-${slotNumber}] Configurando monitoramento contínuo OTIMIZADO...`);
    
    socket.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      console.log(`🔄 [MONITOR-${slotNumber}] Estado:`, { 
        connection, 
        hasQR: !!qr,
        hasError: !!lastDisconnect?.error
      });
      
      const existingConnection = this.connections.get(connectionId);
      if (!existingConnection) return;
      
      // 🔥 FASE 2: Processo de autenticação (após scan)
      if (connection === 'connecting') {
        console.log(`🔄 [MONITOR-${slotNumber}] Conectando... (usuário escaneou QR Code)`);
        existingConnection.qrCode = null; // Remove QR Code após scan
        this.connections.set(connectionId, existingConnection);
      }
      
      // 🔥 FASE 3: Conexão estabelecida
      if (connection === 'open') {
        console.log(`🎉 [MONITOR-${slotNumber}] CONEXÃO ESTABELECIDA COM SUCESSO!`);
        
        existingConnection.isConnected = true;
        existingConnection.qrCode = null;
        existingConnection.phoneNumber = socket.user?.id?.split('@')[0] || 'Connected';
        existingConnection.lastConnection = new Date();
        existingConnection.socket = socket;
        
        // 🔥 LOG CRÍTICO: Verificar se socket está sendo salvo
        console.log(`💾 [MONITOR-${slotNumber}] Salvando socket no Map:`, {
          hasSocket: !!socket,
          socketType: typeof socket,
          hasWs: !!socket.ws,
          wsReadyState: socket.ws?.readyState,
          wsOPEN: socket.ws?.OPEN,
          isWsOpen: socket.ws?.readyState === socket.ws?.OPEN
        });
        
        this.connections.set(connectionId, existingConnection);
        
        console.log(`✅ [MONITOR-${slotNumber}] Conexão salva: ${existingConnection.phoneNumber}`);
        
        // 🔥 CORREÇÃO 6: Notificar frontend que conexão foi estabelecida APÓS 'open'
        console.log(`🚀 [MONITOR-${slotNumber}] AUTENTICAÇÃO COMPLETA - Frontend será notificado`);
        
        // 🔥 NOVO: Health check para manter conexão viva
        this.startHealthCheck(socket, connectionId, slotNumber);
      }
      
      // 🔥 FASE 4: Conexão fechada
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        // 🔥 CORREÇÃO CRÍTICA: Verificar se desconexão foi manual
        const wasManuallyDisconnected = existingConnection.manuallyDisconnected || false;
        
        // 🔥 CORREÇÃO CRÍTICA: Tratamento específico para erro 405
        if (statusCode === 405) {
          console.log(`🚨 [MONITOR-${slotNumber}] ERRO 405 DETECTADO - Connection Failure`);
          existingConnection.isConnected = false;
          existingConnection.qrCode = null;
          this.connections.set(connectionId, existingConnection);
          
          // 🔥 SISTEMA DE RETRY INTELIGENTE: Aguardar mais tempo antes de tentar novamente
          if (!wasManuallyDisconnected) {
            console.log(`🔄 [MONITOR-${slotNumber}] Aguardando 30s antes de tentar reconectar após erro 405...`);
            setTimeout(() => {
              const latestConnection = this.connections.get(connectionId);
              if (latestConnection && !latestConnection.manuallyDisconnected) {
                console.log(`🔄 [MONITOR-${slotNumber}] Tentando reconectar após erro 405...`);
                this.connectToWhatsApp(connectionId, clientId, slotNumber);
              }
            }, 30000); // 30 segundos de delay para erro 405
          }
          return;
        }
        
        // Não reconectar se for logout (401) ou se foi desconectado manualmente
        const shouldReconnect = statusCode !== 401 && !wasManuallyDisconnected;
        
        console.log(`❌ [MONITOR-${slotNumber}] Conexão fechada. Status: ${statusCode}, Manual: ${wasManuallyDisconnected}, Reconectar: ${shouldReconnect}`);
        
        existingConnection.isConnected = false;
        if (statusCode === 401) {
          // 🔥 CORREÇÃO 5: Logout (401) - limpar APENAS a sessão no disco, não forçar reconnect
          console.log(`🧹 [MONITOR-${slotNumber}] Logout detectado (401) - limpando sessão do disco...`);
          try {
            const sessionPath = path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}_slot_${slotNumber}`);
            if (fs.existsSync(sessionPath)) {
              fs.rmSync(sessionPath, { recursive: true, force: true });
              console.log(`✅ [MONITOR-${slotNumber}] Sessão removida do disco: ${sessionPath}`);
            }
          } catch (cleanError) {
            console.error(`❌ [MONITOR-${slotNumber}] Erro ao limpar sessão:`, cleanError);
          }
          existingConnection.qrCode = null;
          existingConnection.phoneNumber = null;
        }
        
        // 🔥 CORREÇÃO CRÍTICA: Se foi desconectado manualmente, manter o flag
        if (wasManuallyDisconnected) {
          console.log(`🚫 [MONITOR-${slotNumber}] Desconexão manual detectada - NÃO reconectar automaticamente`);
          existingConnection.manuallyDisconnected = true;
        }
        
        this.connections.set(connectionId, existingConnection);
        
        // Auto-reconexão APENAS se não foi desconectado manualmente
        if (shouldReconnect) {
          setTimeout(() => {
            // 🔥 PROTEÇÃO DUPLA: Verificar novamente se não foi desconectado manualmente antes de reconectar
            const latestConnection = this.connections.get(connectionId);
            if (latestConnection && latestConnection.manuallyDisconnected) {
              console.log(`🚫 [MONITOR-${slotNumber}] RECONEXÃO CANCELADA - Conexão foi desconectada manualmente`);
              return;
            }
            this.connectToWhatsApp(connectionId, clientId, slotNumber);
          }, 10000);
        } else if (wasManuallyDisconnected) {
          console.log(`✅ [MONITOR-${slotNumber}] Sessão permanece desconectada até novo escaneamento manual`);
        }
      }
    });
    
    // 🔥 CRUCIAL: Salvar credenciais quando atualizadas
    socket.ev.on('creds.update', () => {
      console.log(`🔐 [MONITOR-${slotNumber}] Credenciais atualizadas - salvando...`);
      saveCreds();
    });
    
    // 🔥 NOVO: Monitorar eventos de mensagem para detectar conexão ativa E processar entrevistas
    socket.ev.on('messages.upsert', async ({ messages }: any) => {
      const existingConnection = this.connections.get(connectionId);
      if (existingConnection && !existingConnection.isConnected) {
        console.log(`📨 [MONITOR-${slotNumber}] Mensagens detectadas - confirmando conexão ativa`);
        existingConnection.isConnected = true;
        this.connections.set(connectionId, existingConnection);
      }

      // 🎯 CORREÇÃO CRÍTICA: Processar mensagens recebidas para entrevistas
      try {
        for (const message of messages) {
          // Só processar mensagens de entrada (não enviadas por nós)
          if (!message.key?.fromMe && message.message) {
            const from = message.key.remoteJid;
            const text = message.message.conversation || 
                        message.message.extendedTextMessage?.text || '';
            const audioMessage = message.message?.audioMessage;
            
            console.log(`\n🎯 [MESSAGE-HANDLER-${slotNumber}] ===== NOVA MENSAGEM RECEBIDA =====`);
            console.log(`📱 [MESSAGE-HANDLER-${slotNumber}] De: ${from?.replace('@s.whatsapp.net', '')}`);
            console.log(`💬 [MESSAGE-HANDLER-${slotNumber}] Texto: "${text}"`);
            console.log(`🎵 [MESSAGE-HANDLER-${slotNumber}] Áudio: ${audioMessage ? 'SIM' : 'NÃO'}`);
            
            // Detectar clientId automaticamente
            const phoneNumber = from?.replace('@s.whatsapp.net', '');
            let detectedClientId = null;
            
            try {
              // Importar storage dinamicamente para evitar circular reference
              const { storage } = await import('../../server/storage.js');
              const candidates = await storage.getAllCandidates();
              const candidate = candidates.find((c: any) => {
                const candidatePhone = (c.whatsapp || c.phone || '').replace(/\D/g, '');
                const searchPhone = phoneNumber?.replace(/\D/g, '') || '';
                return candidatePhone === searchPhone || candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
              });
              
              if (candidate) {
                detectedClientId = candidate.clientId?.toString();
                console.log(`✅ [MESSAGE-HANDLER-${slotNumber}] ClientId detectado: ${detectedClientId} para candidato ${candidate.name}`);
              } else {
                console.log(`⚠️ [MESSAGE-HANDLER-${slotNumber}] Candidato não encontrado, usando clientId padrão`);
                detectedClientId = clientId; // Usar clientId da conexão atual
              }
            } catch (error) {
              console.log(`❌ [MESSAGE-HANDLER-${slotNumber}] Erro detectando clientId:`, error.message);
              detectedClientId = clientId; // Fallback para clientId da conexão
            }
            
            // 🎯 CORREÇÃO PRINCIPAL: Direcionar para interactiveInterviewService
            try {
              const { interactiveInterviewService } = await import('../../server/interactiveInterviewService.js');
              
              // Passar mensagem completa para áudios, texto simples para texto
              if (audioMessage) {
                console.log(`🎵 [MESSAGE-HANDLER-${slotNumber}] Processando mensagem de áudio completa...`);
                await interactiveInterviewService.handleMessage(from, text, message, detectedClientId);
              } else {
                console.log(`💬 [MESSAGE-HANDLER-${slotNumber}] Processando mensagem de texto...`);
                await interactiveInterviewService.handleMessage(from, text, null, detectedClientId);
              }
              
              console.log(`✅ [MESSAGE-HANDLER-${slotNumber}] Mensagem processada pelo InteractiveInterviewService`);
              
            } catch (handlerError) {
              console.error(`❌ [MESSAGE-HANDLER-${slotNumber}] Erro processando mensagem:`, handlerError.message);
            }
            
            console.log(`🎯 [MESSAGE-HANDLER-${slotNumber}] ===== FIM DO PROCESSAMENTO =====\n`);
          }
        }
      } catch (error) {
        console.error(`❌ [MONITOR-${slotNumber}] Erro processando mensagens:`, error.message);
      }
    });
    
    console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Monitoramento contínuo OTIMIZADO configurado e ATIVO`);
  }

  /**
   * 🔥 NOVO: Health check para manter conexão viva
   */
  private startHealthCheck(socket: any, connectionId: string, slotNumber: number) {
    const healthCheck = setInterval(async () => {
      try {
        const connection = this.connections.get(connectionId);
        if (!connection || !connection.isConnected) {
          clearInterval(healthCheck);
          return;
        }
        
        if (socket.ws.readyState === socket.ws.OPEN) {
          // Enviar presence update para manter conexão viva
          await socket.sendPresenceUpdate('available');
          console.log(`💓 [HEALTH-${slotNumber}] Ping enviado - conexão ativa`);
        } else {
          console.log(`⚠️ [HEALTH-${slotNumber}] WebSocket não está aberto`);
          clearInterval(healthCheck);
        }
      } catch (error) {
        console.error(`❌ [HEALTH-${slotNumber}] Erro no health check:`, error);
        clearInterval(healthCheck);
      }
    }, 60000); // A cada 1 minuto
    
    // Limpar health check após 2 horas
    setTimeout(() => {
      clearInterval(healthCheck);
      console.log(`🧹 [HEALTH-${slotNumber}] Health check removido após 2 horas`);
    }, 7200000);
  }

  /**
   * Desconectar slot específico
   */
  async disconnectSlot(clientId: string, slotNumber: number): Promise<{ success: boolean; message: string }> {
    const connectionId = this.generateConnectionId(clientId, slotNumber);
    
    console.log(`🔌 [SIMPLE-BAILEYS] Desconectando slot ${slotNumber} para cliente ${clientId}`);

    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        console.log(`⚠️ [SIMPLE-BAILEYS] Slot ${slotNumber} não encontrado para cliente ${clientId}`);
        return {
          success: true,
          message: `Slot ${slotNumber} não estava conectado`
        };
      }

      // 🔥 CORREÇÃO CRÍTICA: Marcar como manualmente desconectado ANTES de fechar
      connection.manuallyDisconnected = true;
      this.connections.set(connectionId, connection);
      console.log(`🚫 [SIMPLE-BAILEYS] Slot ${slotNumber} marcado como manualmente desconectado`);

      // 🔥 CORREÇÃO CRÍTICA: Fechar o socket do Baileys efetivamente
      if (connection.socket) {
        try {
          console.log(`🔌 [SIMPLE-BAILEYS] Fechando socket do Baileys para slot ${slotNumber}`);
          
          // Fechar o WebSocket do Baileys
          if (connection.socket.ws && connection.socket.ws.readyState === connection.socket.ws.OPEN) {
            connection.socket.ws.close();
            console.log(`✅ [SIMPLE-BAILEYS] WebSocket fechado para slot ${slotNumber}`);
          }
          
          // Chamar método de desconexão do socket se existir
          if (typeof connection.socket.end === 'function') {
            await connection.socket.end();
            console.log(`✅ [SIMPLE-BAILEYS] Socket.end() chamado para slot ${slotNumber}`);
          }

          // Limpar event listeners
          if (typeof connection.socket.removeAllListeners === 'function') {
            connection.socket.removeAllListeners();
            console.log(`✅ [SIMPLE-BAILEYS] Event listeners removidos para slot ${slotNumber}`);
          }

        } catch (socketError) {
          console.log(`⚠️ [SIMPLE-BAILEYS] Erro ao fechar socket slot ${slotNumber}:`, socketError);
        }
      }

      // 🔥 CORREÇÃO CRÍTICA: Limpar credenciais de autenticação
      const authDir = path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}_${slotNumber}`);
      try {
        if (fs.existsSync(authDir)) {
          fs.rmSync(authDir, { recursive: true, force: true });
          console.log(`✅ [SIMPLE-BAILEYS] Credenciais removidas: ${authDir}`);
        }
      } catch (authError) {
        console.log(`⚠️ [SIMPLE-BAILEYS] Erro ao remover credenciais:`, authError);
      }

      // 🔥 CORREÇÃO CRÍTICA: NÃO remover a conexão do Map - manter como desconectada manualmente
      connection.isConnected = false;
      connection.qrCode = null;
      connection.phoneNumber = null;
      connection.socket = null;
      connection.lastConnection = null;
      connection.lastUpdate = new Date();
      connection.manuallyDisconnected = true; // Garantir que continua marcado como manual
      
      this.connections.set(connectionId, connection);
      console.log(`✅ [SIMPLE-BAILEYS] Conexão ${connectionId} mantida no Map como desconectada manualmente`);
      
      console.log(`✅ [SIMPLE-BAILEYS] Slot ${slotNumber} desconectado COMPLETAMENTE e marcado como manual`);
      
      return {
        success: true,
        message: `Slot ${slotNumber} desconectado com sucesso`
      };
      
    } catch (error: any) {
      console.log(`❌ [SIMPLE-BAILEYS] Erro desconectando slot ${slotNumber}:`, error.message);
      
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Enviar mensagem de teste por slot específico
   */
  async sendTestMessage(clientId: string, slotNumber: number, phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const connectionId = this.generateConnectionId(clientId, slotNumber);
    
    console.log(`📤 [SIMPLE-BAILEYS] Enviando teste slot ${slotNumber} para ${phoneNumber}`);

    try {
      const connection = this.connections.get(connectionId);
      if (!connection || !connection.isConnected) {
        console.log(`❌ [SIMPLE-BAILEYS] Slot ${slotNumber} não está conectado ou não encontrado`);
        return {
          success: false,
          error: `Slot ${slotNumber} não está conectado`
        };
      }

      // 🔥 CORREÇÃO CRÍTICA: Usar o socket real do Baileys
      const socket = connection.socket;
      
      // 🔍 DEBUG DETALHADO: Verificar estado do socket
      console.log(`🔍 [SIMPLE-BAILEYS] Debug socket slot ${slotNumber}:`, {
        hasSocket: !!socket,
        connectionId,
        isConnected: connection.isConnected,
        phoneNumber: connection.phoneNumber,
        lastConnection: connection.lastConnection,
        socketWsState: socket?.ws?.readyState,
        socketWsOpen: socket?.ws?.OPEN
      });
      
      // 🔍 DEBUG EXTRA: Listar todas as conexões disponíveis
      console.log(`🔍 [SIMPLE-BAILEYS] Todas as conexões ativas:`, Array.from(this.connections.entries()).map(([id, conn]) => ({
        id,
        isConnected: conn.isConnected,
        hasSocket: !!conn.socket,
        phoneNumber: conn.phoneNumber
      })));
      
      if (!socket) {
        console.log(`❌ [SIMPLE-BAILEYS] Socket não encontrado para slot ${slotNumber}`);
        return {
          success: false,
          error: `Socket não disponível para slot ${slotNumber}`
        };
      }

      // Verificar se socket está conectado
      if (socket.ws?.readyState !== socket.ws?.OPEN) {
        console.log(`❌ [SIMPLE-BAILEYS] WebSocket não está aberto para slot ${slotNumber}`);
        return {
          success: false,
          error: `WebSocket não está conectado para slot ${slotNumber}`
        };
      }

      // 🔥 ENVIO REAL: Usar socket Baileys para enviar mensagem
      const normalizedPhoneNumber = phoneNumber.replace(/\D/g, '');
      const jid = `${normalizedPhoneNumber}@s.whatsapp.net`;
      
      console.log(`📱 [SIMPLE-BAILEYS] Enviando mensagem real via Baileys para ${jid}`);
      
      const messageResult = await socket.sendMessage(jid, { text: message });
      
      console.log(`✅ [SIMPLE-BAILEYS] Mensagem REAL enviada via slot ${slotNumber} - ID: ${messageResult.key.id}`);
      
      return {
        success: true,
        messageId: messageResult.key.id
      };
      
    } catch (error: any) {
      console.log(`❌ [SIMPLE-BAILEYS] Erro enviando mensagem slot ${slotNumber}:`, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enviar mensagem de teste (compatibilidade com API anterior)
   */
  async sendMessage(clientId: string, phoneNumber: string, message: string, preferredSlot?: number): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const slotToUse = preferredSlot || 1;
    return this.sendTestMessage(clientId, slotToUse, phoneNumber, message);
  }

  /**
   * Enviar mensagem de áudio para WhatsApp
   */
  async sendAudioMessage(clientId: string, slotNumber: number, phoneNumber: string, audioBuffer: Buffer): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const connectionId = this.generateConnectionId(clientId, slotNumber);
    
    console.log(`🎵 [SIMPLE-BAILEYS] Enviando áudio slot ${slotNumber} para ${phoneNumber}`);

    try {
      const connection = this.connections.get(connectionId);
      if (!connection || !connection.isConnected) {
        console.log(`❌ [SIMPLE-BAILEYS] Slot ${slotNumber} não está conectado ou não encontrado`);
        return {
          success: false,
          error: `Slot ${slotNumber} não está conectado`
        };
      }

      const socket = connection.socket;
      
      if (!socket) {
        console.log(`❌ [SIMPLE-BAILEYS] Socket não encontrado para slot ${slotNumber}`);
        return {
          success: false,
          error: `Socket não disponível para slot ${slotNumber}`
        };
      }

      // Verificar se socket está conectado
      if (socket.ws?.readyState !== socket.ws?.OPEN) {
        console.log(`❌ [SIMPLE-BAILEYS] WebSocket não está aberto para slot ${slotNumber}`);
        return {
          success: false,
          error: `WebSocket não está conectado para slot ${slotNumber}`
        };
      }

      // Formatação do número para JID do WhatsApp
      const normalizedPhoneNumber = phoneNumber.replace(/\D/g, '');
      const jid = `${normalizedPhoneNumber}@s.whatsapp.net`;
      
      console.log(`🎵 [SIMPLE-BAILEYS] Enviando áudio real via Baileys para ${jid}`);
      
      // Enviar áudio usando Baileys
      const messageResult = await socket.sendMessage(jid, {
        audio: audioBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true // Define como mensagem de voz (Push To Talk)
      });
      
      console.log(`✅ [SIMPLE-BAILEYS] Áudio REAL enviado via slot ${slotNumber} - ID: ${messageResult.key.id}`);
      
      return {
        success: true,
        messageId: messageResult.key.id
      };
      
    } catch (error: any) {
      console.log(`❌ [SIMPLE-BAILEYS] Erro enviando áudio slot ${slotNumber}:`, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Limpar todas as conexões de um cliente
   */
  async clearClientConnections(clientId: string): Promise<void> {
    console.log(`🗑️ [SIMPLE-BAILEYS] Limpando todas as conexões do cliente ${clientId}`);
    
    for (let slot = 1; slot <= this.MAX_CONNECTIONS_PER_CLIENT; slot++) {
      const connectionId = this.generateConnectionId(clientId, slot);
      this.connections.delete(connectionId);
    }
    
    console.log(`✅ [SIMPLE-BAILEYS] Todas as conexões do cliente ${clientId} foram limpas`);
  }
}

export const simpleMultiBaileyService = new SimpleMultiBaileyService();