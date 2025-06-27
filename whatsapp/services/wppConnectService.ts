/**
 * WPPConnect Service - Implementação real do WhatsApp Web
 * 
 * Este serviço usa WPPConnect para conectar ao WhatsApp Web real
 * e gerar QR Codes autênticos que funcionam com o aplicativo.
 */

import * as wppconnect from '@wppconnect-team/wppconnect';
import * as path from 'path';
import * as fs from 'fs';

interface WppSession {
  clientId: string;
  client: any;
  isConnected: boolean;
  qrCode?: string;
  phoneNumber?: string;
  createdAt: Date;
}

export class WppConnectService {
  private sessions: Map<string, WppSession> = new Map();
  private sessionsPath: string;
  
  constructor() {
    this.sessionsPath = path.join(process.cwd(), 'whatsapp-sessions');
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true });
    }
  }
  
  /**
   * Cria nova sessão WhatsApp e gera QR Code autêntico
   */
  async createSession(clientId: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      console.log(`🔄 [WPPCONNECT] Iniciando sessão para cliente ${clientId}`);
      
      // Verificar se já existe sessão válida em memória
      const existingSession = this.sessions.get(clientId);
      if (existingSession && existingSession.isConnected) {
        console.log(`✅ [WPPCONNECT] Sessão já existe e está conectada para ${clientId}`);
        return { success: true };
      }
      
      // Verificar se existe sessão persistente nos arquivos
      const fs = await import('fs');
      const path = await import('path');
      const sessionPath = path.default.join(process.cwd(), 'tokens', `client_${clientId}`);
      
      if (fs.default.existsSync(sessionPath)) {
        console.log(`🔄 [WPPCONNECT] Encontrada sessão persistente, tentando restaurar para ${clientId}`);
        
        try {
          const wppConnect = await import('@wppconnect-team/wppconnect');
          
          // Tentar restaurar sessão existente
          const client = await wppConnect.default.create({
            session: `client_${clientId}`,
            folderNameToken: 'tokens',
            headless: true,
            devtools: false,
            useChrome: false,
            debug: false,
            logQR: false,
            browserWS: '',
            disableWelcome: true,
            updatesLog: false,
            autoClose: 60000,
            createPathFileToken: true,
          });
          
          console.log(`🔗 [WPPCONNECT] Cliente criado, verificando conexão...`);
          
          // Aguardar conexão estabelecer
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Verificar se está conectado
          const hostDevice = await client.getHostDevice();
          
          if (hostDevice && hostDevice.wid && hostDevice.wid.user) {
            // Sessão restaurada com sucesso
            const restoredSession: WppSession = {
              clientId,
              client: client,
              isConnected: true,
              phoneNumber: `+${hostDevice.wid.user}`,
              createdAt: new Date()
            };
            
            this.sessions.set(clientId, restoredSession);
            
            console.log(`✅ [WPPCONNECT] Sessão restaurada automaticamente - número: +${hostDevice.wid.user}`);
            
            return { success: true };
          } else {
            console.log(`⚠️ [WPPCONNECT] Sessão não conectada, gerando novo QR Code`);
          }
          
        } catch (restoreError) {
          console.log(`⚠️ [WPPCONNECT] Erro ao restaurar sessão:`, restoreError);
        }
      }
      
      // Se chegou aqui, precisa gerar novo QR Code
      console.log(`🔄 [WPPCONNECT] Criando nova sessão com QR Code para cliente ${clientId}`);
      
      // Limpar sessão anterior se existir
      await this.disconnect(clientId);
      
      const sessionName = `client_${clientId}`;
      
      return new Promise((resolve, reject) => {
        let qrCodeGenerated = false;
        let timeoutId: NodeJS.Timeout;
        
        // Timeout de 60 segundos
        timeoutId = setTimeout(() => {
          if (!qrCodeGenerated) {
            console.error(`❌ [WPPCONNECT] Timeout ao gerar QR Code para cliente ${clientId}`);
            resolve({
              success: false,
              error: 'Timeout ao gerar QR Code - tente novamente'
            });
          }
        }, 60000);
        
        wppconnect.create({
          session: sessionName,
          folderNameToken: this.sessionsPath,
          headless: true,
          devtools: false,
          useChrome: true,
          debug: false,
          logQR: false,
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
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          },
          catchQR: (base64Qr: string, asciiQR: string, attempts: number, urlCode?: string) => {
            if (!qrCodeGenerated) {
              qrCodeGenerated = true;
              clearTimeout(timeoutId);
              
              console.log(`✅ [WPPCONNECT] QR Code real gerado para cliente ${clientId}: ${base64Qr.length} chars`);
              
              // Salvar sessão
              const session: WppSession = {
                clientId,
                client: null,
                isConnected: false,
                qrCode: base64Qr,
                createdAt: new Date()
              };
              
              this.sessions.set(clientId, session);
              
              resolve({
                success: true,
                qrCode: base64Qr
              });
            }
          },
          statusFind: (statusSession: any, session: string) => {
            console.log(`📱 [WPPCONNECT] Status sessão ${session}: ${statusSession}`);
            
            // Quando conectado, obter informações do cliente
            if (statusSession === 'inChat') {
              const existingSession = this.sessions.get(clientId);
              if (existingSession && existingSession.client) {
                existingSession.isConnected = true;
                
                // Obter número do telefone
                existingSession.client.getHostDevice().then((hostDevice: any) => {
                  if (hostDevice && hostDevice.wid && hostDevice.wid.user) {
                    existingSession.phoneNumber = hostDevice.wid.user;
                    console.log(`✅ [WPPCONNECT] Cliente ${clientId} conectado no número: ${hostDevice.wid.user}`);
                  }
                }).catch((error: any) => {
                  console.log(`⚠️ [WPPCONNECT] Erro ao obter número do telefone:`, error);
                });
              }
            }
          },
          onLoadingScreen: (loading: any, session: string) => {
            console.log(`📱 [WPPCONNECT] Tela carregada ${session}: ${loading}`);
          }
        })
        .then((client) => {
          console.log(`✅ [WPPCONNECT] Cliente conectado para ${clientId}`);
          
          // Atualizar sessão com cliente conectado
          const session = this.sessions.get(clientId);
          if (session) {
            session.client = client;
            session.isConnected = true;
            
            // Obter número do telefone usando API correta
            client.getHostDevice().then((hostDevice: any) => {
              if (hostDevice && hostDevice.wid && hostDevice.wid.user) {
                session.phoneNumber = hostDevice.wid.user;
                console.log(`📱 [WPPCONNECT] Número do telefone detectado: ${hostDevice.wid.user}`);
              }
            }).catch((error: any) => {
              console.log(`⚠️ [WPPCONNECT] Erro ao obter número do telefone:`, error);
            });
          }
          
          // Se ainda não gerou QR Code e já conectou, considerar sucesso
          if (!qrCodeGenerated) {
            qrCodeGenerated = true;
            clearTimeout(timeoutId);
            resolve({
              success: true,
              qrCode: session?.qrCode || 'connected'
            });
          }
        })
        .catch((error) => {
          console.error(`❌ [WPPCONNECT] Erro ao criar sessão ${clientId}:`, error);
          clearTimeout(timeoutId);
          if (!qrCodeGenerated) {
            resolve({
              success: false,
              error: `Erro ao inicializar WhatsApp: ${error.message}`
            });
          }
        });
      });
      
    } catch (error) {
      console.error(`❌ [WPPCONNECT] Erro geral para cliente ${clientId}:`, error);
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
    
    // Se não tem sessão em memória, tentar verificar se existe sessão persistente
    if (!session) {
      console.log(`🔍 [WPPCONNECT] Verificando sessão persistente para cliente ${clientId}`);
      
      try {
        // Tentar usar getStatus do WPPConnect para verificar sessão existente
        const wppConnect = await import('@wppconnect-team/wppconnect');
        const sessionPath = `tokens/client_${clientId}`;
        
        // Verificar se existe arquivo de sessão
        const fs = await import('fs');
        const fsPromises = fs.promises;
        try {
          await fsPromises.access(sessionPath, fs.constants.F_OK);
          console.log(`✅ [WPPCONNECT] Sessão persistente encontrada para ${clientId}`);
          
          // Iniciar processo de restauração automática
          console.log(`🔄 [WPPCONNECT] Iniciando restauração automática da sessão para ${clientId}`);
          
          // Usar createSession para restaurar conexão existente
          const restorationResult = await this.createSession(clientId);
          
          if (restorationResult.success) {
            console.log(`✅ [WPPCONNECT] Sessão restaurada com sucesso para ${clientId}`);
            
            // Verificar se agora existe sessão em memória
            const restoredSession = this.sessions.get(clientId);
            if (restoredSession && restoredSession.isConnected) {
              return {
                isConnected: true,
                phoneNumber: restoredSession.phoneNumber,
                instanceId: `client_${clientId}`
              };
            }
          }
          
          console.log(`⚠️ [WPPCONNECT] Falha na restauração automática para ${clientId}`);
          
          // Retornar QR Code se necessário
          if (restorationResult.qrCode) {
            return {
              isConnected: false,
              qrCode: restorationResult.qrCode,
              instanceId: `client_${clientId}`
            };
          }
          
        } catch (accessError) {
          console.log(`📂 [WPPCONNECT] Nenhuma sessão persistente encontrada para ${clientId}`);
        }
        
      } catch (error) {
        console.log(`⚠️ [WPPCONNECT] Erro ao verificar sessão persistente ${clientId}:`, error);
      }
      
      return { isConnected: false };
    }
    
    // Verificar se cliente ainda está conectado
    if (session.client) {
      try {
        // Tentar obter informações do host device para confirmar conexão
        const hostDevice = await session.client.getHostDevice();
        const isReallyConnected = hostDevice && hostDevice.wid && hostDevice.wid.user;
        
        session.isConnected = !!isReallyConnected;
        
        if (isReallyConnected) {
          session.phoneNumber = hostDevice.wid.user;
          console.log(`📱 [WPPCONNECT] WhatsApp conectado no número: ${hostDevice.wid.user}`);
        } else {
          session.phoneNumber = undefined;
        }
        
      } catch (error) {
        console.log(`⚠️ [WPPCONNECT] Erro ao verificar conexão ${clientId}:`, error);
        session.isConnected = false;
        session.phoneNumber = undefined;
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
   * Retorna sessões ativas em memória
   */
  getActiveSessions(): Map<string, WppSession> {
    return this.sessions;
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
      const result = await session.client.sendText(formattedPhone, message);
      
      console.log(`✅ [WPPCONNECT] Mensagem enviada para ${phone}:`, result.id);
      
      return {
        success: true,
        messageId: result.id
      };
    } catch (error) {
      console.error(`❌ [WPPCONNECT] Erro ao enviar mensagem para ${phone}:`, error);
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
        await session.client.close();
        console.log(`✅ [WPPCONNECT] Sessão ${clientId} desconectada`);
      } catch (error) {
        console.log(`⚠️ [WPPCONNECT] Erro ao desconectar ${clientId}:`, error);
      }
    }
    
    this.sessions.delete(clientId);
    
    // Limpar arquivos de sessão
    const sessionPath = path.join(this.sessionsPath, `client_${clientId}`);
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🗑️ [WPPCONNECT] Arquivos de sessão ${clientId} removidos`);
      } catch (error) {
        console.log(`⚠️ [WPPCONNECT] Erro ao remover sessão ${clientId}:`, error);
      }
    }
    
    return true;
  }
  
  /**
   * Lista todas as sessões ativas
   */
  getActiveSessions(): Map<string, WppSession> {
    return this.sessions;
  }

  /**
   * Obtém status de uma sessão específica
   */
  getSessionStatus(clientId: string): any {
    const session = this.sessions.get(clientId) || this.sessions.get(`client_${clientId}`);
    console.log(`📱 [WPPCONNECT] Status da sessão ${clientId}:`, session);
    
    if (session) {
      return {
        isConnected: session.isConnected,
        status: session.status || 'unknown',
        phoneNumber: session.phoneNumber,
        page: session.page,
        client: session.client
      };
    }
    
    return null;
  }
}

export const wppConnectService = new WppConnectService();