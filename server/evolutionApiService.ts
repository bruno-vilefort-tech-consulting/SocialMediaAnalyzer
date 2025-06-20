/**
 * Serviço Evolution API para conexão WhatsApp por cliente
 * 
 * Este serviço implementa conexões WhatsApp independentes por clientId
 * usando Evolution API conforme especificações técnicas fornecidas.
 */

import { storage } from './storage';

interface EvolutionConnection {
  clientId: string;
  instanceId: string;
  isConnected: boolean;
  qrCode?: string;
  phoneNumber?: string;
  lastConnection?: Date;
}

interface EvolutionApiResponse {
  status: boolean;
  pairingCode?: string;
  qrcode?: string;
  instance?: {
    instanceName: string;
    status: string;
  };
}

class EvolutionApiService {
  private connections: Map<string, EvolutionConnection> = new Map();
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    // Configurações da Evolution API - podem ser configuradas via env ou master settings
    this.apiUrl = process.env.EVOLUTION_API_URL || 'https://api.seudominio.com/v1';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
  }

  /**
   * Conectar cliente ao WhatsApp via Evolution API
   */
  async connectClient(clientId: string): Promise<{ success: boolean; qrCode?: string; message: string }> {
    try {
      console.log(`🔑 [EVOLUTION] Conectando cliente ${clientId} via Evolution API`);

      // Buscar ou criar instanceId para o cliente
      const instanceId = await this.getOrCreateInstanceId(clientId);
      
      console.log(`📱 [EVOLUTION] InstanceId para cliente ${clientId}: ${instanceId}`);

      // Fazer requisição para gerar QR Code
      const connectUrl = `${this.apiUrl}/instance/connect/${instanceId}`;
      const response = await fetch(connectUrl, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ [EVOLUTION] Erro na conexão: ${errorText}`);
        return {
          success: false,
          message: `Erro na Evolution API: ${errorText}`
        };
      }

      const data: EvolutionApiResponse = await response.json();
      console.log(`📋 [EVOLUTION] Resposta da API:`, data);

      if (data.pairingCode || data.qrcode) {
        const qrCode = data.pairingCode || data.qrcode;
        
        // Salvar conexão em memória
        this.connections.set(clientId, {
          clientId,
          instanceId,
          isConnected: false,
          qrCode,
          lastConnection: new Date()
        });

        // Salvar no banco de dados
        await this.saveConnectionToDatabase(clientId, {
          instanceId,
          isConnected: false,
          qrCode,
          lastConnection: new Date()
        });

        console.log(`✅ [EVOLUTION] QR Code gerado para cliente ${clientId}`);
        
        return {
          success: true,
          qrCode,
          message: 'QR Code gerado com sucesso'
        };
      }

      return {
        success: false,
        message: 'Não foi possível gerar QR Code'
      };

    } catch (error) {
      console.log(`❌ [EVOLUTION] Erro ao conectar cliente:`, error);
      return {
        success: false,
        message: `Erro interno: ${error.message}`
      };
    }
  }

  /**
   * Desconectar cliente do WhatsApp
   */
  async disconnectClient(clientId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔌 [EVOLUTION] Desconectando cliente ${clientId}`);

      const connection = await this.getConnection(clientId);
      if (!connection) {
        return {
          success: false,
          message: 'Cliente não possui conexão ativa'
        };
      }

      // Fazer logout na Evolution API
      const logoutUrl = `${this.apiUrl}/instance/logout/${connection.instanceId}`;
      const response = await fetch(logoutUrl, {
        method: 'DELETE',
        headers: {
          'apikey': this.apiKey
        }
      });

      // Remover da memória
      this.connections.delete(clientId);

      // Atualizar no banco
      await this.saveConnectionToDatabase(clientId, {
        instanceId: connection.instanceId,
        isConnected: false,
        qrCode: null,
        lastConnection: new Date()
      });

      console.log(`✅ [EVOLUTION] Cliente ${clientId} desconectado`);
      
      return {
        success: true,
        message: 'Desconectado com sucesso'
      };

    } catch (error) {
      console.log(`❌ [EVOLUTION] Erro ao desconectar:`, error);
      return {
        success: false,
        message: `Erro interno: ${error.message}`
      };
    }
  }

  /**
   * Verificar status da conexão
   */
  async getConnectionStatus(clientId: string): Promise<EvolutionConnection | null> {
    try {
      // Verificar conexão em memória primeiro
      let connection = this.connections.get(clientId);
      
      if (!connection) {
        // Buscar do banco de dados
        connection = await this.getConnectionFromDatabase(clientId);
        if (connection) {
          this.connections.set(clientId, connection);
        }
      }

      if (!connection) {
        return null;
      }

      // Verificar status na Evolution API
      try {
        const statusUrl = `${this.apiUrl}/instance/connectionState/${connection.instanceId}`;
        const response = await fetch(statusUrl, {
          headers: { 'apikey': this.apiKey }
        });

        if (response.ok) {
          const data = await response.json();
          const isConnected = data.instance?.connectionState === 'open';
          
          if (isConnected !== connection.isConnected) {
            connection.isConnected = isConnected;
            this.connections.set(clientId, connection);
            await this.saveConnectionToDatabase(clientId, connection);
          }
        }
      } catch (statusError) {
        console.log(`⚠️ [EVOLUTION] Erro ao verificar status:`, statusError);
      }

      return connection;

    } catch (error) {
      console.log(`❌ [EVOLUTION] Erro ao obter status:`, error);
      return null;
    }
  }

  /**
   * Enviar mensagem teste
   */
  async sendTestMessage(clientId: string, phoneNumber: string, message: string): Promise<{ success: boolean; message: string }> {
    try {
      const connection = await this.getConnection(clientId);
      if (!connection || !connection.isConnected) {
        return {
          success: false,
          message: 'Cliente não está conectado ao WhatsApp'
        };
      }

      const sendUrl = `${this.apiUrl}/message/sendText/${connection.instanceId}`;
      const response = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: phoneNumber,
          message: message
        })
      });

      const data = await response.json();
      
      if (data.status) {
        console.log(`✅ [EVOLUTION] Mensagem enviada para ${phoneNumber}`);
        return {
          success: true,
          message: 'Mensagem enviada com sucesso'
        };
      }

      return {
        success: false,
        message: `Erro ao enviar: ${data.message || 'Erro desconhecido'}`
      };

    } catch (error) {
      console.log(`❌ [EVOLUTION] Erro ao enviar mensagem:`, error);
      return {
        success: false,
        message: `Erro interno: ${error.message}`
      };
    }
  }

  /**
   * Obter ou criar instanceId para cliente
   */
  private async getOrCreateInstanceId(clientId: string): Promise<string> {
    try {
      // Verificar se já existe instanceId salvo
      const existingConnection = await this.getConnectionFromDatabase(clientId);
      if (existingConnection?.instanceId) {
        return existingConnection.instanceId;
      }

      // Criar nova instância na Evolution API
      const createUrl = `${this.apiUrl}/instance/create`;
      const response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instanceName: `client_${clientId}`,
          integration: 'WHATSAPP-BAILEYS'
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao criar instância: ${response.statusText}`);
      }

      const data = await response.json();
      const instanceId = data.instance?.instanceName || `client_${clientId}_${Date.now()}`;
      
      console.log(`🆕 [EVOLUTION] Nova instância criada: ${instanceId}`);
      return instanceId;

    } catch (error) {
      console.log(`❌ [EVOLUTION] Erro ao criar instanceId:`, error);
      // Fallback para instanceId baseado no clientId
      return `client_${clientId}_${Date.now()}`;
    }
  }

  /**
   * Obter conexão (memória ou banco)
   */
  private async getConnection(clientId: string): Promise<EvolutionConnection | null> {
    let connection = this.connections.get(clientId);
    
    if (!connection) {
      connection = await this.getConnectionFromDatabase(clientId);
      if (connection) {
        this.connections.set(clientId, connection);
      }
    }

    return connection;
  }

  /**
   * Salvar conexão no banco de dados
   */
  private async saveConnectionToDatabase(clientId: string, connectionData: Partial<EvolutionConnection>): Promise<void> {
    try {
      const config = {
        entityType: 'client' as const,
        entityId: clientId,
        evolutionInstanceId: connectionData.instanceId,
        evolutionConnected: connectionData.isConnected || false,
        evolutionQrCode: connectionData.qrCode || null,
        evolutionLastConnection: connectionData.lastConnection || new Date()
      };

      await storage.saveApiConfig(config);
      console.log(`💾 [EVOLUTION] Conexão salva no banco para cliente ${clientId}`);

    } catch (error) {
      console.log(`❌ [EVOLUTION] Erro ao salvar no banco:`, error);
    }
  }

  /**
   * Buscar conexão do banco de dados
   */
  private async getConnectionFromDatabase(clientId: string): Promise<EvolutionConnection | null> {
    try {
      const config = await storage.getApiConfig('client', clientId);
      
      if (!config || !config.evolutionInstanceId) {
        return null;
      }

      return {
        clientId,
        instanceId: config.evolutionInstanceId,
        isConnected: config.evolutionConnected || false,
        qrCode: config.evolutionQrCode || undefined,
        lastConnection: config.evolutionLastConnection ? new Date(config.evolutionLastConnection) : undefined
      };

    } catch (error) {
      console.log(`❌ [EVOLUTION] Erro ao buscar do banco:`, error);
      return null;
    }
  }
}

export const evolutionApiService = new EvolutionApiService();