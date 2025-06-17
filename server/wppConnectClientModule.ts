import wppconnect from '@wppconnect-team/wppconnect';
import { storage } from './storage.js';
import path from 'path';
import fs from 'fs';

interface WhatsAppClientConfig {
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
  clientId: string;
}

interface WhatsAppSession {
  client: any;
  config: WhatsAppClientConfig;
}

export class WppConnectClientModule {
  private sessions: Map<string, WhatsAppSession> = new Map();

  constructor() {
    this.ensureTokenDirectory();
  }

  private ensureTokenDirectory() {
    const tokenDir = path.join(process.cwd(), 'tokens');
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }
  }

  private getSessionName(clientId: string): string {
    return `client_${clientId}`;
  }

  async connectClient(clientId: string): Promise<{ success: boolean; qrCode?: string; message: string }> {
    try {
      console.log(`🔗 [DEBUG] Iniciando conexão WPPConnect para cliente ${clientId}...`);
      console.log(`🔗 [DEBUG] Diretório tokens: ${path.join(process.cwd(), 'tokens')}`);

      const sessionName = this.getSessionName(clientId);
      console.log(`🔗 [DEBUG] Nome da sessão: ${sessionName}`);
      
      // Verificar se já existe sessão ativa
      const existingSession = this.sessions.get(clientId);
      if (existingSession?.config.isConnected) {
        console.log(`🔗 [DEBUG] Sessão já conectada para cliente ${clientId}`);
        return { 
          success: true, 
          message: `WhatsApp já conectado para cliente ${clientId}` 
        };
      }

      // Garantir que diretório de tokens existe
      this.ensureTokenDirectory();

      console.log(`🔗 [DEBUG] Iniciando wppconnect.create() para cliente ${clientId}...`);

      return new Promise((resolve, reject) => {
        let qrCodeGenerated = false;
        let resolved = false;

        const resolveOnce = (result: any) => {
          if (!resolved) {
            resolved = true;
            resolve(result);
          }
        };

        try {
          wppconnect
            .create({
              session: sessionName,
              folderNameToken: 'tokens',
              mkdirFolderToken: 'tokens',
              headless: 'new',
              devtools: false,
              useChrome: false,
              debug: false,
              logQR: false,
              browserWS: '',
              browserArgs: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
              ],
              puppeteerOptions: {
                userDataDir: path.join(process.cwd(), 'tokens', sessionName),
                headless: 'new',
                args: [
                  '--no-sandbox',
                  '--disable-setuid-sandbox',
                  '--disable-dev-shm-usage',
                  '--disable-accelerated-2d-canvas',
                  '--no-first-run',
                  '--no-zygote',
                  '--single-process',
                  '--disable-gpu',
                  '--disable-web-security',
                  '--disable-features=VizDisplayCompositor'
                ]
              },
              disableWelcome: true,
              updatesLog: false,
              autoClose: 60000,
              createPathFileToken: true,
              catchQR: (base64Qr: string, asciiQR: string) => {
                console.log(`📱 [DEBUG] QR Code gerado para cliente ${clientId}`);
                console.log(`📱 [DEBUG] QR Base64 length: ${base64Qr.length}`);
                qrCodeGenerated = true;
                
                const qrCodeString = `data:image/png;base64,${base64Qr}`;
                
                // Salvar QR Code no Firebase
                this.updateClientConfig(clientId, {
                  isConnected: false,
                  qrCode: qrCodeString,
                  phoneNumber: null,
                  lastConnection: null
                }).catch(err => console.error(`❌ Erro ao salvar QR no Firebase:`, err));

                resolveOnce({ 
                  success: true, 
                  qrCode: qrCodeString, 
                  message: 'QR Code gerado. Escaneie com WhatsApp para conectar.' 
                });
              },
              statusFind: (statusSession: string, session: any) => {
                console.log(`📱 [DEBUG] Status WPPConnect para cliente ${clientId}:`, statusSession);
                
                if (statusSession === 'qrReadSuccess') {
                  console.log(`✅ [DEBUG] QR Code escaneado para cliente ${clientId}`);
                }
                
                if (statusSession === 'chatsAvailable') {
                  console.log(`✅ [DEBUG] WhatsApp conectado para cliente ${clientId}`);
                  
                  // Obter informações da sessão
                  session.getHostDevice().then((hostDevice: any) => {
                    console.log(`📱 [DEBUG] Host device para cliente ${clientId}:`, hostDevice);
                    const phoneNumber = hostDevice?.id?.user || hostDevice?.wid?._serialized || null;
                    
                    const whatsappSession: WhatsAppSession = {
                      client: session,
                      config: {
                        isConnected: true,
                        qrCode: null,
                        phoneNumber,
                        lastConnection: new Date(),
                        clientId
                      }
                    };

                    this.sessions.set(clientId, whatsappSession);
                    console.log(`💾 [DEBUG] Sessão salva para cliente ${clientId}`);

                    // Atualizar configuração no Firebase
                    this.updateClientConfig(clientId, {
                      isConnected: true,
                      qrCode: null,
                      phoneNumber,
                      lastConnection: new Date()
                    }).catch(err => console.error(`❌ Erro ao atualizar Firebase:`, err));
                  }).catch((error: any) => {
                    console.error(`❌ [DEBUG] Erro ao obter hostDevice para cliente ${clientId}:`, error);
                    // Mesmo com erro no hostDevice, considera conectado
                    const whatsappSession: WhatsAppSession = {
                      client: session,
                      config: {
                        isConnected: true,
                        qrCode: null,
                        phoneNumber: null,
                        lastConnection: new Date(),
                        clientId
                      }
                    };
                    this.sessions.set(clientId, whatsappSession);
                    this.updateClientConfig(clientId, {
                      isConnected: true,
                      qrCode: null,
                      phoneNumber: null,
                      lastConnection: new Date()
                    }).catch(err => console.error(`❌ Erro ao atualizar Firebase:`, err));
                  });
                }

                if (statusSession === 'disconnectedMobile') {
                  console.log(`❌ [DEBUG] WhatsApp desconectado para cliente ${clientId}`);
                  this.sessions.delete(clientId);
                  
                  this.updateClientConfig(clientId, {
                    isConnected: false,
                    qrCode: null,
                    phoneNumber: null,
                    lastConnection: null
                  }).catch(err => console.error(`❌ Erro ao atualizar Firebase:`, err));
                }
              }
            })
            .then((client) => {
              console.log(`🎉 [DEBUG] Cliente WPPConnect criado para ${clientId}`);
              
              // Armazenar cliente na sessão se ainda não foi
              if (!this.sessions.has(clientId)) {
                const whatsappSession: WhatsAppSession = {
                  client,
                  config: {
                    isConnected: true,
                    qrCode: null,
                    phoneNumber: null,
                    lastConnection: new Date(),
                    clientId
                  }
                };

                this.sessions.set(clientId, whatsappSession);
                console.log(`💾 [DEBUG] Sessão criada e salva para cliente ${clientId}`);
              }
            })
            .catch((error) => {
              console.error(`❌ [DEBUG] Erro detalhado ao criar cliente WPPConnect para ${clientId}:`, error);
              console.error(`❌ [DEBUG] Error stack:`, error.stack);
              console.error(`❌ [DEBUG] Error message:`, error.message);
              
              if (!qrCodeGenerated && !resolved) {
                resolveOnce({ 
                  success: false, 
                  message: `Falha ao inicializar conexão WhatsApp: ${error.message || 'Erro desconhecido'}` 
                });
              }
            });

          // Timeout para QR Code
          setTimeout(() => {
            if (!qrCodeGenerated && !resolved) {
              console.log(`⏰ [DEBUG] Timeout ao gerar QR Code para cliente ${clientId}`);
              resolveOnce({ 
                success: false, 
                message: 'Timeout ao gerar QR Code - tente novamente' 
              });
            }
          }, 45000); // Aumentei para 45 segundos

        } catch (syncError) {
          console.error(`❌ [DEBUG] Erro síncrono ao inicializar WPPConnect para cliente ${clientId}:`, syncError);
          resolveOnce({ 
            success: false, 
            message: `Erro ao inicializar: ${syncError.message || 'Erro desconhecido'}` 
          });
        }
      });

    } catch (error) {
      console.error(`❌ [DEBUG] Erro geral ao conectar WPPConnect cliente ${clientId}:`, error);
      return { 
        success: false, 
        message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      };
    }
  }

  async disconnectClient(clientId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔌 Desconectando WPPConnect para cliente ${clientId}...`);

      const session = this.sessions.get(clientId);
      if (session?.client) {
        try {
          await session.client.close();
        } catch (error) {
          console.log(`Erro ao fechar cliente: ${error}`);
        }
      }

      // Remover sessão da memória
      this.sessions.delete(clientId);

      // Limpar tokens salvos
      const sessionName = this.getSessionName(clientId);
      const tokenPath = path.join(process.cwd(), 'tokens', sessionName);
      
      if (fs.existsSync(tokenPath)) {
        fs.rmSync(tokenPath, { recursive: true, force: true });
      }

      // Atualizar configuração no Firebase
      await this.updateClientConfig(clientId, {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null
      });

      console.log(`✅ WPPConnect desconectado para cliente ${clientId}`);
      return { success: true, message: 'WhatsApp desconectado com sucesso' };

    } catch (error) {
      console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
      return { success: false, message: 'Erro ao desconectar WhatsApp' };
    }
  }

  async sendTestMessage(clientId: string, phoneNumber: string, message: string): Promise<{ success: boolean; message: string }> {
    try {
      const session = this.sessions.get(clientId);
      
      if (!session || !session.config.isConnected) {
        return { success: false, message: 'WhatsApp não está conectado' };
      }

      // Formatar número para padrão WhatsApp
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      const whatsappId = `${formattedNumber}@c.us`;

      console.log(`📤 Enviando mensagem teste via WPPConnect para cliente ${clientId}:`, {
        phoneNumber,
        formattedNumber,
        whatsappId,
        message
      });

      await session.client.sendText(whatsappId, message);

      console.log(`✅ Mensagem teste enviada com sucesso para ${phoneNumber}`);
      return { success: true, message: 'Mensagem enviada com sucesso' };

    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem teste para cliente ${clientId}:`, error);
      return { success: false, message: 'Erro ao enviar mensagem de teste' };
    }
  }

  async getClientStatus(clientId: string): Promise<WhatsAppClientConfig> {
    try {
      console.log(`📱 Buscando status WPPConnect para cliente ${clientId}...`);

      // Primeiro verificar se há sessão ativa na memória
      const session = this.sessions.get(clientId);
      if (session) {
        return session.config;
      }

      // Buscar no Firebase
      const apiConfig = await storage.getApiConfig('client', clientId);
      
      return {
        isConnected: apiConfig?.whatsappQrConnected || false,
        qrCode: apiConfig?.whatsappQrQrCode || null,
        phoneNumber: apiConfig?.whatsappQrPhoneNumber || null,
        lastConnection: apiConfig?.whatsappQrLastConnection || null,
        clientId
      };

    } catch (error) {
      console.error(`❌ Erro ao buscar status cliente ${clientId}:`, error);
      return {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null,
        clientId
      };
    }
  }

  private async updateClientConfig(clientId: string, updates: Partial<WhatsAppClientConfig>) {
    try {
      console.log(`💾 [DEBUG] Atualizando configuração WPPConnect para cliente ${clientId}:`, updates);
      
      // Buscar configuração existente primeiro
      const existingConfig = await storage.getApiConfig('client', clientId);
      console.log(`💾 [DEBUG] Configuração existente:`, existingConfig);
      
      // Fazer upsert com dados corretos
      const configData = {
        ...existingConfig,
        whatsappQrConnected: updates.isConnected || false,
        whatsappQrPhoneNumber: updates.phoneNumber || null,
        whatsappQrLastConnection: updates.lastConnection || null
      };
      
      console.log(`💾 [DEBUG] Dados para salvar:`, configData);
      
      await storage.upsertApiConfig('client', clientId, configData);

      console.log(`✅ [DEBUG] Configuração WPPConnect atualizada para cliente ${clientId}`);
    } catch (error) {
      console.error(`❌ [DEBUG] Erro ao atualizar configuração cliente ${clientId}:`, error);
    }
  }

  async clearAllSessions(): Promise<void> {
    console.log('🧹 Limpando todas as sessões WPPConnect...');
    
    for (const [clientId, session] of this.sessions) {
      try {
        if (session.client) {
          await session.client.close();
        }
      } catch (error) {
        console.log(`Erro ao fechar sessão ${clientId}:`, error);
      }
    }
    
    this.sessions.clear();
    console.log('✅ Todas as sessões WPPConnect limpas');
  }
}

export const wppConnectClientModule = new WppConnectClientModule();