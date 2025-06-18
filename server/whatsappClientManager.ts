import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { storage } from './storage';

interface WhatsAppClientSession {
  socket: any | null;
  qrCode: string | null;
  isConnected: boolean;
  phoneNumber: string | null;
  clientId: string;
  lastConnection: Date | null;
}

class WhatsAppClientManager {
  private sessions: Map<string, WhatsAppClientSession> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 3;

  constructor() {
    this.loadSavedSessions();
  }

  private getSessionPath(clientId: string): string {
    return path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}`);
  }

  private async ensureSessionDirectory(clientId: string) {
    const sessionPath = this.getSessionPath(clientId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
  }

  private async saveConnectionStatus(clientId: string, isConnected: boolean, phoneNumber?: string, qrCode?: string) {
    try {
      const config = await storage.getApiConfig('client', clientId) || {};
      
      await storage.upsertApiConfig('client', clientId, {
        ...config,
        whatsappQrConnected: isConnected,
        whatsappQrPhoneNumber: phoneNumber || null,
        whatsappQrCode: qrCode || null,
        whatsappQrLastConnection: isConnected ? new Date() : null,
      });

      console.log(`💾 Status WhatsApp salvo para cliente ${clientId}: conectado=${isConnected}`);
    } catch (error) {
      console.error(`❌ Erro ao salvar status para cliente ${clientId}:`, error);
    }
  }

  private async loadSavedSessions() {
    console.log('🔄 Carregando sessões WhatsApp salvas...');
  }

  async createConnection(clientId: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      console.log(`🔗 Criando conexão WhatsApp para cliente ${clientId}`);

      // Verificar se já existe uma sessão ativa
      const existingSession = this.sessions.get(clientId);
      if (existingSession?.isConnected) {
        console.log(`✅ Cliente ${clientId} já possui conexão ativa`);
        return { 
          success: true, 
          qrCode: existingSession.qrCode || undefined 
        };
      }

      // Limpar sessão anterior se existir
      if (existingSession?.socket) {
        try {
          existingSession.socket.end(undefined);
        } catch (e) {
          console.log(`🧹 Limpeza de socket anterior para cliente ${clientId}`);
        }
      }

      const sessionPath = this.getSessionPath(clientId);
      await this.ensureSessionDirectory(clientId);
      
      // Importar Baileys usando require direto para evitar problemas ES modules
      const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
      
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      let qrCodeGenerated = false;
      let currentQR: string | null = null;

      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: [`Sistema Entrevistas - Cliente ${clientId}`, 'Desktop', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        logger: { level: 'silent' },
        markOnlineOnConnect: false,
      });

      // Inicializar sessão
      const session: WhatsAppClientSession = {
        socket,
        qrCode: null,
        isConnected: false,
        phoneNumber: null,
        clientId,
        lastConnection: null
      };

      this.sessions.set(clientId, session);

      return new Promise((resolve) => {
        let resolved = false;

        // Timeout para gerar QR Code
        const qrTimeout = setTimeout(() => {
          if (!resolved && !qrCodeGenerated) {
            console.log(`⏰ Timeout aguardando QR Code para cliente ${clientId}`);
            resolved = true;
            resolve({
              success: false,
              error: 'Timeout aguardando QR Code'
            });
          }
        }, 15000);

        // Listener para atualizações de conexão
        socket.ev.on('connection.update', async (update: any) => {
          const { connection, lastDisconnect, qr } = update;
          
          if (qr && !resolved) {
            console.log(`📱 QR Code gerado para cliente ${clientId}`);
            try {
              const qrCodeDataURL = await QRCode.toDataURL(qr);
              
              session.qrCode = qrCodeDataURL;
              currentQR = qrCodeDataURL;
              qrCodeGenerated = true;
              
              // Salvar QR no storage
              await this.saveConnectionStatus(clientId, false, undefined, qrCodeDataURL);
              
              clearTimeout(qrTimeout);
              resolved = true;
              resolve({
                success: true,
                qrCode: qrCodeDataURL
              });
              
            } catch (qrError) {
              console.error(`❌ Erro ao gerar QR Code para cliente ${clientId}:`, qrError);
              if (!resolved) {
                clearTimeout(qrTimeout);
                resolved = true;
                resolve({
                  success: false,
                  error: 'Erro ao gerar QR Code'
                });
              }
            }
          }
          
          if (connection === 'close') {
            const { DisconnectReason } = require('@whiskeysockets/baileys');
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`🔌 Conexão fechada para cliente ${clientId}, reconectar:`, shouldReconnect);
            
            if (shouldReconnect && this.reconnectAttempts.get(clientId)! < this.maxReconnectAttempts) {
              const attempts = this.reconnectAttempts.get(clientId) || 0;
              this.reconnectAttempts.set(clientId, attempts + 1);
              console.log(`🔄 Tentativa de reconexão ${attempts + 1}/${this.maxReconnectAttempts} para cliente ${clientId}`);
              setTimeout(() => this.createConnection(clientId), 5000);
            } else {
              await this.saveConnectionStatus(clientId, false);
            }
          } else if (connection === 'open') {
            console.log(`✅ WhatsApp conectado para cliente ${clientId}`);
            session.isConnected = true;
            session.phoneNumber = socket.user?.id?.split(':')[0] || null;
            this.reconnectAttempts.set(clientId, 0);
            
            await this.saveConnectionStatus(clientId, true, session.phoneNumber);
          }
        });

        // Listener para salvar credenciais
        socket.ev.on('creds.update', saveCreds);
      });

    } catch (error) {
      console.error(`❌ Erro ao criar conexão para cliente ${clientId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  async getStatus(clientId: string): Promise<{
    isConnected: boolean;
    phoneNumber: string | null;
    qrCode: string | null;
    hasQrCode: boolean;
  }> {
    try {
      // Verificar sessão em memória primeiro
      const session = this.sessions.get(clientId);
      if (session) {
        return {
          isConnected: session.isConnected,
          phoneNumber: session.phoneNumber,
          qrCode: session.qrCode,
          hasQrCode: !!session.qrCode
        };
      }

      // Buscar no storage
      const config = await storage.getApiConfig('client', clientId);
      if (config) {
        return {
          isConnected: config.whatsappQrConnected || false,
          phoneNumber: config.whatsappQrPhoneNumber || null,
          qrCode: config.whatsappQrCode || null,
          hasQrCode: !!config.whatsappQrCode
        };
      }

      return {
        isConnected: false,
        phoneNumber: null,
        qrCode: null,
        hasQrCode: false
      };
    } catch (error) {
      console.error(`❌ Erro ao buscar status para cliente ${clientId}:`, error);
      return {
        isConnected: false,
        phoneNumber: null,
        qrCode: null,
        hasQrCode: false
      };
    }
  }

  async disconnect(clientId: string): Promise<boolean> {
    try {
      const session = this.sessions.get(clientId);
      if (session?.socket) {
        session.socket.end(undefined);
        session.isConnected = false;
        session.phoneNumber = null;
        session.qrCode = null;
        
        await this.saveConnectionStatus(clientId, false);
        console.log(`🔌 Cliente ${clientId} desconectado com sucesso`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
      return false;
    }
  }

  async sendMessage(clientId: string, phoneNumber: string, message: string): Promise<boolean> {
    try {
      const session = this.sessions.get(clientId);
      if (!session?.socket || !session.isConnected) {
        console.error(`❌ Cliente ${clientId} não está conectado`);
        return false;
      }

      // Formatar número para WhatsApp
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      const jid = `${formattedNumber}@s.whatsapp.net`;

      await session.socket.sendMessage(jid, { text: message });
      console.log(`✅ Mensagem enviada via cliente ${clientId} para ${phoneNumber}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via cliente ${clientId}:`, error);
      return false;
    }
  }

  private async cleanSession(clientId: string): Promise<void> {
    try {
      const sessionPath = this.getSessionPath(clientId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🧹 Sessão limpa para cliente ${clientId}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao limpar sessão para cliente ${clientId}:`, error);
    }
  }

  async cleanAllSessions(): Promise<void> {
    for (const [clientId, session] of this.sessions) {
      if (session.socket) {
        try {
          session.socket.end(undefined);
        } catch (e) {
          console.log(`🧹 Limpeza de socket para cliente ${clientId}`);
        }
      }
      await this.cleanSession(clientId);
    }
    this.sessions.clear();
    this.reconnectAttempts.clear();
    console.log('🧹 Todas as sessões WhatsApp foram limpas');
  }
}

export const whatsappClientManager = new WhatsAppClientManager();