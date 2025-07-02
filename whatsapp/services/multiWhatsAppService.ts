import { whatsappBaileyService } from './whatsappBaileyService';
import { wppConnectService } from './wppConnectService';
import { evolutionApiService } from './evolutionApiService';

interface WhatsAppConnection {
  connectionId: string; // client_id_slot_number (ex: 1749849987543_1)
  clientId: string;
  slotNumber: number; // 1, 2, ou 3
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
  service: 'baileys' | 'wppconnect' | 'evolution';
}

interface MultiConnectionStatus {
  clientId: string;
  connections: WhatsAppConnection[];
  totalConnections: number;
  activeConnections: number;
}

class MultiWhatsAppService {
  private connections: Map<string, WhatsAppConnection> = new Map();
  private readonly MAX_CONNECTIONS_PER_CLIENT = 3;

  constructor() {
    console.log(`🔧 [MULTI-WA] MultiWhatsAppService inicializado - Max ${this.MAX_CONNECTIONS_PER_CLIENT} conexões por cliente`);
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
  async getClientConnections(clientId: string): Promise<MultiConnectionStatus> {
    console.log(`🔍 [MULTI-WA] Verificando conexões para cliente ${clientId}`);
    
    const clientConnections: WhatsAppConnection[] = [];
    
    for (let slot = 1; slot <= this.MAX_CONNECTIONS_PER_CLIENT; slot++) {
      const connectionId = this.generateConnectionId(clientId, slot);
      
      // Verificar status em cada serviço
      const connection = await this.getConnectionStatus(clientId, slot);
      clientConnections.push(connection);
    }

    const activeConnections = clientConnections.filter(conn => conn.isConnected).length;

    return {
      clientId,
      connections: clientConnections,
      totalConnections: this.MAX_CONNECTIONS_PER_CLIENT,
      activeConnections
    };
  }

  /**
   * Obter status de uma conexão específica
   */
  async getConnectionStatus(clientId: string, slotNumber: number): Promise<WhatsAppConnection> {
    const connectionId = this.generateConnectionId(clientId, slotNumber);
    
    // 🔥 CORREÇÃO: Consultar simpleMultiBaileyService primeiro (fonte da verdade)
    try {
      const { simpleMultiBaileyService } = await import('./simpleMultiBailey');
      const realStatus = await simpleMultiBaileyService.getConnectionStatus(clientId, slotNumber);
      
      if (realStatus.isConnected) {
        const connection: WhatsAppConnection = {
          connectionId,
          clientId,
          slotNumber,
          isConnected: true,
          qrCode: realStatus.qrCode,
          phoneNumber: realStatus.phoneNumber,
          lastConnection: realStatus.lastConnection ? new Date(realStatus.lastConnection) : null,
          service: 'baileys'
        };
        
        // Atualizar cache com status real
        this.connections.set(connectionId, connection);
        console.log(`✅ [MULTI-WA] Status real para ${connectionId}: CONECTADO (${realStatus.phoneNumber || 'unknown'})`);
        return connection;
      } else if (realStatus.qrCode) {
        const connection: WhatsAppConnection = {
          connectionId,
          clientId,
          slotNumber,
          isConnected: false,
          qrCode: realStatus.qrCode,
          phoneNumber: null,
          lastConnection: null,
          service: 'baileys'
        };
        
        this.connections.set(connectionId, connection);
        console.log(`📱 [MULTI-WA] QR Code disponível para ${connectionId}`);
        return connection;
      }
    } catch (error) {
      console.log(`⚠️ [MULTI-WA] Erro ao consultar SimpleMultiBailey para ${connectionId}:`, error);
    }
    
    // Verificar cache apenas se simpleMultiBailey falhou
    if (this.connections.has(connectionId)) {
      const cached = this.connections.get(connectionId)!;
      console.log(`📋 [MULTI-WA] Status em cache para ${connectionId}: ${cached.isConnected ? 'conectado' : 'desconectado'}`);
      return cached;
    }

    // Verificar status em cada serviço
    let connection: WhatsAppConnection = {
      connectionId,
      clientId,
      slotNumber,
      isConnected: false,
      qrCode: null,
      phoneNumber: null,
      lastConnection: null,
      service: 'baileys'
    };

    try {
      // PRIORIDADE 1: Baileys (slot específico)
      const baileysStatus = whatsappBaileyService.getConnectionStatus(`${clientId}_${slotNumber}`);
      if (baileysStatus.isConnected) {
        connection = {
          ...connection,
          isConnected: true,
          qrCode: baileysStatus.qrCode,
          phoneNumber: baileysStatus.phoneNumber,
          service: 'baileys'
        };
      } else if (baileysStatus.qrCode) {
        connection.qrCode = baileysStatus.qrCode;
        connection.service = 'baileys';
      }

      // PRIORIDADE 2: WppConnect (se Baileys não conectado)
      if (!connection.isConnected) {
        // WppConnect verifica sessão específica
        const wppStatus = await wppConnectService.getSessionStatus(`${clientId}_${slotNumber}`);
        if (wppStatus?.isConnected) {
          connection = {
            ...connection,
            isConnected: true,
            phoneNumber: wppStatus.phoneNumber,
            service: 'wppconnect'
          };
        }
      }

      // PRIORIDADE 3: Evolution API (fallback)
      if (!connection.isConnected) {
        const evolutionStatus = await evolutionApiService.getStatus(`${clientId}_${slotNumber}`);
        if (evolutionStatus?.isConnected) {
          connection = {
            ...connection,
            isConnected: true,
            phoneNumber: evolutionStatus.phoneNumber,
            service: 'evolution'
          };
        }
      }

    } catch (error) {
      console.error(`❌ [MULTI-WA] Erro ao verificar status ${connectionId}:`, error);
    }

    // Cache do resultado
    this.connections.set(connectionId, connection);
    return connection;
  }

  /**
   * Conectar uma nova instância WhatsApp
   */
  async connectSlot(clientId: string, slotNumber: number): Promise<{success: boolean; qrCode?: string; message: string}> {
    if (slotNumber < 1 || slotNumber > this.MAX_CONNECTIONS_PER_CLIENT) {
      return {
        success: false,
        message: `Slot inválido. Use valores entre 1 e ${this.MAX_CONNECTIONS_PER_CLIENT}`
      };
    }

    const connectionId = this.generateConnectionId(clientId, slotNumber);
    console.log(`🔗 [MULTI-WA] Conectando slot ${slotNumber} para cliente ${clientId} (${connectionId})`);

    try {
      // PRIORIDADE 1: Tentar Baileys
      try {
        const baileysResult = await whatsappBaileyService.initWhatsApp(connectionId);
        
        if (baileysResult?.qrCode) {
          console.log(`✅ [MULTI-WA] Slot ${slotNumber} conectado via Baileys`);
          
          // Atualizar cache
          this.connections.set(connectionId, {
            connectionId,
            clientId,
            slotNumber,
            isConnected: false, // Ainda aguardando scan
            qrCode: baileysResult.qrCode,
            phoneNumber: null,
            lastConnection: null,
            service: 'baileys'
          });

          return {
            success: true,
            qrCode: baileysResult.qrCode,
            message: `QR Code gerado para Slot ${slotNumber} via Baileys`
          };
        }
      } catch (error: any) {
        console.log(`⚠️ [MULTI-WA] Baileys falhou para slot ${slotNumber}, tentando WppConnect...`);
      }

      // PRIORIDADE 2: Tentar WppConnect
      const wppResult = await wppConnectService.createSession(connectionId);
      
      if (wppResult.success && wppResult.qrCode) {
        console.log(`✅ [MULTI-WA] Slot ${slotNumber} conectado via WppConnect`);
        
        this.connections.set(connectionId, {
          connectionId,
          clientId,
          slotNumber,
          isConnected: false,
          qrCode: wppResult.qrCode,
          phoneNumber: null,
          lastConnection: null,
          service: 'wppconnect'
        });

        return {
          success: true,
          qrCode: wppResult.qrCode,
          message: `QR Code gerado para Slot ${slotNumber} via WppConnect`
        };
      }

      // PRIORIDADE 3: Evolution API
      const evolutionResult = await evolutionApiService.connectClient(connectionId);
      
      if (evolutionResult.success) {
        console.log(`✅ [MULTI-WA] Slot ${slotNumber} conectado via Evolution API`);
        
        this.connections.set(connectionId, {
          connectionId,
          clientId,
          slotNumber,
          isConnected: false,
          qrCode: evolutionResult.qrCode,
          phoneNumber: null,
          lastConnection: null,
          service: 'evolution'
        });

        return {
          success: evolutionResult.success,
          qrCode: evolutionResult.qrCode,
          isConnected: false,
          message: evolutionResult.error || 'QR Code gerado via Evolution API'
        };
      }

      return {
        success: false,
        message: `Falha ao conectar Slot ${slotNumber} via todos os serviços`
      };

    } catch (error: any) {
      console.error(`❌ [MULTI-WA] Erro ao conectar slot ${slotNumber}:`, error);
      return {
        success: false,
        message: `Erro interno ao conectar Slot ${slotNumber}: ${error.message}`
      };
    }
  }

  /**
   * Desconectar uma instância específica
   */
  async disconnectSlot(clientId: string, slotNumber: number): Promise<{success: boolean; message: string}> {
    const connectionId = this.generateConnectionId(clientId, slotNumber);
    console.log(`🔌 [MULTI-WA] Desconectando slot ${slotNumber} para cliente ${clientId}`);

    try {
      const connection = this.connections.get(connectionId);
      
      if (!connection) {
        return {
          success: true,
          message: `Slot ${slotNumber} já estava desconectado`
        };
      }

      // Desconectar do serviço apropriado
      switch (connection.service) {
        case 'baileys':
          await whatsappBaileyService.disconnect(connectionId);
          break;
        case 'wppconnect':
          await wppConnectService.killSession(connectionId);
          break;
        case 'evolution':
          await evolutionApiService.disconnect(connectionId);
          break;
      }

      // Remover do cache
      this.connections.delete(connectionId);

      return {
        success: true,
        message: `Slot ${slotNumber} desconectado com sucesso`
      };

    } catch (error: any) {
      console.error(`❌ [MULTI-WA] Erro ao desconectar slot ${slotNumber}:`, error);
      return {
        success: false,
        message: `Erro ao desconectar Slot ${slotNumber}: ${error.message}`
      };
    }
  }

  /**
   * Enviar mensagem usando qualquer conexão ativa
   */
  async sendMessage(clientId: string, phoneNumber: string, message: string, preferredSlot?: number): Promise<{success: boolean; usedSlot?: number; message: string}> {
    console.log(`📤 [MULTI-WA] Enviando mensagem para ${phoneNumber} via cliente ${clientId}`);

    const connections = await this.getClientConnections(clientId);
    const activeConnections = connections.connections.filter(conn => conn.isConnected);

    if (activeConnections.length === 0) {
      return {
        success: false,
        message: 'Nenhuma conexão WhatsApp ativa encontrada'
      };
    }

    // Usar slot preferido se especificado e ativo
    let targetConnection = activeConnections[0];
    if (preferredSlot) {
      const preferred = activeConnections.find(conn => conn.slotNumber === preferredSlot);
      if (preferred) {
        targetConnection = preferred;
      }
    }

    try {
      let result = false;

      switch (targetConnection.service) {
        case 'baileys':
          result = await whatsappBaileyService.sendMessage(targetConnection.connectionId, phoneNumber, message);
          break;
        case 'wppconnect':
          result = await wppConnectService.sendMessage(targetConnection.connectionId, phoneNumber, message);
          break;
        case 'evolution':
          result = await evolutionApiService.sendMessage(targetConnection.connectionId, phoneNumber, message);
          break;
      }

      return {
        success: result,
        usedSlot: targetConnection.slotNumber,
        message: result 
          ? `Mensagem enviada via Slot ${targetConnection.slotNumber} (${targetConnection.service})`
          : `Falha ao enviar via Slot ${targetConnection.slotNumber}`
      };

    } catch (error: any) {
      console.error(`❌ [MULTI-WA] Erro ao enviar mensagem:`, error);
      return {
        success: false,
        message: `Erro ao enviar mensagem: ${error.message}`
      };
    }
  }

  /**
   * Limpar cache de conexões
   */
  clearCache(clientId?: string): void {
    if (clientId) {
      // Limpar apenas conexões do cliente específico
      for (let slot = 1; slot <= this.MAX_CONNECTIONS_PER_CLIENT; slot++) {
        const connectionId = this.generateConnectionId(clientId, slot);
        this.connections.delete(connectionId);
      }
      console.log(`🧹 [MULTI-WA] Cache limpo para cliente ${clientId}`);
    } else {
      // Limpar todo o cache
      this.connections.clear();
      console.log(`🧹 [MULTI-WA] Cache completo limpo`);
    }
  }
}

export const multiWhatsAppService = new MultiWhatsAppService();