import { create, Whatsapp } from '@wppconnect-team/wppconnect';
import { storage } from './storage.js';

interface ClientSession {
  client: Whatsapp;
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
}

class SimpleWppConnectClient {
  private sessions: Map<string, ClientSession> = new Map();
  private connectionPromises: Map<string, Promise<any>> = new Map();

  async connectClient(clientId: string): Promise<{ success: boolean; qrCode?: string; message: string }> {
    try {
      console.log(`🔗 [WPPConnect] Iniciando conexão para cliente ${clientId}...`);

      // Verificar se já existe uma promessa de conexão
      if (this.connectionPromises.has(clientId)) {
        console.log(`⏳ [WPPConnect] Aguardando conexão em andamento para cliente ${clientId}...`);
        return await this.connectionPromises.get(clientId)!;
      }

      // Criar nova promessa de conexão
      const connectionPromise = this.createClientConnection(clientId);
      this.connectionPromises.set(clientId, connectionPromise);

      try {
        const result = await connectionPromise;
        return result;
      } finally {
        this.connectionPromises.delete(clientId);
      }

    } catch (error) {
      console.error(`❌ [WPPConnect] Erro ao conectar cliente ${clientId}:`, error);
      this.connectionPromises.delete(clientId);
      return { success: false, message: 'Erro ao iniciar conexão WhatsApp' };
    }
  }

  private async createClientConnection(clientId: string): Promise<{ success: boolean; qrCode?: string; message: string }> {
    return new Promise(async (resolve) => {
      let qrCodeGenerated = false;
      let resolved = false;

      const resolveOnce = (result: any) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      try {
        const sessionName = `client_${clientId}_${Date.now()}`;
        
        console.log(`📱 [WPPConnect] Criando sessão: ${sessionName}`);

        const client = await create({
          session: sessionName,
          puppeteerOptions: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--no-first-run',
              '--no-zygote',
              '--disable-gpu'
            ],
          },
          autoClose: 300000, // 5 minutos
          logQR: false,
          disableWelcome: true,
          updatesLog: false
        })
        .then(async (client) => {
          console.log(`✅ [WPPConnect] Cliente criado para ${clientId}`);
          
          // Salvar sessão
          const session: ClientSession = {
            client,
            isConnected: true,
            qrCode: null,
            phoneNumber: null,
            lastConnection: new Date()
          };

          this.sessions.set(clientId, session);

          // Atualizar configuração no Firebase
          await this.updateClientConfig(clientId, {
            isConnected: true,
            qrCode: null,
            phoneNumber: client.getWid()?.user || null,
            lastConnection: new Date()
          });

          if (!resolved) {
            resolveOnce({ 
              success: true, 
              message: 'WhatsApp conectado com sucesso!' 
            });
          }

          return client;
        })
        .catch(async (error) => {
          console.error(`❌ [WPPConnect] Erro ao criar cliente:`, error);
          if (!resolved) {
            resolveOnce({ 
              success: false, 
              message: `Erro na conexão: ${error.message || 'Erro desconhecido'}` 
            });
          }
        });

        // Event listeners para QR Code
        if (client) {
          client.onLoadingScreen((percent: number, message: string) => {
            console.log(`📱 [WPPConnect] Loading: ${percent}% - ${message}`);
          });

          client.onQRCode((base64Qr: string, asciiQR: string, attempts: number) => {
            console.log(`📱 [WPPConnect] QR Code gerado (tentativa ${attempts})`);
            qrCodeGenerated = true;

            // Salvar QR Code no Firebase
            this.updateClientConfig(clientId, {
              isConnected: false,
              qrCode: base64Qr,
              phoneNumber: null,
              lastConnection: null
            });

            if (!resolved) {
              resolveOnce({ 
                success: true, 
                qrCode: base64Qr,
                message: 'QR Code gerado - escaneie com seu WhatsApp' 
              });
            }
          });

          client.onStateChange((state: string) => {
            console.log(`📱 [WPPConnect] Estado mudou para: ${state}`);
            
            if (state === 'CONNECTED' && !resolved) {
              resolveOnce({ 
                success: true, 
                message: 'WhatsApp conectado com sucesso!' 
              });
            }
          });
        }

        // Timeout para QR Code
        setTimeout(() => {
          if (!qrCodeGenerated && !resolved) {
            console.log(`⏰ [WPPConnect] Timeout - QR Code não foi gerado`);
            resolveOnce({ 
              success: false, 
              message: 'Timeout - tente novamente' 
            });
          }
        }, 45000);

      } catch (error) {
        console.error(`❌ [WPPConnect] Erro ao inicializar:`, error);
        resolveOnce({ 
          success: false, 
          message: 'Erro ao inicializar conexão' 
        });
      }
    });
  }

  async disconnectClient(clientId: string): Promise<{ success: boolean; message: string }> {
    try {
      const session = this.sessions.get(clientId);
      
      if (session && session.client) {
        await session.client.close();
      }

      this.sessions.delete(clientId);

      // Atualizar configuração no Firebase
      await this.updateClientConfig(clientId, {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null
      });

      console.log(`✅ [WPPConnect] Cliente ${clientId} desconectado`);
      return { success: true, message: 'WhatsApp desconectado com sucesso' };

    } catch (error) {
      console.error(`❌ [WPPConnect] Erro ao desconectar cliente ${clientId}:`, error);
      return { success: false, message: 'Erro ao desconectar WhatsApp' };
    }
  }

  async sendTestMessage(clientId: string, phoneNumber: string, message: string): Promise<{ success: boolean; message: string }> {
    try {
      const session = this.sessions.get(clientId);
      
      if (!session || !session.isConnected) {
        return { success: false, message: 'WhatsApp não está conectado' };
      }

      const formattedNumber = phoneNumber.replace(/\D/g, '');
      const whatsappId = `${formattedNumber}@c.us`;

      await session.client.sendText(whatsappId, message);

      console.log(`✅ [WPPConnect] Mensagem enviada para ${phoneNumber}`);
      return { success: true, message: 'Mensagem enviada com sucesso' };

    } catch (error) {
      console.error(`❌ [WPPConnect] Erro ao enviar mensagem:`, error);
      return { success: false, message: 'Erro ao enviar mensagem' };
    }
  }

  async getClientStatus(clientId: string) {
    try {
      // Verificar sessão na memória
      const session = this.sessions.get(clientId);
      if (session) {
        return {
          isConnected: session.isConnected,
          qrCode: session.qrCode,
          phoneNumber: session.phoneNumber,
          lastConnection: session.lastConnection
        };
      }

      // Buscar no Firebase
      const apiConfig = await storage.getApiConfig('client', clientId);
      
      return {
        isConnected: apiConfig?.whatsappQrConnected || false,
        qrCode: apiConfig?.whatsappQrCode || null,
        phoneNumber: apiConfig?.whatsappQrPhoneNumber || null,
        lastConnection: apiConfig?.whatsappQrLastConnection || null
      };

    } catch (error) {
      console.error(`❌ [WPPConnect] Erro ao buscar status:`, error);
      return {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null
      };
    }
  }

  private async updateClientConfig(clientId: string, updates: any) {
    try {
      const existingConfig = await storage.getApiConfig('client', clientId);
      
      const configData = {
        ...existingConfig,
        whatsappQrConnected: updates.isConnected || false,
        whatsappQrCode: updates.qrCode || null,
        whatsappQrPhoneNumber: updates.phoneNumber || null,
        whatsappQrLastConnection: updates.lastConnection || null
      };
      
      await storage.upsertApiConfig('client', clientId, configData);
      console.log(`💾 [WPPConnect] Configuração atualizada para cliente ${clientId}`);

    } catch (error) {
      console.error(`❌ [WPPConnect] Erro ao atualizar configuração:`, error);
    }
  }

  async clearAllSessions(): Promise<void> {
    for (const [clientId, session] of this.sessions) {
      try {
        if (session.client) {
          await session.client.close();
        }
      } catch (error) {
        console.error(`Erro ao fechar sessão ${clientId}:`, error);
      }
    }
    this.sessions.clear();
    this.connectionPromises.clear();
  }
}

export const simpleWppConnectClient = new SimpleWppConnectClient();