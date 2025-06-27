/**
 * WhatsApp Web Service - Implementação real usando whatsapp-web.js
 * 
 * Este serviço gera QR Codes reais do WhatsApp Web que funcionam 
 * para conectar dispositivos móveis ao sistema.
 */

import { Client, LocalAuth } from 'whatsapp-web.js';
import * as path from 'path';
import * as fs from 'fs';

interface WhatsAppWebSession {
  clientId: string;
  client: Client;
  isConnected: boolean;
  qrCode?: string;
  phoneNumber?: string;
  createdAt: Date;
}

export class WhatsAppWebService {
  private sessions: Map<string, WhatsAppWebSession> = new Map();
  private sessionsPath: string;
  
  constructor() {
    this.sessionsPath = path.join(process.cwd(), 'whatsapp-sessions');
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true });
    }
  }
  
  /**
   * Cria nova sessão WhatsApp Web e gera QR Code real
   */
  async createSession(clientId: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      console.log(`🔄 [WHATSAPP-WEB] Criando sessão real para cliente ${clientId}`);
      
      // Limpar sessão anterior se existir
      await this.disconnect(clientId);
      
      return new Promise((resolve, reject) => {
        let qrCodeGenerated = false;
        let timeoutId: NodeJS.Timeout;
        
        // Timeout de 60 segundos
        timeoutId = setTimeout(() => {
          if (!qrCodeGenerated) {
            console.error(`❌ [WHATSAPP-WEB] Timeout ao gerar QR Code para cliente ${clientId}`);
            resolve({
              success: false,
              error: 'Timeout ao gerar QR Code - tente novamente'
            });
          }
        }, 60000);
        
        // Criar cliente WhatsApp Web
        const client = new Client({
          authStrategy: new LocalAuth({
            clientId: `client_${clientId}`,
            dataPath: this.sessionsPath
          }),
          puppeteer: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--no-first-run',
              '--no-zygote',
              '--disable-gpu',
              '--disable-web-security',
              '--disable-features=VizDisplayCompositor'
            ]
          }
        });
        
        // Evento QR Code - Este é o QR Code REAL do WhatsApp
        client.on('qr', (qr) => {
          if (!qrCodeGenerated) {
            qrCodeGenerated = true;
            clearTimeout(timeoutId);
            
            console.log(`✅ [WHATSAPP-WEB] QR Code REAL gerado para cliente ${clientId}: ${qr.length} chars`);
            
            // Salvar sessão
            const session: WhatsAppWebSession = {
              clientId,
              client,
              isConnected: false,
              qrCode: qr,
              createdAt: new Date()
            };
            
            this.sessions.set(clientId, session);
            
            resolve({
              success: true,
              qrCode: qr
            });
          }
        });
        
        // Evento de conexão pronta
        client.on('ready', () => {
          console.log(`✅ [WHATSAPP-WEB] Cliente conectado para ${clientId}`);
          
          const session = this.sessions.get(clientId);
          if (session) {
            session.isConnected = true;
            // Obter número do telefone
            client.info.wid.user && (session.phoneNumber = client.info.wid.user);
          }
        });
        
        // Evento de desconexão
        client.on('disconnected', (reason) => {
          console.log(`🔌 [WHATSAPP-WEB] Cliente ${clientId} desconectado: ${reason}`);
          const session = this.sessions.get(clientId);
          if (session) {
            session.isConnected = false;
          }
        });
        
        // Evento de erro
        client.on('auth_failure', (message) => {
          console.error(`❌ [WHATSAPP-WEB] Falha de autenticação ${clientId}: ${message}`);
          clearTimeout(timeoutId);
          if (!qrCodeGenerated) {
            resolve({
              success: false,
              error: `Falha de autenticação: ${message}`
            });
          }
        });
        
        // Inicializar cliente
        client.initialize().catch((error) => {
          console.error(`❌ [WHATSAPP-WEB] Erro ao inicializar cliente ${clientId}:`, error);
          clearTimeout(timeoutId);
          if (!qrCodeGenerated) {
            resolve({
              success: false,
              error: `Erro ao inicializar: ${error.message}`
            });
          }
        });
      });
      
    } catch (error) {
      console.error(`❌ [WHATSAPP-WEB] Erro geral para cliente ${clientId}:`, error);
      return {
        success: false,
        error: `Falha ao criar sessão: ${error}`
      };
    }
  }
  
  /**
   * Verifica status da conexão
   */
  async getConnectionStatus(clientId: string): Promise<{
    isConnected: boolean;
    qrCode?: string;
    phoneNumber?: string;
    instanceId?: string;
  }> {
    const session = this.sessions.get(clientId);
    
    if (!session) {
      return { isConnected: false };
    }
    
    // Verificar se cliente ainda está conectado
    if (session.client && session.isConnected) {
      try {
        const state = await session.client.getState();
        session.isConnected = state === 'CONNECTED';
      } catch (error) {
        console.log(`⚠️ [WHATSAPP-WEB] Erro ao verificar conexão ${clientId}:`, error);
        session.isConnected = false;
      }
    }
    
    return {
      isConnected: session.isConnected,
      qrCode: session.qrCode,
      phoneNumber: session.phoneNumber,
      instanceId: `client_${clientId}`
    };
  }
  
  /**
   * Envia mensagem de teste
   */
  async sendMessage(clientId: string, phone: string, message: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    const session = this.sessions.get(clientId);
    
    if (!session || !session.client || !session.isConnected) {
      return {
        success: false,
        error: 'WhatsApp não está conectado'
      };
    }
    
    try {
      const formattedPhone = phone.includes('@') ? phone : `${phone}@c.us`;
      const result = await session.client.sendMessage(formattedPhone, message);
      
      console.log(`✅ [WHATSAPP-WEB] Mensagem enviada para ${phone}:`, result.id._serialized);
      
      return {
        success: true,
        messageId: result.id._serialized
      };
    } catch (error) {
      console.error(`❌ [WHATSAPP-WEB] Erro ao enviar mensagem para ${phone}:`, error);
      return {
        success: false,
        error: `Falha ao enviar mensagem: ${error}`
      };
    }
  }
  
  /**
   * Desconecta sessão
   */
  async disconnect(clientId: string): Promise<boolean> {
    const session = this.sessions.get(clientId);
    
    if (session?.client) {
      try {
        await session.client.destroy();
        console.log(`✅ [WHATSAPP-WEB] Sessão ${clientId} desconectada`);
      } catch (error) {
        console.log(`⚠️ [WHATSAPP-WEB] Erro ao desconectar ${clientId}:`, error);
      }
    }
    
    this.sessions.delete(clientId);
    
    // Limpar arquivos de sessão
    const sessionPath = path.join(this.sessionsPath, `client_${clientId}`);
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🗑️ [WHATSAPP-WEB] Arquivos de sessão ${clientId} removidos`);
      } catch (error) {
        console.log(`⚠️ [WHATSAPP-WEB] Erro ao remover sessão ${clientId}:`, error);
      }
    }
    
    return true;
  }
  
  /**
   * Lista todas as sessões ativas
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }
}

export const whatsappWebService = new WhatsAppWebService();