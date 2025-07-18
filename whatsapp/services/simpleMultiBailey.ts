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
// Removed baileysFallbackService import - file doesn't exist

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
    // 🔥 CORREÇÃO: Limpar todas as conexões existentes para evitar problemas de circular reference
    this.clearAllConnections();
  }

  /**
   * Registrar handler de mensagens para o fallback
   */
  setMessageHandler(handler: Function) {
    this.messageHandler = handler;
  }

  /**
   * 🔥 CORREÇÃO: Limpar todas as conexões e timers para evitar circular reference
   */
  private clearAllConnections(): void {
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
      
      const baileys = await import('@whiskeysockets/baileys');
      
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
      
      return true;
    } catch (error) {
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
                existingConnection.isConnected = true;
                this.connections.set(connectionId, existingConnection);
              }
            } catch (error) {
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
            existingConnection.isConnected = false;
            this.connections.set(connectionId, existingConnection);
          }
        } catch (error) {
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
    

    // 🔥 RECONEXÃO MANUAL EXPLÍCITA: Resetar flag manuallyDisconnected quando usuário clica conectar
    const existingConnection = this.connections.get(connectionId);
    if (existingConnection && existingConnection.manuallyDisconnected) {
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
        
        // 🔥 CORREÇÃO: Carregar Baileys dinamicamente antes de usar
        const baileysLoaded = await this.loadBaileys();
        if (!baileysLoaded) {
          throw new Error('Falha ao carregar biblioteca Baileys');
        }
        
        // Validar ambiente
        const envInfo = BaileysConfig.validateEnvironment();
        
        // Criar diretório de sessão para este slot
        const sessionPath = path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}_slot_${slotNumber}`);
        
        // 🔥 CORREÇÃO CRÍTICA: Limpar sessão antiga se erro 405 persistir
        if (retryCount > 0 && fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
        
        if (!fs.existsSync(sessionPath)) {
          fs.mkdirSync(sessionPath, { recursive: true });
        }
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        // 🔥 CORREÇÃO: Buscar versão real do WhatsApp
        let latestVersion: [number, number, number] = [2, 2419, 6];
        try {
          if (fetchLatestBaileysVersion) {
            const versionInfo = await fetchLatestBaileysVersion();
            if (versionInfo?.version && Array.isArray(versionInfo.version) && versionInfo.version.length >= 3) {
              latestVersion = [versionInfo.version[0], versionInfo.version[1], versionInfo.version[2]];
            }
          }
        } catch (versionError) {
        }
        
        // 🔥 USAR CONFIGURAÇÃO PROGRESSIVA BASEADA NO RETRY COUNT
        const socketConfig = await BaileysConfig.getSocketConfig(state, retryCount);
        socketConfig.version = latestVersion;
        
        const socket = makeWASocket(socketConfig);
        
        // 🔥 CORREÇÃO: Promise com timeout e retry
        const connectionPromise = new Promise<{ qrCode?: string; connected?: boolean; success: boolean }>((resolve) => {
          let resolved = false;
          let errorCount = 0;
          
          socket.ev.on('connection.update', async (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            // 🔥 DETECTAR ERRO 405 RAPIDAMENTE
            if (connection === 'close' && lastDisconnect?.error?.output?.statusCode === 405) {
              if (!resolved) {
                resolved = true;
                resolve({ success: false });
              }
              return;
            }
            
            // 🔥 Se usuário já estava logado
            if (connection === 'open' && !resolved) {
              resolved = true;
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
                
                resolve({ qrCode: qrCodeData, success: true });
                
              } catch (qrError) {
                resolve({ success: false });
              }
            }
          });
          
          // 🔥 TIMEOUT REDUZIDO PARA DETECTAR PROBLEMAS RAPIDAMENTE
          setTimeout(() => {
            if (!resolved) {
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
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
      } catch (error: any) {
        retryCount++;
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    
    // 🔥 TODAS AS TENTATIVAS FALHARAM - CRIAR CONEXÃO MOCK
    
    console.log(`⚠️ Sistema de fallback não disponível para cliente ${clientId}, slot ${slotNumber}`);
    console.log(`❌ Tentativas de conexão esgotadas após ${maxRetries} tentativas`);
    
    // Criar conexão mock para manter funcionalidade básica
    const mockConnection: SimpleConnection = {
      connectionId,
      clientId,
      slotNumber,
      isConnected: false, // Mock como desconectado
      qrCode: null,
      phoneNumber: null,
      lastConnection: null,
      service: 'baileys',
      manuallyDisconnected: false
    };
    
    // Armazenar conexão mock
    this.connections.set(connectionId, mockConnection);
    
    return {
      success: false,
      message: `⚠️ Conexão falhou após ${maxRetries} tentativas. Sistema de fallback não disponível.`,
      qrCode: null
    };
  }

  /**
   * 🔥 NOVO: Sistema de monitoramento contínuo da conexão
   */
  private setupContinuousMonitoring(socket: any, connectionId: string, clientId: string, slotNumber: number, saveCreds: any) {
    
    socket.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      const existingConnection = this.connections.get(connectionId);
      if (!existingConnection) return;
      
      // 🔥 FASE 2: Processo de autenticação (após scan)
      if (connection === 'connecting') {
        existingConnection.qrCode = null; // Remove QR Code após scan
        this.connections.set(connectionId, existingConnection);
      }
      
      // 🔥 FASE 3: Conexão estabelecida
      if (connection === 'open') {
        
        existingConnection.isConnected = true;
        existingConnection.qrCode = null;
        existingConnection.phoneNumber = socket.user?.id?.split('@')[0] || 'Connected';
        existingConnection.lastConnection = new Date();
        existingConnection.socket = socket;
        
        this.connections.set(connectionId, existingConnection);
        
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
          existingConnection.isConnected = false;
          existingConnection.qrCode = null;
          this.connections.set(connectionId, existingConnection);
          
          // 🔥 SISTEMA DE RETRY INTELIGENTE: Aguardar mais tempo antes de tentar novamente
          if (!wasManuallyDisconnected) {
            setTimeout(() => {
              const latestConnection = this.connections.get(connectionId);
              if (latestConnection && !latestConnection.manuallyDisconnected) {
                this.connectToWhatsApp(connectionId, clientId, slotNumber);
              }
            }, 30000); // 30 segundos de delay para erro 405
          }
          return;
        }
        
        // Não reconectar se for logout (401) ou se foi desconectado manualmente
        const shouldReconnect = statusCode !== 401 && !wasManuallyDisconnected;
        
        existingConnection.isConnected = false;
        if (statusCode === 401) {
          // 🔥 CORREÇÃO 5: Logout (401) - limpar APENAS a sessão no disco, não forçar reconnect
          try {
            const sessionPath = path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}_slot_${slotNumber}`);
            if (fs.existsSync(sessionPath)) {
              fs.rmSync(sessionPath, { recursive: true, force: true });
            }
          } catch (cleanError) {
          }
          existingConnection.qrCode = null;
          existingConnection.phoneNumber = null;
        }
        
        // 🔥 CORREÇÃO CRÍTICA: Se foi desconectado manualmente, manter o flag
        if (wasManuallyDisconnected) {
          existingConnection.manuallyDisconnected = true;
        }
        
        this.connections.set(connectionId, existingConnection);
        
        // Auto-reconexão APENAS se não foi desconectado manualmente
        if (shouldReconnect) {
          setTimeout(() => {
            // 🔥 PROTEÇÃO DUPLA: Verificar novamente se não foi desconectado manualmente antes de reconectar
            const latestConnection = this.connections.get(connectionId);
            if (latestConnection && latestConnection.manuallyDisconnected) {
              return;
            }
            this.connectToWhatsApp(connectionId, clientId, slotNumber);
          }, 10000);
        }
      }
    });
    
    // 🔥 CRUCIAL: Salvar credenciais quando atualizadas
    socket.ev.on('creds.update', () => {
      saveCreds();
    });
    
    // 🔥 NOVO: Monitorar eventos de mensagem para detectar conexão ativa E processar entrevistas
    socket.ev.on('messages.upsert', async ({ messages }: any) => {
      const existingConnection = this.connections.get(connectionId);
      if (existingConnection && !existingConnection.isConnected) {
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
              } else {
                detectedClientId = clientId; // Usar clientId da conexão atual
              }
            } catch (error) {
              detectedClientId = clientId; // Fallback para clientId da conexão
            }
            
            // 🎯 CORREÇÃO PRINCIPAL: Direcionar para interactiveInterviewService
            try {
              const { interactiveInterviewService } = await import('../../server/interactiveInterviewService.js');
              
              // Passar mensagem completa para áudios, texto simples para texto
              if (audioMessage) {
                await interactiveInterviewService.handleMessage(from, text, message, detectedClientId);
              } else {
                await interactiveInterviewService.handleMessage(from, text, null, detectedClientId);
              }
              
            } catch (handlerError) {
            }
          }
        }
      } catch (error) {
      }
    });
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
        } else {
          clearInterval(healthCheck);
        }
      } catch (error) {
        clearInterval(healthCheck);
      }
    }, 60000); // A cada 1 minuto
    
    // Limpar health check após 2 horas
    setTimeout(() => {
      clearInterval(healthCheck);
    }, 7200000);
  }

  /**
   * Desconectar slot específico
   */
  async disconnectSlot(clientId: string, slotNumber: number): Promise<{ success: boolean; message: string }> {
    const connectionId = this.generateConnectionId(clientId, slotNumber);

    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        return {
          success: true,
          message: `Slot ${slotNumber} não estava conectado`
        };
      }

      // 🔥 CORREÇÃO CRÍTICA: Marcar como manualmente desconectado ANTES de fechar
      connection.manuallyDisconnected = true;
      this.connections.set(connectionId, connection);

      // 🔥 CORREÇÃO CRÍTICA: Fechar o socket do Baileys efetivamente
      if (connection.socket) {
        try {
          
          // Fechar o WebSocket do Baileys
          if (connection.socket.ws && connection.socket.ws.readyState === connection.socket.ws.OPEN) {
            connection.socket.ws.close();
          }
          
          // Chamar método de desconexão do socket se existir
          if (typeof connection.socket.end === 'function') {
            await connection.socket.end();
          }

          // Limpar event listeners
          if (typeof connection.socket.removeAllListeners === 'function') {
            connection.socket.removeAllListeners();
          }

        } catch (socketError) {
        }
      }

      // 🔥 CORREÇÃO CRÍTICA: Limpar credenciais de autenticação
      const authDir = path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}_${slotNumber}`);
      try {
        if (fs.existsSync(authDir)) {
          fs.rmSync(authDir, { recursive: true, force: true });
        }
      } catch (authError) {
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
      
      return {
        success: true,
        message: `Slot ${slotNumber} desconectado com sucesso`
      };
      
    } catch (error: any) {
      
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

    try {
      const connection = this.connections.get(connectionId);
      if (!connection || !connection.isConnected) {
        return {
          success: false,
          error: `Slot ${slotNumber} não está conectado`
        };
      }

      // 🔥 CORREÇÃO CRÍTICA: Usar o socket real do Baileys
      const socket = connection.socket;
      
      if (!socket) {
        return {
          success: false,
          error: `Socket não disponível para slot ${slotNumber}`
        };
      }

      // Verificar se socket está conectado
      if (socket.ws?.readyState !== socket.ws?.OPEN) {
        return {
          success: false,
          error: `WebSocket não está conectado para slot ${slotNumber}`
        };
      }

      // 🔥 ENVIO REAL: Usar socket Baileys para enviar mensagem
      const normalizedPhoneNumber = phoneNumber.replace(/\D/g, '');
      const jid = `${normalizedPhoneNumber}@s.whatsapp.net`;
      
      const messageResult = await socket.sendMessage(jid, { text: message });
      
      return {
        success: true,
        messageId: messageResult.key.id
      };
      
    } catch (error: any) {
      
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

    try {
      const connection = this.connections.get(connectionId);
      if (!connection || !connection.isConnected) {
        return {
          success: false,
          error: `Slot ${slotNumber} não está conectado`
        };
      }

      const socket = connection.socket;
      
      if (!socket) {
        return {
          success: false,
          error: `Socket não disponível para slot ${slotNumber}`
        };
      }

      // Verificar se socket está conectado
      if (socket.ws?.readyState !== socket.ws?.OPEN) {
        return {
          success: false,
          error: `WebSocket não está conectado para slot ${slotNumber}`
        };
      }

      // Formatação do número para JID do WhatsApp
      const normalizedPhoneNumber = phoneNumber.replace(/\D/g, '');
      const jid = `${normalizedPhoneNumber}@s.whatsapp.net`;
      
      // Enviar áudio usando Baileys
      const messageResult = await socket.sendMessage(jid, {
        audio: audioBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true // Define como mensagem de voz (Push To Talk)
      });
      
      return {
        success: true,
        messageId: messageResult.key.id
      };
      
    } catch (error: any) {
      
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
    
    for (let slot = 1; slot <= this.MAX_CONNECTIONS_PER_CLIENT; slot++) {
      const connectionId = this.generateConnectionId(clientId, slot);
      this.connections.delete(connectionId);
    }
  }
}

export const simpleMultiBaileyService = new SimpleMultiBaileyService();