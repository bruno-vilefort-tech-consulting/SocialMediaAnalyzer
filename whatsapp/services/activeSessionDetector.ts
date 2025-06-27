/**
 * Active Session Detector - Detecta conexões WhatsApp ativas de múltiplas fontes
 * 
 * Este serviço verifica ativamente todas as possíveis conexões WhatsApp:
 * - WppConnect em memória
 * - Sessões persistentes em disco
 * - Evolution API
 * - Processos ativos do sistema
 */

import * as fs from 'fs';
import * as path from 'path';
import { wppConnectService } from './wppConnectService';
import { evolutionApiService } from './evolutionApiService';

interface ActiveConnection {
  isConnected: boolean;
  phoneNumber?: string;
  source: 'wppconnect' | 'evolution' | 'persistent' | 'none';
  sessionId?: string;
  clientInfo?: any;
}

export class ActiveSessionDetector {
  private tokensPath: string;
  private sessionsPath: string;

  constructor() {
    this.tokensPath = path.join(process.cwd(), 'tokens');
    this.sessionsPath = path.join(process.cwd(), 'whatsapp-sessions');
    console.log(`🔍 [DETECTOR] Iniciado - Tokens: ${this.tokensPath}, Sessions: ${this.sessionsPath}`);
  }

  /**
   * Detecta qualquer conexão WhatsApp ativa para um cliente
   */
  async detectActiveConnection(clientId: string): Promise<ActiveConnection> {
    console.log(`🔍 [DETECTOR] Verificando conexões ativas para cliente ${clientId}`);

    // 1. Verificar WppConnect em memória
    const wppConnection = await this.checkWppConnectInMemory(clientId);
    if (wppConnection.isConnected) {
      console.log(`✅ [DETECTOR] WppConnect ativo detectado para ${clientId}`);
      return wppConnection;
    }

    // 2. Verificar sessões persistentes em disco
    const persistentConnection = await this.checkPersistentSessions(clientId);
    if (persistentConnection.isConnected) {
      console.log(`✅ [DETECTOR] Sessão persistente detectada para ${clientId}`);
      return persistentConnection;
    }

    // 3. Verificar Evolution API
    const evolutionConnection = await this.checkEvolutionAPI(clientId);
    if (evolutionConnection.isConnected) {
      console.log(`✅ [DETECTOR] Evolution API ativa para ${clientId}`);
      return evolutionConnection;
    }

    console.log(`❌ [DETECTOR] Nenhuma conexão ativa encontrada para ${clientId}`);
    return {
      isConnected: false,
      source: 'none'
    };
  }

  /**
   * Verifica WppConnect em memória
   */
  private async checkWppConnectInMemory(clientId: string): Promise<ActiveConnection> {
    try {
      const possibleKeys = [clientId, `client_${clientId}`];
      
      for (const key of possibleKeys) {
        const sessionStatus = wppConnectService.getSessionStatus(key);
        console.log(`📋 [DETECTOR] WppConnect status ${key}:`, {
          exists: !!sessionStatus,
          isConnected: sessionStatus?.isConnected,
          hasClient: !!sessionStatus?.client
        });
        
        if (sessionStatus && sessionStatus.isConnected && sessionStatus.client) {
          let phoneNumber = sessionStatus.phoneNumber;
          
          // Tentar obter número do dispositivo com múltiplos métodos
          if (!phoneNumber && sessionStatus.client) {
            try {
              // Método 1: getHostDevice
              const hostDevice = await sessionStatus.client.getHostDevice();
              if (hostDevice?.wid?.user) {
                phoneNumber = `+${hostDevice.wid.user}`;
                console.log(`📱 [DETECTOR] Número extraído via hostDevice: ${phoneNumber}`);
              } else if (hostDevice?.id?.user) {
                phoneNumber = `+${hostDevice.id.user}`;
                console.log(`📱 [DETECTOR] Número extraído via hostDevice.id: ${phoneNumber}`);
              }
              
              // Método 2: getWid (fallback)
              if (!phoneNumber && typeof sessionStatus.client.getWid === 'function') {
                const wid = await sessionStatus.client.getWid();
                if (wid?.user) {
                  phoneNumber = `+${wid.user}`;
                  console.log(`📱 [DETECTOR] Número extraído via getWid: ${phoneNumber}`);
                }
              }
              
              // Método 3: propriedades internas (último recurso)
              if (!phoneNumber) {
                if (sessionStatus.client.session?.wid?.user) {
                  phoneNumber = `+${sessionStatus.client.session.wid.user}`;
                  console.log(`📱 [DETECTOR] Número extraído via sessão interna: ${phoneNumber}`);
                } else if (sessionStatus.client.info?.wid?.user) {
                  phoneNumber = `+${sessionStatus.client.info.wid.user}`;
                  console.log(`📱 [DETECTOR] Número extraído via info.wid: ${phoneNumber}`);
                }
              }
            } catch (e: any) {
              console.log(`⚠️ [DETECTOR] Erro ao obter número do telefone:`, e.message);
            }
          }
          
          return {
            isConnected: true,
            phoneNumber: phoneNumber || 'Connected',
            source: 'wppconnect',
            sessionId: key,
            clientInfo: sessionStatus
          };
        }
      }
    } catch (error: any) {
      console.log(`❌ [DETECTOR] Erro WppConnect:`, error.message);
    }

    return { isConnected: false, source: 'none' };
  }

  /**
   * Verifica sessões persistentes em disco
   */
  private async checkPersistentSessions(clientId: string): Promise<ActiveConnection> {
    try {
      const possiblePaths = [
        path.join(this.tokensPath, clientId),
        path.join(this.tokensPath, `client_${clientId}`),
        path.join(this.sessionsPath, clientId),
        path.join(this.sessionsPath, `client_${clientId}`)
      ];

      for (const sessionPath of possiblePaths) {
        if (fs.existsSync(sessionPath)) {
          console.log(`📁 [DETECTOR] Sessão persistente encontrada: ${sessionPath}`);
          
          // Verificar se há arquivos de sessão válidos
          const files = fs.readdirSync(sessionPath);
          const hasValidSession = files.some(file => 
            file.includes('.json') || 
            file.includes('session') || 
            file.includes('auth')
          );
          
          if (hasValidSession) {
            console.log(`✅ [DETECTOR] Sessão válida em ${sessionPath}`);
            
            // Tentar ler informações da sessão
            let phoneNumber = null;
            try {
              const sessionFiles = files.filter(f => f.endsWith('.json'));
              for (const file of sessionFiles) {
                const filePath = path.join(sessionPath, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const sessionData = JSON.parse(content);
                
                if (sessionData.me?.user) {
                  phoneNumber = `+${sessionData.me.user}`;
                  break;
                }
              }
            } catch (e: any) {
              console.log(`⚠️ [DETECTOR] Erro ao ler sessão:`, e.message);
            }
            
            return {
              isConnected: true,
              phoneNumber: phoneNumber || 'Persistent Session',
              source: 'persistent',
              sessionId: path.basename(sessionPath)
            };
          }
        }
      }
    } catch (error: any) {
      console.log(`❌ [DETECTOR] Erro sessões persistentes:`, error.message);
    }

    return { isConnected: false, source: 'none' };
  }

  /**
   * Verifica Evolution API
   */
  private async checkEvolutionAPI(clientId: string): Promise<ActiveConnection> {
    try {
      const evolutionStatus = await evolutionApiService.getConnectionStatus(clientId);
      
      if (evolutionStatus.isConnected) {
        return {
          isConnected: true,
          phoneNumber: evolutionStatus.phoneNumber || 'Evolution Connected',
          source: 'evolution',
          sessionId: evolutionStatus.instanceId
        };
      }
    } catch (error: any) {
      console.log(`❌ [DETECTOR] Erro Evolution API:`, error.message);
    }

    return { isConnected: false, source: 'none' };
  }

  /**
   * Lista todas as conexões ativas detectadas
   */
  async getAllActiveConnections(): Promise<{ [clientId: string]: ActiveConnection }> {
    const connections: { [clientId: string]: ActiveConnection } = {};
    
    // Verificar todas as sessões WppConnect
    const wppSessions = wppConnectService.getActiveSessions();
    for (const [sessionId, session] of wppSessions) {
      if (session.isConnected) {
        const clientId = sessionId.replace('client_', '');
        connections[clientId] = {
          isConnected: true,
          phoneNumber: session.phoneNumber,
          source: 'wppconnect',
          sessionId
        };
      }
    }

    // Verificar diretórios de sessões persistentes
    if (fs.existsSync(this.tokensPath)) {
      const tokenDirs = fs.readdirSync(this.tokensPath);
      for (const dir of tokenDirs) {
        const clientId = dir.replace('client_', '');
        if (!connections[clientId]) {
          const persistent = await this.checkPersistentSessions(clientId);
          if (persistent.isConnected) {
            connections[clientId] = persistent;
          }
        }
      }
    }

    return connections;
  }
}

export const activeSessionDetector = new ActiveSessionDetector();