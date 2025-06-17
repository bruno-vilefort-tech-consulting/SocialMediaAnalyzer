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
      console.log(`🔗 Iniciando conexão WPPConnect para cliente ${clientId}...`);

      const sessionName = this.getSessionName(clientId);
      
      // Verificar se já existe sessão ativa
      const existingSession = this.sessions.get(clientId);
      if (existingSession?.config.isConnected) {
        return { 
          success: true, 
          message: `WhatsApp já conectado para cliente ${clientId}` 
        };
      }

      return new Promise((resolve) => {
        let qrCodeGenerated = false;

        wppconnect
          .create({
            session: sessionName,
            catchQR: (base64Qr, asciiQR) => {
              console.log(`📱 QR Code gerado para cliente ${clientId}`);
              qrCodeGenerated = true;
              
              const qrCodeString = `data:image/png;base64,${base64Qr}`;
              
              // Salvar QR Code no Firebase
              this.updateClientConfig(clientId, {
                isConnected: false,
                qrCode: qrCodeString,
                phoneNumber: null,
                lastConnection: null
              });

              resolve({ 
                success: true, 
                qrCode: qrCodeString, 
                message: 'QR Code gerado. Escaneie com WhatsApp para conectar.' 
              });
            },
            statusFind: (statusSession, session) => {
              console.log(`📱 Status WPPConnect para cliente ${clientId}:`, statusSession);
              
              if (statusSession === 'qrReadSuccess') {
                console.log(`✅ QR Code escaneado para cliente ${clientId}`);
              }
              
              if (statusSession === 'chatsAvailable') {
                console.log(`✅ WhatsApp conectado para cliente ${clientId}`);
                
                // Obter informações da sessão
                session.getHostDevice().then((hostDevice: any) => {
                  const phoneNumber = hostDevice.id.user || null;
                  
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

                  // Atualizar configuração no Firebase
                  this.updateClientConfig(clientId, {
                    isConnected: true,
                    qrCode: null,
                    phoneNumber,
                    lastConnection: new Date()
                  });
                }).catch((error: any) => {
                  console.error(`❌ Erro ao obter hostDevice para cliente ${clientId}:`, error);
                });
              }

              if (statusSession === 'disconnectedMobile') {
                console.log(`❌ WhatsApp desconectado para cliente ${clientId}`);
                this.sessions.delete(clientId);
                
                this.updateClientConfig(clientId, {
                  isConnected: false,
                  qrCode: null,
                  phoneNumber: null,
                  lastConnection: null
                });
              }
            },
            logQR: false,
            disableWelcome: true,
            updatesLog: false
          })
          .then((client) => {
            console.log(`🎉 Cliente WPPConnect criado para ${clientId}`);
            
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
            }
          })
          .catch((error) => {
            console.error(`❌ Erro ao criar cliente WPPConnect para ${clientId}:`, error);
            if (!qrCodeGenerated) {
              resolve({ success: false, message: 'Erro ao inicializar WhatsApp' });
            }
          });

        // Timeout para QR Code
        setTimeout(() => {
          if (!qrCodeGenerated) {
            resolve({ success: false, message: 'Timeout ao gerar QR Code' });
          }
        }, 30000);
      });

    } catch (error) {
      console.error(`❌ Erro ao conectar WPPConnect cliente ${clientId}:`, error);
      return { success: false, message: 'Erro interno ao conectar WhatsApp' };
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
      console.log(`💾 Atualizando configuração WPPConnect para cliente ${clientId}:`, updates);
      
      await storage.updateApiConfig('client', clientId, {
        whatsappQrConnected: updates.isConnected,
        whatsappQrQrCode: updates.qrCode,
        whatsappQrPhoneNumber: updates.phoneNumber,
        whatsappQrLastConnection: updates.lastConnection
      });

      console.log(`✅ Configuração WPPConnect atualizada para cliente ${clientId}`);
    } catch (error) {
      console.error(`❌ Erro ao atualizar configuração cliente ${clientId}:`, error);
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