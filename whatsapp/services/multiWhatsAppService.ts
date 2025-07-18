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
    
    // 🔥 CORREÇÃO: Consultar simpleMultiBaileyService primeiro (fonte da verdade)
    try {
      const { simpleMultiBaileyService } = await import('./simpleMultiBailey');
      
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

      return {
        clientId,
        connections: clientConnections,
        totalConnections: this.MAX_CONNECTIONS_PER_CLIENT,
        activeConnections
      };
      
    } catch (error) {
      
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
        return connection;
      }
    } catch (error) {
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

    try {
      // 🔥 Desconectar do simpleMultiBaileyService
      const { simpleMultiBaileyService } = await import('./simpleMultiBailey');
      const result = await simpleMultiBaileyService.disconnectSlot(clientId, slotNumber);
      
      // Limpar cache local
      this.connections.delete(connectionId);
      
      return {
        success: true,
        message: result.message || 'Desconectado com sucesso'
      };
      
    } catch (error: any) {
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
      
      const result = await simpleMultiBaileyService.sendTestMessage(clientId, slotToUse, phoneNumber, message);
      
      if (result.success) {
        return {
          success: true,
          usedSlot: slotToUse,
          message: `Mensagem enviada via slot ${slotToUse}`
        };
      } else {
        return {
          success: false,
          message: result.error || 'Erro desconhecido no envio'
        };
      }
      
    } catch (error: any) {
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
    } else {
      this.connections.clear();
    }
  }
}

export const multiWhatsAppService = new MultiWhatsAppService();