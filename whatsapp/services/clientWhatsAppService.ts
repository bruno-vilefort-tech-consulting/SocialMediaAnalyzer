import { storage } from '../../server/storage';
import { evolutionApiService } from './evolutionApiService';
import { wppConnectService } from './wppConnectService';
import { enhancedConnectionService } from './enhancedConnectionService';
import { activeConnectionTester } from './activeConnectionTester';

interface WhatsAppClientConfig {
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
  clientId: string;
  instanceId?: string;
}

class ClientWhatsAppService {
  constructor() {
    console.log('✅ [CLIENT-WA] Multi-service WhatsApp manager inicializado');
  }

  async getConnectionStatus(clientId: string): Promise<WhatsAppClientConfig> {
    try {
      console.log(`🔍 [CLIENT-WA] Verificando conexão usando Enhanced Service para cliente ${clientId}`);
      
      // Usar Enhanced Connection Service como método primário
      const enhancedStatus = await enhancedConnectionService.detectConnection(clientId);
      
      if (enhancedStatus.isConnected && enhancedStatus.phoneNumber) {
        console.log(`✅ [CLIENT-WA] Enhanced Service detectou conexão ativa via ${enhancedStatus.service}: ${enhancedStatus.phoneNumber}`);
        return {
          isConnected: true,
          qrCode: null, // Não mostrar QR quando conectado
          phoneNumber: enhancedStatus.phoneNumber,
          lastConnection: enhancedStatus.lastConnection || new Date(),
          clientId,
          instanceId: enhancedStatus.instanceId || `client_${clientId}`
        };
      } else if (enhancedStatus.isConnected && !enhancedStatus.phoneNumber) {
        console.log(`⚠️ [CLIENT-WA] Enhanced Service reportou conexão mas sem número de telefone - considerando desconectado`);
      }

      // Verificar diretamente as sessões ativas do WppConnect
      console.log(`🔍 [CLIENT-WA] Verificando sessões ativas WppConnect`);
      
      try {
        const activeSessions = wppConnectService.getActiveSessions();
        console.log(`📱 [CLIENT-WA] Tipo de activeSessions:`, typeof activeSessions);
        console.log(`📱 [CLIENT-WA] activeSessions:`, activeSessions);
        
        // Verificar se é um Map
        if (activeSessions && typeof activeSessions.has === 'function') {
          // Listar todas as sessões para debug
          console.log(`📱 [CLIENT-WA] Sessões disponíveis (Map):`, Array.from(activeSessions.keys()));
          
          // Tentar várias chaves possíveis para o cliente
          const possibleKeys = [clientId, `client_${clientId}`];
          
          for (const key of possibleKeys) {
            if (activeSessions.has(key)) {
              const session = activeSessions.get(key);
              console.log(`📱 [CLIENT-WA] Sessão WppConnect encontrada para ${key}:`, session);
              
              if (session && session.isConnected) {
                console.log(`✅ [CLIENT-WA] WppConnect sessão ativa detectada!`);
                
                return {
                  isConnected: true,
                  qrCode: null,
                  phoneNumber: session.phoneNumber || 'Connected',
                  lastConnection: new Date(),
                  clientId,
                  instanceId: `wpp_${clientId}`
                };
              }
            }
          }
          
          // Verificar todas as sessões em busca de uma ativa (fallback)
          if (activeSessions instanceof Map) {
            for (const [sessionKey, session] of activeSessions.entries()) {
              if (session && session.isConnected) {
                console.log(`✅ [CLIENT-WA] Sessão ativa encontrada em ${sessionKey} para cliente ${clientId}`);
                
                return {
                  isConnected: true,
                  qrCode: null,
                  phoneNumber: session.phoneNumber || 'Connected',
                  lastConnection: new Date(),
                  clientId,
                  instanceId: `wpp_${clientId}`
                };
              }
            }
          }
        } else {
          console.log(`⚠️ [CLIENT-WA] activeSessions não é um Map válido`);
        }
      } catch (sessionError) {
        console.log(`❌ [CLIENT-WA] Erro ao verificar sessões WppConnect:`, sessionError.message);
      }

      // Se não encontrou sessão WppConnect ativa, detectar via logs/status interno
      const wppStatus = wppConnectService.getSessionStatus(clientId);
      console.log(`📱 [CLIENT-WA] Status interno WppConnect para ${clientId}:`, wppStatus);
      
      if (wppStatus && wppStatus.isConnected && wppStatus.status === 'inChat') {
        console.log(`✅ [CLIENT-WA] WppConnect detectado via status interno!`);
        
        return {
          isConnected: true,
          qrCode: null,
          phoneNumber: wppStatus.phoneNumber || 'Connected',
          lastConnection: new Date(),
          clientId,
          instanceId: `wpp_${clientId}`
        };
      }

      // Se Enhanced Service não detectou conexão, usar fallback direto para Evolution API
      console.log(`🔄 [CLIENT-WA] Nenhuma sessão WppConnect ativa, tentando Evolution API`);
      
      try {
        const evolutionStatus = await evolutionApiService.getConnectionStatus(clientId);
        console.log(`📱 [Evolution] Status:`, {
          isConnected: evolutionStatus.isConnected,
          hasQrCode: !!evolutionStatus.qrCode,
          instanceId: evolutionStatus.instanceId
        });

        // Retornar resultado com QR Code se disponível
        return {
          isConnected: evolutionStatus.isConnected,
          qrCode: evolutionStatus.qrCode || enhancedStatus.qrCode || null,
          phoneNumber: evolutionStatus.phoneNumber || null,
          lastConnection: evolutionStatus.lastConnection || null,
          clientId,
          instanceId: evolutionStatus.instanceId || `client_${clientId}`
        };
        
      } catch (evoError) {
        console.log(`⚠️ [Evolution] Erro na verificação:`, evoError);
      }

      // Último recurso: Teste ativo de conexão para detectar conexões que não aparecem nos sistemas
      console.log(`🧪 [CLIENT-WA] Executando teste ativo de conexão para detectar WhatsApp conectado`);
      const activeTest = await activeConnectionTester.testActiveConnection(clientId);
      
      if (activeTest.isActivelyConnected) {
        console.log(`✅ [CLIENT-WA] CONEXÃO ATIVA DETECTADA via ${activeTest.detectionMethod}!`);
        console.log(`📱 [CLIENT-WA] Número detectado: ${activeTest.phoneNumber}`);
        
        return {
          isConnected: true,
          qrCode: null, // Conexão ativa não precisa de QR
          phoneNumber: activeTest.phoneNumber || 'Connected',
          lastConnection: new Date(),
          clientId,
          instanceId: `active_${clientId}`
        };
      }

      // Se todos os métodos falharam, retornar status desconectado
      console.log(`❌ [CLIENT-WA] Nenhuma conexão detectada pelos métodos disponíveis`);
      console.log(`🔍 [CLIENT-WA] Resultado do teste ativo: ${activeTest.testResult || activeTest.error}`);
      
      return {
        isConnected: false,
        qrCode: enhancedStatus.qrCode || null,
        phoneNumber: null,
        lastConnection: null,
        clientId,
        instanceId: `client_${clientId}`
      };
      
    } catch (error) {
      console.error(`❌ [CLIENT-WA] Erro geral ao verificar status:`, error);
      return {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null,
        clientId
      };
    }
  }

  async connectClient(clientId: string): Promise<{ success: boolean; qrCode?: string; message?: string }> {
    try {
      console.log(`🔗 [CLIENT-WA] Iniciando conexão multi-serviço para cliente ${clientId}`);
      
      // Primeiro, verificar se já existe conexão ativa
      const currentStatus = await this.getConnectionStatus(clientId);
      if (currentStatus.isConnected) {
        console.log(`✅ [CLIENT-WA] Conexão já ativa detectada para ${clientId}: ${currentStatus.phoneNumber}`);
        return {
          success: true,
          message: `WhatsApp já conectado: ${currentStatus.phoneNumber}`
        };
      }
      
      // Tentar WPPConnect primeiro (mais confiável para persistência)
      console.log(`🔄 [CLIENT-WA] Tentando conexão via WPPConnect para ${clientId}`);
      try {
        const wppResult = await wppConnectService.createSession(clientId);
        if (wppResult.success && wppResult.qrCode) {
          console.log(`✅ [CLIENT-WA] WPPConnect gerou QR Code com sucesso`);
          return {
            success: true,
            qrCode: wppResult.qrCode,
            message: "QR Code gerado via WPPConnect - escaneie com seu WhatsApp"
          };
        }
      } catch (wppError) {
        console.log(`⚠️ [CLIENT-WA] WPPConnect falhou, tentando Evolution API:`, wppError);
      }
      
      // Fallback para Evolution API
      console.log(`🔄 [CLIENT-WA] Tentando conexão via Evolution API para ${clientId}`);
      const result = await evolutionApiService.connectClient(clientId);
      
      console.log(`🔗 [Evolution] Resultado da conexão:`, {
        success: result.success,
        hasQrCode: !!result.qrCode,
        error: result.error
      });
      
      return result;
    } catch (error) {
      console.error(`❌ [CLIENT-WA] Erro geral na conexão:`, error);
      return {
        success: false,
        message: `Erro na conexão: ${error.message}`
      };
    }
  }

  async disconnectClient(clientId: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`🔌 [CLIENT-WA] Desconectando via Evolution API cliente ${clientId}`);

      const result = await evolutionApiService.disconnectClient(clientId);
      
      console.log(`🔌 [Evolution] Resultado da desconexão:`, result);
      
      return result;
    } catch (error) {
      console.error(`❌ [CLIENT-WA] Erro ao desconectar Evolution API:`, error);
      return { success: false, message: `Erro ao desconectar: ${error.message}` };
    }
  }

  async sendMessage(clientId: string, phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`📤 [CLIENT-WA] Enviando mensagem via Evolution API para ${phoneNumber}`);
      
      const result = await evolutionApiService.sendMessage(clientId, phoneNumber, message);
      
      console.log(`📤 [Evolution] Resultado do envio:`, result);
      
      return result;
    } catch (error) {
      console.error(`❌ [CLIENT-WA] Erro ao enviar mensagem Evolution API:`, error);
      return { success: false, error: error.message };
    }
  }
}

export const clientWhatsAppService = new ClientWhatsAppService();