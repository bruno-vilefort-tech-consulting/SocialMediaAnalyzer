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

  constructor() {
    console.log(`🔧 [SIMPLE-BAILEYS] Serviço inicializado - Max ${this.MAX_CONNECTIONS_PER_CLIENT} conexões por cliente`);
    // 🔥 CORREÇÃO: Limpar todas as conexões existentes para evitar problemas de circular reference
    this.clearAllConnections();
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
          service: 'baileys'
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
          service: 'baileys'
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
      service: 'baileys'
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

    return this.connectToWhatsApp(connectionId, clientId, slotNumber);
  }

  /**
   * 🔥 MÉTODO PRINCIPAL: Conectar usando Baileys real com protocolo MOBILE
   */
  async connectToWhatsApp(connectionId: string, clientId: string, slotNumber: number): Promise<any> {
    try {
      console.log(`🔌 [BAILEYS-SLOT-${slotNumber}] Iniciando processo de conexão OTIMIZADA...`);
      
      // 🔥 CORREÇÃO: Carregar Baileys dinamicamente antes de usar
      console.log(`📦 [BAILEYS-SLOT-${slotNumber}] Carregando Baileys dinamicamente...`);
      console.log(`🔍 [BAILEYS-SLOT-${slotNumber}] Estado atual - baileysLoaded: ${this.baileysLoaded}, makeWASocket: ${typeof makeWASocket}`);
      
      const baileysLoaded = await this.loadBaileys();
      console.log(`📦 [BAILEYS-SLOT-${slotNumber}] loadBaileys retornou: ${baileysLoaded}`);
      
      if (!baileysLoaded) {
        console.log(`❌ [BAILEYS-SLOT-${slotNumber}] Falha ao carregar Baileys`);
        return {
          success: false,
          message: 'Erro ao carregar biblioteca Baileys',
          qrCode: null
        };
      }
      
      console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Baileys carregado com sucesso, prosseguindo...`);
      
      // Validar ambiente
      const envInfo = BaileysConfig.validateEnvironment();
      console.log(`🌍 [BAILEYS-SLOT-${slotNumber}] Ambiente detectado:`, envInfo);
      
      // Criar diretório de sessão para este slot
      const sessionPath = path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}_slot_${slotNumber}`);
      
      // 🔥 CORREÇÃO 1: NÃO APAGAR SESSÃO - apenas criar se não existir
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
        console.log(`📁 [BAILEYS-SLOT-${slotNumber}] Nova sessão criada: ${sessionPath}`);
      } else {
        console.log(`📁 [BAILEYS-SLOT-${slotNumber}] Usando sessão existente: ${sessionPath}`);
      }
      
      console.log(`🔑 [BAILEYS-SLOT-${slotNumber}] Carregando estado de autenticação...`);
      
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Estado de autenticação carregado`);
      
      let qrCodeData: string | null = null;
      
      console.log(`🚀 [BAILEYS-SLOT-${slotNumber}] Criando socket Baileys com versão DINÂMICA do WhatsApp...`);
      
      // 🔥 CORREÇÃO 2: Buscar versão real do WhatsApp em tempo real
      let latestVersion: [number, number, number] = [2, 2419, 6]; // Fallback padrão
      try {
        if (fetchLatestBaileysVersion) {
          console.log(`📡 [BAILEYS-SLOT-${slotNumber}] Buscando versão mais recente do WhatsApp Web...`);
          const versionInfo = await fetchLatestBaileysVersion();
          if (versionInfo?.version && Array.isArray(versionInfo.version) && versionInfo.version.length >= 3) {
            latestVersion = [versionInfo.version[0], versionInfo.version[1], versionInfo.version[2]];
            console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Versão WhatsApp obtida: ${latestVersion.join('.')}`);
          } else {
            console.warn(`⚠️ [BAILEYS-SLOT-${slotNumber}] Versão inválida recebida, usando fallback`);
          }
        } else {
          console.warn(`⚠️ [BAILEYS-SLOT-${slotNumber}] fetchLatestBaileysVersion não disponível, usando fallback`);
        }
      } catch (versionError) {
        console.warn(`⚠️ [BAILEYS-SLOT-${slotNumber}] Falha ao obter versão dinâmica, usando fallback:`, versionError);
      }
      
      // 🔥 USAR CONFIGURAÇÃO COM VERSÃO DINÂMICA
      const socketConfig = await BaileysConfig.getSocketConfig(state);
      socketConfig.version = latestVersion;
      const socket = makeWASocket(socketConfig);
      
      console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Socket SUPER OTIMIZADO criado para v6.7.18`);
      console.log(`👂 [BAILEYS-SLOT-${slotNumber}] Aguardando eventos de conexão...`);
      
      // 🔥 CORREÇÃO 3: Aguardar conexão 'open' ou gerar QR Code
      const connectionPromise = new Promise<{ qrCode?: string; connected?: boolean; success: boolean }>((resolve) => {
        let resolved = false;
        
        socket.ev.on('connection.update', async (update: any) => {
          const { connection, lastDisconnect, qr } = update;
          
          console.log(`📡 [BAILEYS-SLOT-${slotNumber}] Update:`, { 
            connection, 
            hasQR: !!qr,
            qrLength: qr?.length || 0,
            hasLastDisconnect: !!lastDisconnect
          });
          
          // 🔥 Se usuário já estava logado e conexão abre imediatamente
          if (connection === 'open' && !resolved) {
            resolved = true;
            console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Usuário já conectado! Retornando isConnected=true`);
            resolve({ connected: true, success: true });
            return;
          }
          
          // 🔥 Se precisa gerar QR Code
          if (qr && !resolved) {
            resolved = true;
            
            try {
              const QRCode = await import('qrcode');
              qrCodeData = await QRCode.toDataURL(qr, {
                width: 256,
                margin: 2,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF'
                }
              });
              
              console.log(`✅ [BAILEYS-SLOT-${slotNumber}] QR Code gerado (${qrCodeData.length} chars) - Aguardando scan...`);
              resolve({ qrCode: qrCodeData, success: true });
              
            } catch (qrError) {
              console.error(`❌ [BAILEYS-SLOT-${slotNumber}] Erro ao converter QR:`, qrError);
              resolve({ success: false });
            }
          }
        });
        
        // Timeout aumentado para 90 segundos conforme sugerido
        setTimeout(() => {
          if (!resolved) {
            console.log(`⏰ [BAILEYS-SLOT-${slotNumber}] Timeout após 90s`);
            resolve({ success: false });
          }
        }, 90000); // 90 segundos conforme sugerido
      });
      
      // 🔥 SISTEMA CONTÍNUO: Monitorar conexão após QR Code
      this.setupContinuousMonitoring(socket, connectionId, clientId, slotNumber, saveCreds);
      
      const qrResult = await connectionPromise;
      
      // 🔥 CORREÇÃO 4: Tratar usuário já conectado
      if (qrResult.success && qrResult.connected) {
        // Usuário já estava logado
        const connection: SimpleConnection = {
          connectionId,
          clientId,
          slotNumber,
          isConnected: true,
          qrCode: null,
          phoneNumber: null, // Será atualizado no monitoramento
          lastConnection: new Date(),
          service: 'baileys',
          socket // 🔥 CRUCIAL: Manter socket ativo
        };

        this.connections.set(connectionId, connection);
        
        console.log(`✅ [SIMPLE-BAILEYS] Usuário já conectado para slot ${slotNumber}. Monitoramento ativo.`);
        
        return {
          success: true,
          message: 'Já conectado',
          isConnected: true
        };
      }
      
      if (qrResult.success && qrResult.qrCode) {
        // Salvar conexão com socket ativo para monitoramento contínuo
        const connection: SimpleConnection = {
          connectionId,
          clientId,
          slotNumber,
          isConnected: false,
          qrCode: qrResult.qrCode,
          phoneNumber: null,
          lastConnection: new Date(),
          service: 'baileys',
          socket // 🔥 CRUCIAL: Manter socket ativo
        };

        this.connections.set(connectionId, connection);
       
        console.log(`✅ [SIMPLE-BAILEYS] QR Code retornado para slot ${slotNumber}. Monitoramento SUPER OTIMIZADO ativo.`);
        
        return {
          success: true,
          qrCode: qrResult.qrCode,
          message: `QR Code gerado para slot ${slotNumber} com configurações v6.7.18. Aguarde scan...`
        };
      } else {
        return {
          success: false,
          message: `Timeout ao gerar QR Code para slot ${slotNumber} - verifique conectividade`
        };
      }
      
    } catch (error: any) {
      console.log(`❌ [SIMPLE-BAILEYS] Erro conectando slot ${slotNumber}:`, error.message);
      
      return {
        success: false,
        message: `Erro na configuração v6.7.18: ${error.message}`
      };
    }
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
        const shouldReconnect = statusCode !== 401; // Não reconectar se logout manual
        
        console.log(`❌ [MONITOR-${slotNumber}] Conexão fechada. Status: ${statusCode}, Reconectar: ${shouldReconnect}`);
        
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
        
        this.connections.set(connectionId, existingConnection);
        
        // Auto-reconexão se necessário
        if (shouldReconnect) {
          console.log(`🔄 [MONITOR-${slotNumber}] Tentando reconectar em 10 segundos...`);
          setTimeout(() => {
            this.connectToWhatsApp(connectionId, clientId, slotNumber);
          }, 10000);
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
      if (connection) {
        connection.isConnected = false;
        connection.qrCode = null;
        connection.phoneNumber = null;
        this.connections.set(connectionId, connection);
      }
      
      console.log(`✅ [SIMPLE-BAILEYS] Slot ${slotNumber} desconectado`);
      
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