/**
 * Serviço Evolution API para conexão WhatsApp por cliente
 * 
 * Este serviço implementa conexões WhatsApp independentes por clientId
 * usando Evolution API conforme especificações técnicas fornecidas.
 */

import { storage } from './storage.js';

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
    this.apiUrl = process.env.EVOLUTION_API_URL || 'https://evo-api.repl.co';
    this.apiKey = process.env.EVOLUTION_API_KEY || 'digite_uma_chave_longasegura';
  }

  /**
   * Conectar cliente ao WhatsApp via Evolution API
   */
  async connectClient(clientId: string): Promise<{ success: boolean; qrCode?: string; message: string }> {
    try {
      console.log(`🔗 [Evolution] Conectando cliente ${clientId}...`);
      
      // Verificar se já existe conexão ativa
      const existingConnection = await this.getConnectionStatus(clientId);
      if (existingConnection?.isConnected) {
        return {
          success: true,
          message: `WhatsApp já conectado para cliente ${clientId}`
        };
      }

      // Obter ou criar instanceId
      const instanceId = await this.getOrCreateInstanceId(clientId);
      
      // Criar instância na Evolution API
      const createResponse = await fetch(`${this.apiUrl}/instance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: instanceId,
          token: `${clientId}_token`,
          qrcode: true,
          webhook: process.env.WA_WEBHOOK || ''
        })
      });

      if (!createResponse.ok) {
        throw new Error(`Evolution API retornou ${createResponse.status}`);
      }

      const createData: EvolutionApiResponse = await createResponse.json();
      console.log(`📱 [Evolution] Instância criada:`, createData);

      // Buscar QR Code
      const qrResponse = await fetch(`${this.apiUrl}/instance/${instanceId}/qr`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (qrResponse.ok) {
        const qrData = await qrResponse.json();
        const qrCode = qrData.qrcode || qrData.pairingCode;
        
        if (qrCode) {
          // Salvar conexão
          const connection: EvolutionConnection = {
            clientId,
            instanceId,
            isConnected: false,
            qrCode,
            lastConnection: new Date()
          };

          this.connections.set(clientId, connection);
          await this.saveConnectionToDatabase(clientId, connection);

          console.log(`✅ [Evolution] QR Code gerado para cliente ${clientId}`);
          return {
            success: true,
            qrCode,
            message: 'QR Code gerado com sucesso - escaneie com seu WhatsApp'
          };
        }
      }

      return {
        success: false,
        message: 'Falha ao gerar QR Code via Evolution API'
      };

    } catch (error) {
      console.error(`❌ [Evolution] Erro ao conectar cliente ${clientId}:`, error);
      return {
        success: false,
        message: `Erro na conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * Desconectar cliente do WhatsApp
   */
  async disconnectClient(clientId: string): Promise<{ success: boolean; message: string }> {
    try {
      const connection = await this.getConnectionStatus(clientId);
      if (!connection) {
        return { success: true, message: 'Cliente já desconectado' };
      }

      // Remover instância da Evolution API
      const response = await fetch(`${this.apiUrl}/instance/${connection.instanceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      // Limpar conexão local
      this.connections.delete(clientId);
      await this.saveConnectionToDatabase(clientId, {
        clientId,
        instanceId: connection.instanceId,
        isConnected: false,
        qrCode: null,
        phoneNumber: null
      });

      console.log(`🔌 [Evolution] Cliente ${clientId} desconectado`);
      return {
        success: true,
        message: 'WhatsApp desconectado com sucesso'
      };

    } catch (error) {
      console.error(`❌ [Evolution] Erro ao desconectar cliente ${clientId}:`, error);
      return {
        success: false,
        message: `Erro ao desconectar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * Verificar status da conexão
   */
  async getConnectionStatus(clientId: string): Promise<EvolutionConnection | null> {
    try {
      // Verificar cache local primeiro
      let connection = this.connections.get(clientId);
      
      // Se não existe local, buscar do banco
      if (!connection) {
        connection = await this.getConnectionFromDatabase(clientId);
        if (connection) {
          this.connections.set(clientId, connection);
        }
      }

      if (!connection) {
        return null;
      }

      // Verificar status real na Evolution API
      try {
        const response = await fetch(`${this.apiUrl}/instance/${connection.instanceId}/status`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        });

        if (response.ok) {
          const statusData = await response.json();
          const isConnected = statusData.status === 'open' || statusData.connected === true;
          
          // Atualizar status se mudou
          if (connection.isConnected !== isConnected) {
            connection.isConnected = isConnected;
            this.connections.set(clientId, connection);
            await this.saveConnectionToDatabase(clientId, { isConnected });
          }
        }
      } catch (statusError) {
        console.warn(`⚠️ [Evolution] Falha ao verificar status para ${clientId}:`, statusError);
      }

      return connection;

    } catch (error) {
      console.error(`❌ [Evolution] Erro ao obter status do cliente ${clientId}:`, error);
      return null;
    }
  }

  /**
   * Enviar mensagem teste
   */
  async sendTestMessage(clientId: string, phoneNumber: string, message: string): Promise<{ success: boolean; message: string }> {
    try {
      const connection = await this.getConnectionStatus(clientId);
      if (!connection?.isConnected) {
        return {
          success: false,
          message: 'WhatsApp não está conectado para este cliente'
        };
      }

      const response = await fetch(`${this.apiUrl}/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instance_id: connection.instanceId,
          number: phoneNumber.replace(/\D/g, ''),
          message: message
        })
      });

      if (response.ok) {
        console.log(`✅ [Evolution] Mensagem teste enviada para ${phoneNumber}`);
        return {
          success: true,
          message: 'Mensagem de teste enviada com sucesso!'
        };
      } else {
        const errorData = await response.json();
        return {
          success: false,
          message: `Falha no envio: ${errorData.message || 'Erro desconhecido'}`
        };
      }

    } catch (error) {
      console.error(`❌ [Evolution] Erro ao enviar mensagem teste:`, error);
      return {
        success: false,
        message: `Erro no envio: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * Obter ou criar instanceId para cliente
   */
  private async getOrCreateInstanceId(clientId: string): Promise<string> {
    return `client_${clientId}_${Date.now()}`;
  }

  /**
   * Obter conexão (memória ou banco)
   */
  private async getConnection(clientId: string): Promise<EvolutionConnection | null> {
    // Tentar cache primeiro
    let connection = this.connections.get(clientId);
    
    if (!connection) {
      // Buscar do banco de dados
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
      await storage.saveApiConfig('client', clientId, {
        evolutionInstanceId: connectionData.instanceId,
        evolutionConnected: connectionData.isConnected || false,
        evolutionQrCode: connectionData.qrCode || null,
        evolutionPhoneNumber: connectionData.phoneNumber || null,
        evolutionLastConnection: connectionData.lastConnection || null
      });
    } catch (error) {
      console.error(`❌ [Evolution] Erro ao salvar conexão no banco:`, error);
    }
  }

  /**
   * Buscar conexão do banco de dados
   */
  private async getConnectionFromDatabase(clientId: string): Promise<EvolutionConnection | null> {
    try {
      const config = await storage.getApiConfig('client', clientId);
      if (!config?.evolutionInstanceId) {
        return null;
      }

      return {
        clientId,
        instanceId: config.evolutionInstanceId,
        isConnected: config.evolutionConnected || false,
        qrCode: config.evolutionQrCode || undefined,
        phoneNumber: config.evolutionPhoneNumber || undefined,
        lastConnection: config.evolutionLastConnection || undefined
      };
    } catch (error) {
      console.error(`❌ [Evolution] Erro ao buscar conexão do banco:`, error);
      return null;
    }
  }
}

export const evolutionApiService = new EvolutionApiService();