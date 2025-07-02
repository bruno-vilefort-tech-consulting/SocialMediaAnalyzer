/**
 * Serviço Multi-WhatsApp - Gerencia múltiplas conexões WhatsApp por cliente
 * 
 * Este serviço atua como uma camada unificadora entre diferentes implementações 
 * WhatsApp (Baileys, WppConnect, Evolution API) e fornece uma interface consistente
 * para o sistema.
 */

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
    
    // 🔥 CORREÇÃO: Consultar simpleMultiBaileyService primeiro (fonte da verdade)
    try {
      const { simpleMultiBaileyService } = await import('./simpleMultiBailey');
      console.log(`🔍 [SIMPLE-BAILEYS] Verificando conexões para cliente ${clientId}`);
      
      const clientConnections: WhatsAppConnection[] = [];
      
      for (let slot = 1; slot <= this.MAX_CONNECTIONS_PER_CLIENT; slot++) {
        const connectionId = this.generateConnectionId(clientId, slot);
        
        // Consultar status real do simpleMultiBaileyService
        const realStatus = await simpleMultiBaileyService.getConnectionStatus(clientId, slot);
        
        const connection: WhatsAppConnection = {
          connectionId,
          clientId,
          slotNumber: slot,
          isConnected: realStatus.isConnected,
          qrCode: realStatus.qrCode,
          phoneNumber: realStatus.phoneNumber,
          lastConnection: realStatus.lastConnection ? new Date(realStatus.lastConnection) : null,
          service: 'baileys'
        };
        
        clientConnections.push(connection);
      }

      const activeConnections = clientConnections.filter(conn => conn.isConnected).length;
      
      console.log(`📱 [MULTI-WA] Status das conexões:`, { clientId, totalConnections: this.MAX_CONNECTIONS_PER_CLIENT, activeConnections });

      return {
        clientId,
        connections: clientConnections,
        totalConnections: this.MAX_CONNECTIONS_PER_CLIENT,
        activeConnections
      };
      
    } catch (error) {
      console.log(`⚠️ [MULTI-WA] Erro ao consultar SimpleMultiBailey:`, error);
      
      // Fallback para conexões desconectadas
      const clientConnections: WhatsAppConnection[] = [];
      
      for (let slot = 1; slot <= this.MAX_CONNECTIONS_PER_CLIENT; slot++) {
        const connectionId = this.generateConnectionId(clientId, slot);
        
        const connection: WhatsAppConnection = {
          connectionId,
          clientId,
          slotNumber: slot,
          isConnected: false,
          qrCode: null,
          phoneNumber: null,
          lastConnection: null,
          service: 'baileys'
        };
        
        clientConnections.push(connection);
      }

      return {
        clientId,
        connections: clientConnections,
        totalConnections: this.MAX_CONNECTIONS_PER_CLIENT,
        activeConnections: 0
      };
    }
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
    
    // Criar conexão padrão desconectada caso simpleMultiBailey falhe
    const connection: WhatsAppConnection = {
      connectionId,
      clientId,
      slotNumber,
      isConnected: false,
      qrCode: null,
      phoneNumber: null,
      lastConnection: null,
      service: 'baileys'
    };

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
    console.log(`🔗 [MULTI-WA] Conectando slot ${slotNumber} para cliente ${clientId}`);

    try {
      // 🔥 PRIORIDADE 1: Baileys usando simpleMultiBaileyService
      const { simpleMultiBaileyService } = await import('./simpleMultiBailey');
      const result = await simpleMultiBaileyService.connectSlot(clientId, slotNumber);
      
      if (result.success && result.qrCode) {
        const connection: WhatsAppConnection = {
          connectionId,
          clientId,
          slotNumber,
          isConnected: false, // QR Code gerado mas ainda não conectado
          qrCode: result.qrCode,
          phoneNumber: null,
          lastConnection: null,
          service: 'baileys'
        };
        
        this.connections.set(connectionId, connection);
        console.log(`✅ [MULTI-WA] QR Code gerado para ${connectionId} via Baileys`);
        
        return {
          success: true,
          qrCode: result.qrCode,
          message: 'QR Code gerado com sucesso via Baileys'
        };
      }
      
      return {
        success: false,
        message: result.message || 'Erro ao gerar QR Code via Baileys'
      };
      
    } catch (error: any) {
      console.log(`❌ [MULTI-WA] Erro ao conectar slot ${connectionId}:`, error.message);
      return {
        success: false,
        message: `Erro ao conectar: ${error.message}`
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
      // 🔥 Desconectar do simpleMultiBaileyService
      const { simpleMultiBaileyService } = await import('./simpleMultiBailey');
      const result = await simpleMultiBaileyService.disconnectSlot(clientId, slotNumber);
      
      // Limpar cache local
      this.connections.delete(connectionId);
      
      console.log(`✅ [MULTI-WA] Slot ${connectionId} desconectado`);
      
      return {
        success: true,
        message: result.message || 'Desconectado com sucesso'
      };
      
    } catch (error: any) {
      console.log(`❌ [MULTI-WA] Erro ao desconectar slot ${connectionId}:`, error.message);
      return {
        success: false,
        message: `Erro ao desconectar: ${error.message}`
      };
    }
  }

  /**
   * Enviar mensagem usando qualquer conexão ativa
   */
  async sendMessage(clientId: string, phoneNumber: string, message: string, preferredSlot?: number): Promise<{success: boolean; usedSlot?: number; message: string}> {
    console.log(`📞 [MULTI-WA] Enviando mensagem para ${phoneNumber} - cliente ${clientId}`);
    
    try {
      // 🔥 Usar simpleMultiBaileyService para envio real
      const { simpleMultiBaileyService } = await import('./simpleMultiBailey');
      
      // Verificar conexões ativas primeiro
      const connections = await this.getClientConnections(clientId);
      const activeConnections = connections.connections.filter(conn => conn.isConnected);
      
      if (activeConnections.length === 0) {
        return {
          success: false,
          message: 'Nenhuma conexão WhatsApp ativa encontrada'
        };
      }
      
      // Usar slot preferido ou primeiro ativo
      const slotToUse = preferredSlot || activeConnections[0].slotNumber;
      
      console.log(`📱 [MULTI-WA] Usando slot ${slotToUse} para envio`);
      
      const result = await simpleMultiBaileyService.sendTestMessage(clientId, slotToUse, phoneNumber, message);
      
      if (result.success) {
        console.log(`✅ [MULTI-WA] Mensagem enviada com sucesso via slot ${slotToUse}`);
        return {
          success: true,
          usedSlot: slotToUse,
          message: `Mensagem enviada via slot ${slotToUse}`
        };
      } else {
        console.log(`❌ [MULTI-WA] Falha no envio via slot ${slotToUse}: ${result.error}`);
        return {
          success: false,
          message: result.error || 'Erro desconhecido no envio'
        };
      }
      
    } catch (error: any) {
      console.log(`❌ [MULTI-WA] Erro geral no envio:`, error.message);
      return {
        success: false,
        message: `Erro no envio: ${error.message}`
      };
    }
  }

  /**
   * Limpar cache de conexões
   */
  clearCache(clientId?: string): void {
    if (clientId) {
      for (let slot = 1; slot <= this.MAX_CONNECTIONS_PER_CLIENT; slot++) {
        const connectionId = this.generateConnectionId(clientId, slot);
        this.connections.delete(connectionId);
      }
      console.log(`🗑️ [MULTI-WA] Cache limpo para cliente ${clientId}`);
    } else {
      this.connections.clear();
      console.log(`🗑️ [MULTI-WA] Cache completo limpo`);
    }
  }
}

export const multiWhatsAppService = new MultiWhatsAppService();