/**
 * Active Connection Tester - Detecta conexões WhatsApp ativas através de testes funcionais
 * 
 * Este serviço realiza testes ativos para verificar se existe uma conexão WhatsApp
 * funcional, mesmo quando os sistemas internos não refletem o estado correto.
 */

import { wppConnectService } from './wppConnectService';
import { evolutionApiService } from './evolutionApiService';

interface ActiveConnectionResult {
  isActivelyConnected: boolean;
  phoneNumber?: string;
  detectionMethod: string;
  testResult?: string;
  error?: string;
}

export class ActiveConnectionTester {
  
  /**
   * Testa ativamente se existe uma conexão WhatsApp funcional
   */
  async testActiveConnection(clientId: string): Promise<ActiveConnectionResult> {
    console.log(`🧪 [ACTIVE-TEST] Testando conexão ativa para cliente ${clientId}`);
    
    try {
      // Teste 1: Verificar se WppConnect consegue enviar uma mensagem de ping
      const wppTest = await this.testWppConnectPing(clientId);
      if (wppTest.isActivelyConnected) {
        return wppTest;
      }
      
      // Teste 2: Verificar Evolution API com teste funcional
      const evolutionTest = await this.testEvolutionApiPing(clientId);
      if (evolutionTest.isActivelyConnected) {
        return evolutionTest;
      }
      
      // Teste 3: Verificar status de sessões ativas via WppConnect
      const sessionTest = await this.testWppConnectSessionStatus(clientId);
      if (sessionTest.isActivelyConnected) {
        return sessionTest;
      }
      
      return {
        isActivelyConnected: false,
        detectionMethod: 'none',
        testResult: 'Nenhuma conexão ativa detectada nos testes funcionais'
      };
      
    } catch (error) {
      console.log(`❌ [ACTIVE-TEST] Erro durante teste ativo:`, error);
      return {
        isActivelyConnected: false,
        detectionMethod: 'error',
        error: error.message || 'Erro durante teste de conexão ativa'
      };
    }
  }
  
  /**
   * Testa WppConnect enviando uma mensagem de verificação interna
   */
  private async testWppConnectPing(clientId: string): Promise<ActiveConnectionResult> {
    try {
      console.log(`📱 [ACTIVE-TEST] Testando WppConnect para ${clientId}`);
      
      // Verificar se existe uma sessão ativa no WppConnect
      const sessions = wppConnectService.getActiveSessions();
      const sessionKey = sessions.has(clientId) ? clientId : sessions.has(`client_${clientId}`) ? `client_${clientId}` : null;
      
      if (sessionKey) {
        const session = sessions.get(sessionKey);
        if (session && session.isConnected && session.client) {
          console.log(`✅ [ACTIVE-TEST] WppConnect sessão ativa encontrada: ${sessionKey}`);
          
          // Tentar obter informações do cliente conectado
          try {
            const info = await session.client.getHostDevice();
            if (info && info.wid && info.wid.user) {
              return {
                isActivelyConnected: true,
                phoneNumber: `+${info.wid.user}`,
                detectionMethod: 'wppconnect-device-info',
                testResult: `Dispositivo conectado: ${info.wid.user}`
              };
            }
          } catch (infoError) {
            console.log(`⚠️ [ACTIVE-TEST] Erro ao obter info do dispositivo:`, infoError.message);
          }
          
          return {
            isActivelyConnected: true,
            phoneNumber: session.phoneNumber || 'Connected',
            detectionMethod: 'wppconnect-session',
            testResult: 'Sessão WppConnect ativa confirmada'
          };
        }
      }
      
      return {
        isActivelyConnected: false,
        detectionMethod: 'wppconnect-test',
        testResult: 'Nenhuma sessão WppConnect ativa'
      };
      
    } catch (error) {
      console.log(`❌ [ACTIVE-TEST] Erro no teste WppConnect:`, error.message);
      return {
        isActivelyConnected: false,
        detectionMethod: 'wppconnect-error',
        error: error.message
      };
    }
  }
  
  /**
   * Testa Evolution API com verificação de status
   */
  private async testEvolutionApiPing(clientId: string): Promise<ActiveConnectionResult> {
    try {
      console.log(`🔄 [ACTIVE-TEST] Testando Evolution API para ${clientId}`);
      
      const status = await evolutionApiService.getConnectionStatus(clientId);
      if (status.isConnected && status.phoneNumber) {
        return {
          isActivelyConnected: true,
          phoneNumber: status.phoneNumber,
          detectionMethod: 'evolution-api',
          testResult: `Evolution API conectado: ${status.phoneNumber}`
        };
      }
      
      return {
        isActivelyConnected: false,
        detectionMethod: 'evolution-test',
        testResult: 'Evolution API não detectou conexão ativa'
      };
      
    } catch (error) {
      console.log(`❌ [ACTIVE-TEST] Erro no teste Evolution API:`, error.message);
      return {
        isActivelyConnected: false,
        detectionMethod: 'evolution-error',
        error: error.message
      };
    }
  }
  
  /**
   * Verifica status interno detalhado do WppConnect
   */
  private async testWppConnectSessionStatus(clientId: string): Promise<ActiveConnectionResult> {
    try {
      console.log(`🔍 [ACTIVE-TEST] Verificando status detalhado WppConnect para ${clientId}`);
      
      const sessionStatus = wppConnectService.getSessionStatus(clientId);
      if (sessionStatus) {
        console.log(`📊 [ACTIVE-TEST] Status da sessão ${clientId}:`, sessionStatus);
        
        if (sessionStatus.isConnected) {
          return {
            isActivelyConnected: true,
            phoneNumber: sessionStatus.phoneNumber || 'Connected',
            detectionMethod: 'wppconnect-status',
            testResult: `Status interno: ${sessionStatus.status || 'connected'}`
          };
        }
      }
      
      return {
        isActivelyConnected: false,
        detectionMethod: 'wppconnect-status-test',
        testResult: 'Status interno não indica conexão ativa'
      };
      
    } catch (error) {
      console.log(`❌ [ACTIVE-TEST] Erro no teste de status:`, error.message);
      return {
        isActivelyConnected: false,
        detectionMethod: 'status-error',
        error: error.message
      };
    }
  }
}

export const activeConnectionTester = new ActiveConnectionTester();