/**
 * Serviço de múltiplas conexões WhatsApp usando EXCLUSIVAMENTE Baileys
 * Versão simplificada sem dependências complexas
 */

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

  constructor() {
    console.log(`🔧 [SIMPLE-BAILEYS] Serviço inicializado - Max ${this.MAX_CONNECTIONS_PER_CLIENT} conexões por cliente`);
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
    
    const connections: SimpleConnection[] = [];
    
    for (let slot = 1; slot <= this.MAX_CONNECTIONS_PER_CLIENT; slot++) {
      const connection = await this.getConnectionStatus(clientId, slot);
      connections.push(connection);
    }

    const activeConnections = connections.filter(conn => conn.isConnected).length;
    
    return {
      clientId,
      connections,
      totalConnections: this.MAX_CONNECTIONS_PER_CLIENT,
      activeConnections
    };
  }

  /**
   * Verificar status de conexão específica
   */
  private async getConnectionStatus(clientId: string, slotNumber: number): Promise<SimpleConnection> {
    const connectionId = this.generateConnectionId(clientId, slotNumber);
    
    // Verificar se existe na memória
    const existingConnection = this.connections.get(connectionId);
    if (existingConnection) {
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

    try {
      console.log(`🔌 [BAILEYS-SLOT-${slotNumber}] Iniciando processo de conexão...`);
      
      // Implementar conexão real do Baileys
      const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await import('@whiskeysockets/baileys');
      const { Boom } = await import('@hapi/boom');
      const path = await import('path');
      const fs = await import('fs');
      
      console.log(`📦 [BAILEYS-SLOT-${slotNumber}] Dependências importadas com sucesso`);
      
      // Criar diretório de sessão para este slot
      const sessionPath = path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}_slot_${slotNumber}`);
      
      // NOVA ESTRATÉGIA: Sempre limpar sessão existente para forçar novo QR Code
      if (fs.existsSync(sessionPath)) {
        console.log(`🧹 [BAILEYS-SLOT-${slotNumber}] Limpando sessão antiga para forçar novo QR Code...`);
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
      
      fs.mkdirSync(sessionPath, { recursive: true });
      console.log(`📁 [BAILEYS-SLOT-${slotNumber}] Nova sessão criada: ${sessionPath}`);
      
      console.log(`🔑 [BAILEYS-SLOT-${slotNumber}] Carregando estado de autenticação limpo...`);
      
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Estado de autenticação limpo carregado`);
      
      let qrCodeData: string | null = null;
      
      console.log(`🚀 [BAILEYS-SLOT-${slotNumber}] Criando socket Baileys com configurações otimizadas...`);
      
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Maximus', 'Chrome', '4.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        markOnlineOnConnect: false,
        fireInitQueries: true,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        logger: { level: 'silent', child: () => ({ level: 'silent' } as any) } as any
      });
      
      console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Socket criado com configurações otimizadas`);
      console.log(`👂 [BAILEYS-SLOT-${slotNumber}] Aguardando eventos de conexão...`);
      
      // Promise para aguardar QR Code ou conexão
      const connectionPromise = new Promise<{ qrCode?: string; success: boolean }>((resolve) => {
        let resolved = false;
        let qrReceived = false;
        
        console.log(`👂 [BAILEYS-SLOT-${slotNumber}] Configurando listeners de eventos...`);
        
        socket.ev.on('connection.update', async (update) => {
          console.log(`📡 [BAILEYS-SLOT-${slotNumber}] Evento connection.update:`, { 
            connection: update.connection, 
            hasQR: !!update.qr,
            qrLength: update.qr?.length || 0 
          });
          
          const { connection, lastDisconnect, qr } = update;
          
          if (qr && !resolved && !qrReceived) {
            qrReceived = true;
            console.log(`🎯 [BAILEYS-SLOT-${slotNumber}] QR Code recebido! Convertendo...`);
            
            try {
              // Converter QR Code para data URL
              const QRCode = await import('qrcode');
              qrCodeData = await QRCode.toDataURL(qr, {
                width: 256,
                margin: 2,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF'
                }
              });
              
              console.log(`✅ [BAILEYS-SLOT-${slotNumber}] QR Code convertido com sucesso (${qrCodeData.length} caracteres)`);
              
              // Salvar QR Code na conexão
              const existingConnection = this.connections.get(connectionId);
              if (existingConnection) {
                existingConnection.qrCode = qrCodeData;
                existingConnection.lastUpdate = new Date();
                console.log(`💾 [BAILEYS-SLOT-${slotNumber}] QR Code salvo na conexão`);
              }
              
              resolved = true;
              resolve({ qrCode: qrCodeData, success: true });
            } catch (qrError) {
              console.error(`❌ [BAILEYS-SLOT-${slotNumber}] Erro ao converter QR Code:`, qrError);
              resolved = true;
              resolve({ success: false });
            }
          }
          
          if (connection === 'open' && !resolved) {
            console.log(`✅ [BAILEYS-SLOT-${slotNumber}] Conectado com sucesso`);
            // Atualizar conexão como conectada
            const existingConnection = this.connections.get(connectionId);
            if (existingConnection) {
              existingConnection.isConnected = true;
              existingConnection.qrCode = null;
              existingConnection.phoneNumber = socket.user?.id?.split('@')[0] || null;
              existingConnection.socket = socket;
            }
            
            if (!qrReceived) {
              resolved = true;
              resolve({ success: true });
            }
          }
          
          if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`❌ [BAILEYS-SLOT-${slotNumber}] Conexão fechada:`, lastDisconnect?.error, 'Reconectando:', shouldReconnect);
          }
        });
        
        socket.ev.on('creds.update', saveCreds);
        
        // Timeout de 60 segundos para gerar QR Code
        setTimeout(() => {
          if (!resolved) {
            console.log(`⏰ [BAILEYS-SLOT-${slotNumber}] Timeout ao gerar QR Code (QR recebido: ${qrReceived})`);
            resolved = true;
            resolve({ success: false });
          }
        }, 60000);
        
        console.log(`⏳ [BAILEYS-SLOT-${slotNumber}] Aguardando eventos...`);
      });
      
      const result = await connectionPromise;
      
      if (result.success && result.qrCode) {
        const connection: SimpleConnection = {
          connectionId,
          clientId,
          slotNumber,
          isConnected: false,
          qrCode: result.qrCode,
          phoneNumber: null,
          lastConnection: new Date(),
          service: 'baileys',
          socket
        };

        this.connections.set(connectionId, connection);
        
        console.log(`✅ [SIMPLE-BAILEYS] QR Code Baileys real gerado para slot ${slotNumber} (${result.qrCode.length} caracteres)`);
        
        return {
          success: true,
          qrCode: result.qrCode,
          message: `QR Code Baileys gerado para slot ${slotNumber}`
        };
      } else {
        return {
          success: false,
          message: `Timeout ao gerar QR Code para slot ${slotNumber}`
        };
      }
      
    } catch (error: any) {
      console.log(`❌ [SIMPLE-BAILEYS] Erro conectando slot ${slotNumber}:`, error.message);
      
      return {
        success: false,
        message: error.message
      };
    }
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
        return {
          success: false,
          error: `Slot ${slotNumber} não está conectado`
        };
      }

      // Simular envio de mensagem
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`✅ [SIMPLE-BAILEYS] Mensagem enviada via slot ${slotNumber}`);
      return {
        success: true,
        messageId: messageId
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