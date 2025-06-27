/**
 * Evolution API Service - Implementação completa baseada no GitHub oficial
 * 
 * Este serviço gerencia conexões WhatsApp via Evolution API com isolamento por cliente.
 * Cada cliente possui sua própria instância isolada.
 */

interface EvolutionInstance {
  clientId: string;
  instanceId: string;
  token: string;
  isConnected: boolean;
  phoneNumber?: string;
  qrCode?: string;
  createdAt: Date;
}

interface EvolutionApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface CreateInstanceRequest {
  name: string;
  webhook?: string;
  webhookEvents?: string[];
}

interface SendMessageRequest {
  number: string;
  message: string;
}

export class EvolutionApiService {
  private instances: Map<string, EvolutionInstance> = new Map();
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:5000';
    this.apiKey = process.env.EVOLUTION_API_KEY || 'default_api_key';
    console.log(`🔧 [EVOLUTION] Configurado para usar: ${this.apiUrl}`);
  }

  /**
   * Cria uma nova instância WhatsApp para o cliente
   */
  async createInstance(clientId: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      const instanceName = `client_${clientId}_${Date.now()}`;
      
      // Usar WPPConnect para gerar QR Code real do WhatsApp Web
      console.log(`🔄 [EVOLUTION] Criando sessão WhatsApp real para cliente ${clientId}`);
      
      const { wppConnectService } = await import('./wppConnectService');
      
      try {
        // Criar sessão real com WPPConnect
        const result = await wppConnectService.createSession(clientId);
        
        if (result.success && result.qrCode) {
          // Criar instância com QR Code real
          const instance: EvolutionInstance = {
            clientId,
            instanceId: instanceName,
            token: 'wppconnect_token',
            isConnected: false,
            qrCode: result.qrCode,
            createdAt: new Date()
          };

          this.instances.set(clientId, instance);
          
          console.log(`✅ [EVOLUTION] QR Code REAL gerado via WPPConnect para cliente ${clientId}: ${result.qrCode.length} chars`);
          return {
            success: true,
            qrCode: result.qrCode
          };
        } else {
          console.error(`❌ [EVOLUTION] WPPConnect falhou para cliente ${clientId}:`, result.error);
          return {
            success: false,
            error: result.error || 'Falha ao criar sessão WhatsApp'
          };
        }
        
      } catch (wppError) {
        console.error(`❌ [EVOLUTION] Erro WPPConnect para cliente ${clientId}:`, wppError);
        return {
          success: false,
          error: `Erro ao inicializar WhatsApp: ${wppError}`
        };
      }

      // Fallback para Baileys - gerar QR Code autêntico
      console.log(`🔄 [EVOLUTION] Gerando QR Code autêntico via Baileys para cliente ${clientId}`);
      
      const qrCode = await this.generateAuthenticQRCode(clientId);
      
      if (qrCode) {
        const instance: EvolutionInstance = {
          clientId,
          instanceId: instanceName,
          token: 'baileys_token',
          isConnected: false,
          qrCode,
          createdAt: new Date()
        };

        this.instances.set(clientId, instance);
        
        console.log(`✅ [EVOLUTION] QR Code autêntico gerado via Baileys para cliente ${clientId}`);
        
        return {
          success: true,
          qrCode: qrCode
        };
      }

      return {
        success: false,
        error: 'Falha ao gerar QR Code autêntico'
      };

    } catch (error) {
      console.error(`❌ [EVOLUTION] Erro ao criar instância para cliente ${clientId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Gera QR Code autêntico usando Baileys
   */
  private async generateAuthenticQRCode(clientId: string): Promise<string | null> {
    try {
      // Importar Baileys dinamicamente
      const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await import('@whiskeysockets/baileys');
      const { Boom } = await import('@hapi/boom');
      
      return new Promise(async (resolve, reject) => {
        let sock: any = null;
        
        try {
          const sessionsPath = `whatsapp-sessions/client_${clientId}`;
          
          // Criar estado de autenticação
          const { state, saveCreds } = await useMultiFileAuthState(sessionsPath);
          
          // Criar socket WhatsApp
          sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: { level: 'silent' },
            browser: ['WhatsApp Business', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            fireInitQueries: true
          });

          sock.ev.on('creds.update', saveCreds);

          sock.ev.on('connection.update', (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
              console.log(`📱 [BAILEYS] QR Code autêntico gerado para cliente ${clientId} (${qr.length} chars)`);
              if (sock) sock.end();
              resolve(qr);
              return;
            }
            
            if (connection === 'close') {
              const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
              
              if (!shouldReconnect) {
                console.log(`🔌 [BAILEYS] Cliente ${clientId} logout detectado`);
                if (sock) sock.end();
                reject(new Error('Logout detectado'));
              }
            } else if (connection === 'open') {
              console.log(`✅ [BAILEYS] Cliente ${clientId} conectado com sucesso`);
              if (sock) sock.end();
              resolve(null); // Já conectado, não precisa de QR
            }
          });

          // Timeout para QR Code
          setTimeout(() => {
            if (sock) sock.end();
            reject(new Error('Timeout ao gerar QR Code'));
          }, 30000);

        } catch (error) {
          console.error(`❌ [BAILEYS] Erro ao configurar socket para cliente ${clientId}:`, error);
          if (sock) sock.end();
          reject(error);
        }
      });

    } catch (error) {
      console.error(`❌ [BAILEYS] Erro ao importar dependências:`, error);
      return null;
    }
  }

  /**
   * Obtém QR Code para uma instância
   */
  async getQRCode(clientId: string): Promise<string | null> {
    try {
      const instance = this.instances.get(clientId);
      if (!instance) {
        console.log(`❌ [EVOLUTION] Instância não encontrada para cliente ${clientId}`);
        return null;
      }

      const response = await fetch(`${this.apiUrl}/instance/${instance.instanceId}/qr`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'token': instance.token
        }
      });

      if (!response.ok) {
        console.log(`❌ [EVOLUTION] Erro ao obter QR Code: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (data.qrCode || data.qrcode || data.qr) {
        const qrCode = data.qrCode || data.qrcode || data.qr;
        instance.qrCode = qrCode;
        
        console.log(`📱 [EVOLUTION] QR Code obtido para cliente ${clientId} (${qrCode.length} chars)`);
        return qrCode;
      }

      return null;

    } catch (error) {
      console.error(`❌ [EVOLUTION] Erro ao obter QR Code para cliente ${clientId}:`, error);
      return null;
    }
  }

  /**
   * Verifica status da conexão de uma instância
   */
  async getConnectionStatus(clientId: string): Promise<{ 
    isConnected: boolean; 
    phoneNumber?: string; 
    qrCode?: string; 
    instanceId?: string; 
    lastConnection?: Date; 
  }> {
    try {
      const instance = this.instances.get(clientId);
      if (!instance) {
        return { isConnected: false };
      }

      const response = await fetch(`${this.apiUrl}/instance/${instance.instanceId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'token': instance.token
        }
      });

      if (!response.ok) {
        return { 
          isConnected: false,
          instanceId: instance.instanceId,
          qrCode: instance.qrCode
        };
      }

      const data = await response.json();
      
      const isConnected = data.connection === 'open' || data.status === 'connected';
      const phoneNumber = data.me?.id?.split(':')[0] || data.phoneNumber;
      
      // Atualizar estado local
      instance.isConnected = isConnected;
      if (phoneNumber) {
        instance.phoneNumber = phoneNumber;
      }

      // Se não conectado, tentar obter QR Code
      if (!isConnected && !instance.qrCode) {
        const qrCode = await this.getQRCode(clientId);
        if (qrCode) {
          instance.qrCode = qrCode;
        }
      }

      return {
        isConnected,
        phoneNumber,
        qrCode: instance.qrCode,
        instanceId: instance.instanceId,
        lastConnection: instance.isConnected ? new Date() : undefined
      };

    } catch (error) {
      console.error(`❌ [EVOLUTION] Erro ao verificar status para cliente ${clientId}:`, error);
      const instance = this.instances.get(clientId);
      return { 
        isConnected: false,
        instanceId: instance?.instanceId,
        qrCode: instance?.qrCode
      };
    }
  }

  /**
   * Envia mensagem via Evolution API
   */
  async sendMessage(clientId: string, phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const instance = this.instances.get(clientId);
      if (!instance) {
        return {
          success: false,
          error: 'Instância não encontrada para este cliente'
        };
      }

      // Verificar se está conectado
      const status = await this.getConnectionStatus(clientId);
      if (!status.isConnected) {
        return {
          success: false,
          error: 'WhatsApp não conectado para este cliente'
        };
      }

      const response = await fetch(`${this.apiUrl}/message/text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'token': instance.token
        },
        body: JSON.stringify({
          number: phoneNumber,
          message: message
        } as SendMessageRequest)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success !== false && data.messageId) {
        console.log(`✅ [EVOLUTION] Mensagem enviada para ${phoneNumber} via cliente ${clientId}:`, data.messageId);
        return {
          success: true,
          messageId: data.messageId
        };
      }

      return {
        success: false,
        error: data.error || 'Falha ao enviar mensagem'
      };

    } catch (error) {
      console.error(`❌ [EVOLUTION] Erro ao enviar mensagem via cliente ${clientId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Remove instância do cliente
   */
  async deleteInstance(clientId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const instance = this.instances.get(clientId);
      if (!instance) {
        return { success: true }; // Já removida
      }

      const response = await fetch(`${this.apiUrl}/instance/${instance.instanceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'token': instance.token
        }
      });

      // Remover do mapa local independentemente da resposta da API
      this.instances.delete(clientId);
      
      console.log(`🗑️ [EVOLUTION] Instância removida para cliente ${clientId}`);
      
      return { success: true };

    } catch (error) {
      console.error(`❌ [EVOLUTION] Erro ao remover instância para cliente ${clientId}:`, error);
      // Ainda assim remove localmente
      this.instances.delete(clientId);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Conecta cliente - alias para createInstance para compatibilidade
   */
  async connectClient(clientId: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    return await this.createInstance(clientId);
  }

  /**
   * Desconecta cliente - alias para deleteInstance para compatibilidade
   */
  async disconnectClient(clientId: string): Promise<{ success: boolean; error?: string }> {
    return await this.deleteInstance(clientId);
  }

  /**
   * Lista todas as instâncias ativas
   */
  getInstances(): EvolutionInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Obtém instância específica por cliente
   */
  getInstance(clientId: string): EvolutionInstance | undefined {
    return this.instances.get(clientId);
  }

  /**
   * Webhook handler para eventos da Evolution API
   */
  async handleWebhook(clientId: string, event: any): Promise<void> {
    try {
      const instance = this.instances.get(clientId);
      if (!instance) {
        console.log(`⚠️ [EVOLUTION] Webhook recebido para cliente inexistente: ${clientId}`);
        return;
      }

      switch (event.event) {
        case 'connection.update':
          if (event.data.connection === 'open') {
            instance.isConnected = true;
            instance.phoneNumber = event.data.me?.id?.split(':')[0];
            console.log(`✅ [EVOLUTION] Cliente ${clientId} conectado: ${instance.phoneNumber}`);
          } else if (event.data.connection === 'close') {
            instance.isConnected = false;
            console.log(`❌ [EVOLUTION] Cliente ${clientId} desconectado`);
          }
          break;

        case 'qr.updated':
          instance.qrCode = event.data.qr;
          console.log(`📱 [EVOLUTION] QR Code atualizado para cliente ${clientId}`);
          break;

        case 'messages.upsert':
          // Handler para mensagens recebidas
          console.log(`📨 [EVOLUTION] Nova mensagem para cliente ${clientId}:`, event.data);
          break;

        default:
          console.log(`📝 [EVOLUTION] Evento não tratado para cliente ${clientId}:`, event.event);
      }

    } catch (error) {
      console.error(`❌ [EVOLUTION] Erro ao processar webhook para cliente ${clientId}:`, error);
    }
  }
}

export const evolutionApiService = new EvolutionApiService();