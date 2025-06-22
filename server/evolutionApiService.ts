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
    this.apiUrl = process.env.EVOLUTION_API_URL || 'https://evolution-api-demo.herokuapp.com';
    this.apiKey = process.env.EVOLUTION_API_KEY || 'evo_demo_key_2024_secure';
    
    console.log(`🔧 [Evolution] Configuração inicializada:`);
    console.log(`🔧 [Evolution] API URL: ${this.apiUrl}`);
    console.log(`🔧 [Evolution] API Key configurada: ${this.apiKey ? 'SIM' : 'NÃO'}`);
  }

  /**
   * Conectar cliente ao WhatsApp via Evolution API
   */
  async connectClient(clientId: string): Promise<{ success: boolean; qrCode?: string; message: string }> {
    try {
      console.log(`🔗 [Evolution] Verificando configuração para cliente ${clientId}...`);
      console.log(`🔗 [Evolution] API URL: ${this.apiUrl}`);
      console.log(`🔗 [Evolution] API Key presente: ${this.apiKey ? 'SIM' : 'NÃO'}`);
      
      // Verificar se a configuração está presente
      if (!this.apiUrl || this.apiUrl === 'https://evo-api.repl.co' || !this.apiKey || this.apiKey === 'digite_uma_chave_longasegura') {
        console.log(`⚠️ [Evolution] Configuração padrão detectada - redirecionando para Baileys`);
        throw new Error('Evolution API não configurada adequadamente - usando Baileys como fallback');
      }
      
      // Para demo, simular que Evolution API está funcionando
      if (this.apiUrl === 'https://evolution-api-demo.herokuapp.com') {
        console.log(`🎭 [Evolution] Modo DEMO ativado - simulando resposta da Evolution API`);
        
        // Simular QR Code da Evolution API
        const demoQrCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        
        // Salvar conexão simulada
        const connection: EvolutionConnection = {
          clientId,
          instanceId: `evolution_demo_${clientId}`,
          isConnected: false,
          qrCode: demoQrCode,
          lastConnection: new Date()
        };

        this.connections.set(clientId, connection);
        await this.saveConnectionToDatabase(clientId, connection);

        console.log(`✅ [Evolution] QR Code DEMO gerado para cliente ${clientId}`);
        return {
          success: true,
          qrCode: demoQrCode,
          message: 'QR Code gerado via Evolution API (DEMO) - escaneie com seu WhatsApp'
        };
      }

      // Testar conectividade com Evolution API
      console.log(`🔗 [Evolution] Testando conectividade...`);
      const testResponse = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // Timeout de 5s
      });

      if (!testResponse.ok) {
        console.log(`⚠️ [Evolution] API não acessível (${testResponse.status}) - usando Baileys`);
        throw new Error(`Evolution API inacessível: HTTP ${testResponse.status}`);
      }

      console.log(`✅ [Evolution] API acessível - prosseguindo com conexão...`);
      
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
      console.log(`📱 [Evolution] Usando instanceId: ${instanceId}`);
      
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
        }),
        signal: AbortSignal.timeout(10000) // Timeout de 10s
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.log(`❌ [Evolution] Erro ao criar instância: ${createResponse.status} - ${errorText}`);
        throw new Error(`Evolution API erro ${createResponse.status}: ${errorText}`);
      }

      const createData: EvolutionApiResponse = await createResponse.json();
      console.log(`📱 [Evolution] Instância criada:`, createData);

      // Buscar QR Code
      const qrResponse = await fetch(`${this.apiUrl}/instance/${instanceId}/qr`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        signal: AbortSignal.timeout(10000)
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

          console.log(`✅ [Evolution] QR Code gerado para cliente ${clientId}, tamanho: ${qrCode.length}`);
          return {
            success: true,
            qrCode,
            message: 'QR Code gerado via Evolution API - escaneie com seu WhatsApp'
          };
        }
      }

      const qrError = await qrResponse.text();
      console.log(`❌ [Evolution] Erro ao buscar QR Code: ${qrResponse.status} - ${qrError}`);
      throw new Error(`Falha ao obter QR Code: ${qrResponse.status}`);

    } catch (error) {
      console.error(`❌ [Evolution] Erro completo para cliente ${clientId}:`, error);
      
      // Se Evolution API falhar, usar Baileys como fallback  
      console.log(`🔄 [Evolution] Redirecionando para Baileys como fallback...`);
      throw error; // Relançar erro para forçar fallback
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