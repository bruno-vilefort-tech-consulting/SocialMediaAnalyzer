import { create, Whatsapp } from '@wppconnect-team/wppconnect';
import { storage } from './storage';
import path from 'path';
import fs from 'fs';

interface WppConnectClientSession {
  client: Whatsapp | null;
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  clientId: string;
  lastConnection: Date | null;
  isConnecting: boolean;
}

class WppConnectClientManager {
  private sessions: Map<string, WppConnectClientSession> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 3;

  constructor() {
    console.log('🔧 WppConnectClientManager inicializado');
  }

  private getSessionPath(clientId: string): string {
    return path.join(process.cwd(), 'whatsapp-sessions', `wppconnect_client_${clientId}`);
  }

  private async ensureSessionDirectory(clientId: string) {
    const sessionPath = this.getSessionPath(clientId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
      console.log(`📁 Diretório de sessão criado: ${sessionPath}`);
    }
  }

  private async saveConnectionStatus(clientId: string, isConnected: boolean, phoneNumber?: string, qrCode?: string) {
    try {
      const updates: any = {
        whatsappQrConnected: isConnected,
        whatsappQrLastConnection: isConnected ? new Date() : null,
      };

      if (phoneNumber) {
        updates.whatsappQrPhoneNumber = phoneNumber;
      }

      if (qrCode) {
        updates.whatsappQrCode = qrCode;
      } else if (isConnected) {
        updates.whatsappQrCode = null; // Limpar QR quando conectado
      }

      await storage.upsertApiConfig('client', parseInt(clientId), updates);
      console.log(`💾 Status WhatsApp salvo para cliente ${clientId}: ${isConnected ? 'conectado' : 'desconectado'}`);
    } catch (error) {
      console.error(`❌ Erro ao salvar status WhatsApp para cliente ${clientId}:`, error);
    }
  }

  async createConnection(clientId: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    console.log(`🔄 Iniciando conexão WppConnect para cliente ${clientId}`);

    try {
      // Limpar sessão existente se houver
      await this.cleanSession(clientId);

      const sessionPath = this.getSessionPath(clientId);
      await this.ensureSessionDirectory(clientId);

      let qrCodeGenerated = false;
      let currentQR: string | null = null;

      // Inicializar sessão
      const session: WppConnectClientSession = {
        client: null,
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        clientId,
        lastConnection: null,
        isConnecting: true,
      };

      this.sessions.set(clientId, session);
      this.reconnectAttempts.set(clientId, 0);

      return new Promise((resolve) => {
        let resolved = false;

        // Timeout para conexão
        const connectionTimeout = setTimeout(() => {
          if (!resolved) {
            console.log(`⏰ Timeout na conexão WppConnect para cliente ${clientId}`);
            resolved = true;
            resolve({
              success: qrCodeGenerated,
              qrCode: currentQR || undefined,
              error: qrCodeGenerated ? undefined : 'Timeout aguardando QR Code'
            });
          }
        }, 30000);

        // Criar cliente WppConnect
        create({
          session: `client_${clientId}`,
          catchQR: (base64QrImg, asciiQR, attempts, urlCode) => {
            console.log(`📱 QR Code gerado para cliente ${clientId} (tentativa ${attempts})`);
            currentQR = base64QrImg;
            qrCodeGenerated = true;
            
            // Atualizar sessão com QR Code
            const currentSession = this.sessions.get(clientId);
            if (currentSession) {
              currentSession.qrCode = base64QrImg;
              this.sessions.set(clientId, currentSession);
            }

            // Salvar QR Code no banco
            this.saveConnectionStatus(clientId, false, undefined, base64QrImg);

            if (!resolved) {
              resolved = true;
              clearTimeout(connectionTimeout);
              resolve({
                success: true,
                qrCode: base64QrImg
              });
            }
          },
          statusFind: (statusSession, session) => {
            console.log(`📊 Status WppConnect para cliente ${clientId}:`, statusSession);
            
            const currentSession = this.sessions.get(clientId);
            if (currentSession) {
              if (statusSession === 'qrReadSuccess' || statusSession === 'isLogged') {
                currentSession.isConnected = true;
                currentSession.isConnecting = false;
                currentSession.lastConnection = new Date();
                currentSession.qrCode = null;
                this.sessions.set(clientId, currentSession);
                
                // Salvar status conectado
                this.saveConnectionStatus(clientId, true, session);
                console.log(`✅ Cliente ${clientId} conectado com sucesso via WppConnect`);
              } else if (statusSession === 'notLogged' || statusSession === 'browserClose') {
                currentSession.isConnected = false;
                currentSession.isConnecting = false;
                this.sessions.set(clientId, currentSession);
                
                this.saveConnectionStatus(clientId, false);
                console.log(`❌ Cliente ${clientId} desconectado`);
              }
            }
          },
          folderNameToken: sessionPath,
          mkdirFolderToken: sessionPath,
          headless: true,
          devtools: false,
          useChrome: true,
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
            '--disable-gpu'
          ],
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
            ]
          }
        })
        .then((client) => {
          console.log(`🎯 Cliente WppConnect criado para ${clientId}`);
          const currentSession = this.sessions.get(clientId);
          if (currentSession) {
            currentSession.client = client;
            this.sessions.set(clientId, currentSession);
          }
        })
        .catch((error) => {
          console.error(`❌ Erro ao criar cliente WppConnect para ${clientId}:`, error);
          if (!resolved) {
            resolved = true;
            clearTimeout(connectionTimeout);
            resolve({
              success: false,
              error: `Erro na inicialização: ${error.message}`
            });
          }
        });
      });

    } catch (error) {
      console.error(`❌ Erro geral na conexão WppConnect para cliente ${clientId}:`, error);
      return {
        success: false,
        error: `Erro geral: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async getStatus(clientId: string): Promise<{
    isConnected: boolean;
    qrCode: string | null;
    phoneNumber: string | null;
    lastConnection: Date | null;
    isConnecting: boolean;
  }> {
    const session = this.sessions.get(clientId);
    
    if (!session) {
      // Buscar status do banco de dados
      try {
        const apiConfig = await storage.getApiConfig('client', parseInt(clientId));
        return {
          isConnected: apiConfig?.whatsappQrConnected || false,
          qrCode: apiConfig?.whatsappQrCode || null,
          phoneNumber: apiConfig?.whatsappQrPhoneNumber || null,
          lastConnection: apiConfig?.whatsappQrLastConnection || null,
          isConnecting: false,
        };
      } catch (error) {
        console.error(`❌ Erro ao buscar status do cliente ${clientId}:`, error);
        return {
          isConnected: false,
          qrCode: null,
          phoneNumber: null,
          lastConnection: null,
          isConnecting: false,
        };
      }
    }

    return {
      isConnected: session.isConnected,
      qrCode: session.qrCode,
      phoneNumber: session.phoneNumber,
      lastConnection: session.lastConnection,
      isConnecting: session.isConnecting,
    };
  }

  async disconnect(clientId: string): Promise<boolean> {
    try {
      const session = this.sessions.get(clientId);
      
      if (session?.client) {
        await session.client.close();
        console.log(`🔌 Cliente ${clientId} desconectado via WppConnect`);
      }

      await this.cleanSession(clientId);
      await this.saveConnectionStatus(clientId, false);
      
      return true;
    } catch (error) {
      console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
      return false;
    }
  }

  async sendMessage(clientId: string, phoneNumber: string, message: string): Promise<boolean> {
    try {
      const session = this.sessions.get(clientId);
      
      if (!session?.client || !session.isConnected) {
        console.log(`❌ Cliente ${clientId} não está conectado para envio de mensagem`);
        return false;
      }

      // Formatar número de telefone
      const formattedPhone = phoneNumber.replace(/\D/g, '');
      const phoneWithSuffix = formattedPhone + '@c.us';

      const result = await session.client.sendText(phoneWithSuffix, message);
      console.log(`✅ Mensagem enviada via WppConnect para ${phoneNumber} (cliente ${clientId}):`, result.id);
      
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via WppConnect (cliente ${clientId}):`, error);
      return false;
    }
  }

  private async cleanSession(clientId: string): Promise<void> {
    try {
      // Remover da memória
      this.sessions.delete(clientId);
      this.reconnectAttempts.delete(clientId);
      
      // Limpar arquivos de sessão
      const sessionPath = this.getSessionPath(clientId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🗑️ Arquivos de sessão removidos para cliente ${clientId}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao limpar sessão do cliente ${clientId}:`, error);
    }
  }

  async cleanAllSessions(): Promise<void> {
    console.log('🧹 Limpando todas as sessões WppConnect...');
    
    for (const [clientId] of this.sessions) {
      await this.disconnect(clientId);
    }
    
    this.sessions.clear();
    this.reconnectAttempts.clear();
    
    console.log('✅ Todas as sessões WppConnect limpas');
  }
}

export const wppConnectClientManager = new WppConnectClientManager();