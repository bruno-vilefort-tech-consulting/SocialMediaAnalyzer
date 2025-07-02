/**
 * Serviço de múltiplas conexões WhatsApp usando EXCLUSIVAMENTE Baileys
 * Cada cliente pode ter até 3 conexões simultâneas independentes
 */

import { whatsappBaileyService, WhatsAppBaileyService } from './whatsappBaileyService';

interface WhatsAppConnection {
  connectionId: string; // client_id_slot_number (ex: 1749849987543_1)
  clientId: string;
  slotNumber: number; // 1, 2, ou 3
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
  service: 'baileys';
}

interface MultiConnectionStatus {
  clientId: string;
  connections: WhatsAppConnection[];
  totalConnections: number;
  activeConnections: number;
}

class MultiWhatsAppBaileysService {
  private connections: Map<string, WhatsAppConnection> = new Map();
  private baileysServices: Map<string, any> = new Map();
  private readonly MAX_CONNECTIONS_PER_CLIENT = 3;

  constructor() {
    console.log(`🔧 [MULTI-BAILEYS] MultiWhatsAppBaileysService inicializado - Max ${this.MAX_CONNECTIONS_PER_CLIENT} conexões por cliente`);
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
    console.log(`🔍 [MULTI-BAILEYS] Verificando conexões para cliente ${clientId}`);
    
    const clientConnections: WhatsAppConnection[] = [];
    
    for (let slot = 1; slot <= this.MAX_CONNECTIONS_PER_CLIENT; slot++) {
      const connectionId = this.generateConnectionId(clientId, slot);
      
      // Verificar status real do Baileys
      const connection = await this.getConnectionStatus(clientId, slot);
      clientConnections.push(connection);
    }

    const activeConnections = clientConnections.filter(conn => conn.isConnected).length;

    console.log(`📱 [MULTI-BAILEYS] Status das conexões:`, {
      clientId,
      totalConnections: this.MAX_CONNECTIONS_PER_CLIENT,
      activeConnections
    });

    return {
      clientId,
      connections: clientConnections,
      totalConnections: this.MAX_CONNECTIONS_PER_CLIENT,
      activeConnections
    };
  }

  /**
   * Verificar status de conexão específica
   */
  private async getConnectionStatus(clientId: string, slotNumber: number): Promise<WhatsAppConnection> {
    const connectionId = this.generateConnectionId(clientId, slotNumber);
    
    // Verificar se já existe instância do Baileys para esta conexão
    const baileysService = this.baileysServices.get(connectionId);
    
    let isConnected = false;
    let qrCode: string | null = null;
    let phoneNumber: string | null = null;
    let lastConnection: Date | null = null;

    if (baileysService) {
      try {
        // Verificar status real da conexão Baileys
        const status = await baileysService.getConnectionStatus();
        isConnected = status.isConnected;
        qrCode = status.qrCode;
        phoneNumber = status.phoneNumber;
        
        if (isConnected && phoneNumber) {
          lastConnection = new Date();
        }
        
        console.log(`📋 [MULTI-BAILEYS] Status para ${connectionId}:`, {
          isConnected,
          hasQrCode: !!qrCode,
          phoneNumber
        });
      } catch (error) {
        console.log(`❌ [MULTI-BAILEYS] Erro verificando status ${connectionId}:`, error);
        isConnected = false;
      }
    } else {
      console.log(`📋 [MULTI-BAILEYS] Sem instância Baileys para ${connectionId}: desconectado`);
    }

    const connection: WhatsAppConnection = {
      connectionId,
      clientId,
      slotNumber,
      isConnected,
      qrCode,
      phoneNumber,
      lastConnection,
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
    
    console.log(`🔌 [MULTI-BAILEYS] Tentando conectar slot ${slotNumber} para cliente ${clientId}`);

    try {
      // Criar nova instância do Baileys para esta conexão
      const baileysService = new WhatsAppBaileyService();
      this.baileysServices.set(connectionId, baileysService);

      // Inicializar WhatsApp com ID único da conexão
      const result = await baileysService.initWhatsApp(connectionId);
      
      if (result.success && result.qrCode) {
        // Atualizar conexão local
        const connection: WhatsAppConnection = {
          connectionId,
          clientId,
          slotNumber,
          isConnected: false, // Ainda não conectado, apenas QR gerado
          qrCode: result.qrCode,
          phoneNumber: null,
          lastConnection: null,
          service: 'baileys'
        };
        
        this.connections.set(connectionId, connection);
        
        console.log(`✅ [MULTI-BAILEYS] QR Code gerado para slot ${slotNumber}`);
        
        return {
          success: true,
          qrCode: result.qrCode,
          message: `QR Code gerado para Slot ${slotNumber}. Escaneie para conectar.`
        };
      } else {
        throw new Error(result.message || 'Falha ao gerar QR Code');
      }
    } catch (error: any) {
      console.log(`❌ [MULTI-BAILEYS] Erro conectando slot ${slotNumber}:`, error.message);
      
      // Limpar instância com erro
      this.baileysServices.delete(connectionId);
      
      return {
        success: false,
        message: `Erro ao conectar Slot ${slotNumber}: ${error.message}`
      };
    }
  }

  /**
   * Desconectar slot específico
   */
  async disconnectSlot(clientId: string, slotNumber: number): Promise<{ success: boolean; message: string }> {
    const connectionId = this.generateConnectionId(clientId, slotNumber);
    
    console.log(`🔌 [MULTI-BAILEYS] Desconectando slot ${slotNumber} para cliente ${clientId}`);

    try {
      const baileysService = this.baileysServices.get(connectionId);
      
      if (baileysService) {
        // Desconectar serviço Baileys
        await baileysService.disconnect();
        
        // Remover instância
        this.baileysServices.delete(connectionId);
      }
      
      // Limpar conexão local
      this.connections.delete(connectionId);
      
      console.log(`✅ [MULTI-BAILEYS] Slot ${slotNumber} desconectado com sucesso`);
      
      return {
        success: true,
        message: `Slot ${slotNumber} desconectado com sucesso`
      };
    } catch (error: any) {
      console.log(`❌ [MULTI-BAILEYS] Erro desconectando slot ${slotNumber}:`, error.message);
      
      return {
        success: false,
        message: `Erro ao desconectar Slot ${slotNumber}: ${error.message}`
      };
    }
  }

  /**
   * Enviar mensagem de teste por slot específico
   */
  async sendTestMessage(clientId: string, slotNumber: number, phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const connectionId = this.generateConnectionId(clientId, slotNumber);
    
    console.log(`📤 [MULTI-BAILEYS] Enviando teste pelo slot ${slotNumber} para ${phoneNumber}`);

    try {
      const baileysService = this.baileysServices.get(connectionId);
      
      if (!baileysService) {
        return {
          success: false,
          error: `Slot ${slotNumber} não está conectado`
        };
      }

      // Verificar se está conectado
      const status = await baileysService.getConnectionStatus();
      if (!status.isConnected) {
        return {
          success: false,
          error: `Slot ${slotNumber} não está conectado ao WhatsApp`
        };
      }

      // Enviar mensagem
      const result = await baileysService.sendMessage(phoneNumber, message);
      
      if (result.success) {
        console.log(`✅ [MULTI-BAILEYS] Mensagem enviada via slot ${slotNumber}`);
        return {
          success: true,
          messageId: result.messageId
        };
      } else {
        return {
          success: false,
          error: result.error || 'Falha no envio'
        };
      }
    } catch (error: any) {
      console.log(`❌ [MULTI-BAILEYS] Erro enviando mensagem slot ${slotNumber}:`, error.message);
      
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
    console.log(`🗑️ [MULTI-BAILEYS] Limpando todas as conexões do cliente ${clientId}`);
    
    for (let slot = 1; slot <= this.MAX_CONNECTIONS_PER_CLIENT; slot++) {
      const connectionId = this.generateConnectionId(clientId, slot);
      
      const baileysService = this.baileysServices.get(connectionId);
      if (baileysService) {
        try {
          await baileysService.disconnect();
        } catch (error) {
          console.log(`⚠️ [MULTI-BAILEYS] Erro desconectando ${connectionId}:`, error);
        }
        
        this.baileysServices.delete(connectionId);
      }
      
      this.connections.delete(connectionId);
    }
    
    console.log(`✅ [MULTI-BAILEYS] Todas as conexões do cliente ${clientId} foram limpas`);
  }
}

export const multiWhatsAppBaileysService = new MultiWhatsAppBaileysService();