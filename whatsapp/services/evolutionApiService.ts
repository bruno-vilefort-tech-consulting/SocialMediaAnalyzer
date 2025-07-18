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
  }

  /**
   * Cria uma nova instância WhatsApp para o cliente
   */
  async createInstance(clientId: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      const instanceName = `client_${clientId}_${Date.now()}`;
      
      // Usar WPPConnect para gerar QR Code real do WhatsApp Web
      
      const { wppConnectService } = await import('./wppConnectService');
      
      try {
        // Verificar se já está conectado
        const status = await wppConnectService.getConnectionStatus(clientId);
        
        if (status.isConnected && status.phoneNumber) {
          // Já conectado, atualizar instância
          const instance: EvolutionInstance = {
            clientId,
            instanceId: instanceName,
            token: 'wppconnect_token',
            isConnected: true,
            phoneNumber: status.phoneNumber,
            createdAt: new Date()
          };

          this.instances.set(clientId, instance);
          
          return {
            success: true,
            qrCode: undefined // Não precisa de QR Code se já conectado
          };
        } else if (status.qrCode) {
          // QR Code disponível mas ainda não conectado
          const instance: EvolutionInstance = {
            clientId,
            instanceId: instanceName,
            token: 'wppconnect_token',
            isConnected: false,
            qrCode: status.qrCode,
            createdAt: new Date()
          };

          this.instances.set(clientId, instance);
          
          return {
            success: true,
            qrCode: status.qrCode
          };
        } else {
          // Criar nova sessão
          const result = await wppConnectService.createSession(clientId);
          
          if (result.success && result.qrCode) {
            const instance: EvolutionInstance = {
              clientId,
              instanceId: instanceName,
              token: 'wppconnect_token',
              isConnected: false,
              qrCode: result.qrCode,
              createdAt: new Date()
            };

            this.instances.set(clientId, instance);
            
            return {
              success: true,
              qrCode: result.qrCode
            };
          } else {
            return {
              success: false,
              error: result.error || 'Falha ao criar sessão WhatsApp'
            };
          }
        }
        
      } catch (wppError) {
        return {
          success: false,
          error: `Erro ao inicializar WhatsApp: ${wppError}`
        };
      }


    } catch (error) {
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
            logger: {
              level: 'silent',
              child: () => ({
                level: 'silent',
                trace: () => {},
                debug: () => {},
                info: () => {},
                warn: () => {},
                error: () => {},
                fatal: () => {}
              }),
              trace: () => {},
              debug: () => {},
              info: () => {},
              warn: () => {},
              error: () => {},
              fatal: () => {}
            },
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
              if (sock) sock.end();
              resolve(qr);
              return;
            }
            
            if (connection === 'close') {
              const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
              
              if (!shouldReconnect) {
                if (sock) sock.end();
                reject(new Error('Logout detectado'));
              }
            } else if (connection === 'open') {
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
          if (sock) sock.end();
          reject(error);
        }
      });

    } catch (error) {
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
        return null;
      }

      const data = await response.json();
      
      if (data.qrCode || data.qrcode || data.qr) {
        const qrCode = data.qrCode || data.qrcode || data.qr;
        instance.qrCode = qrCode;
        
        return qrCode;
      }

      return null;

    } catch (error) {
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
      // Verificar status real no WPPConnect
      const { wppConnectService } = await import('./wppConnectService');
      const realStatus = await wppConnectService.getConnectionStatus(clientId);
      
      // Atualizar instância local com status real
      const instance = this.instances.get(clientId);
      if (instance) {
        instance.isConnected = realStatus.isConnected;
        if (realStatus.phoneNumber) {
          instance.phoneNumber = realStatus.phoneNumber;
        }
        // Limpar QR Code se conectado
        if (realStatus.isConnected) {
          instance.qrCode = undefined;
        }
      }
      
      return {
        isConnected: realStatus.isConnected,
        qrCode: realStatus.isConnected ? undefined : realStatus.qrCode,
        phoneNumber: realStatus.phoneNumber,
        instanceId: realStatus.instanceId || `client_${clientId}`,
        lastConnection: instance?.createdAt || new Date()
      };
      
    } catch (error) {
      
      // Fallback para instância local
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
      
      return { success: true };

    } catch (error) {
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
        return;
      }

      switch (event.event) {
        case 'connection.update':
          if (event.data.connection === 'open') {
            instance.isConnected = true;
            instance.phoneNumber = event.data.me?.id?.split(':')[0];
          } else if (event.data.connection === 'close') {
            instance.isConnected = false;
          }
          break;

        case 'qr.updated':
          instance.qrCode = event.data.qr;
          break;

        case 'messages.upsert':
          // Handler para mensagens recebidas
          break;

        default:
          break;
      }

    } catch (error) {
    }
  }
}

export const evolutionApiService = new EvolutionApiService();