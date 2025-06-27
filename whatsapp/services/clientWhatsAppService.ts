import { wppConnectService } from './wppConnectService';
import { evolutionApiService } from './evolutionApiService';

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
    console.log(`🔧 [CLIENT-WA] ClientWhatsAppService inicializado`);
  }

  async getConnectionStatus(clientId: string): Promise<WhatsAppClientConfig> {
    console.log(`🔍 [CLIENT-WA] Verificando status para cliente ${clientId}`);

    try {
      // DETECÇÃO WPPCONNECT DIRETA
      console.log(`📱 [CLIENT-WA] Testando WppConnect`);
      
      const possibleKeys = [clientId, `client_${clientId}`];
      
      for (const key of possibleKeys) {
        try {
          const wppStatus = wppConnectService.getSessionStatus(key);
          console.log(`📋 [CLIENT-WA] Status ${key}:`, {
            exists: !!wppStatus,
            isConnected: wppStatus?.isConnected,
            hasClient: !!wppStatus?.client
          });
          
          if (wppStatus && wppStatus.isConnected && wppStatus.client) {
            console.log(`✅ [CLIENT-WA] WPPCONNECT DETECTADO! Key: ${key}`);
            
            let phoneNumber = wppStatus.phoneNumber;
            if (!phoneNumber) {
              try {
                const hostDevice = await wppStatus.client.getHostDevice();
                if (hostDevice?.wid?.user) {
                  phoneNumber = `+${hostDevice.wid.user}`;
                }
              } catch (e: any) {
                console.log(`⚠️ [CLIENT-WA] Erro dispositivo:`, e.message);
              }
            }
            
            return {
              isConnected: true,
              qrCode: null,
              phoneNumber: phoneNumber || 'Connected',
              lastConnection: new Date(),
              clientId,
              instanceId: `wpp_${clientId}`
            };
          }
        } catch (e: any) {
          console.log(`❌ [CLIENT-WA] Erro ${key}:`, e.message);
        }
      }

      // EVOLUTION API FALLBACK
      console.log(`🔍 [CLIENT-WA] Testando Evolution API`);
      
      try {
        const evolutionStatus = await evolutionApiService.getConnectionStatus(clientId);
        
        if (evolutionStatus.isConnected) {
          console.log(`✅ [CLIENT-WA] EVOLUTION DETECTADO!`);
          
          return {
            isConnected: true,
            qrCode: null,
            phoneNumber: evolutionStatus.phoneNumber || 'Connected',
            lastConnection: new Date(),
            clientId,
            instanceId: evolutionStatus.instanceId
          };
        }

        if (evolutionStatus.qrCode) {
          console.log(`📱 [CLIENT-WA] Evolution QR disponível`);
          
          return {
            isConnected: false,
            qrCode: evolutionStatus.qrCode,
            phoneNumber: null,
            lastConnection: new Date(),
            clientId,
            instanceId: evolutionStatus.instanceId
          };
        }
      } catch (e: any) {
        console.log(`❌ [CLIENT-WA] Erro Evolution:`, e.message);
      }

      // NENHUMA CONEXÃO DETECTADA
      console.log(`❌ [CLIENT-WA] Nenhuma conexão detectada para ${clientId}`);
      
      return {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null,
        clientId
      };

    } catch (error: any) {
      console.log(`❌ [CLIENT-WA] Erro geral:`, error.message);
      
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
    console.log(`🔗 [CLIENT-WA] Conectando ${clientId}`);
    
    try {
      // Tentar conectar via WppConnect
      const wppResult = await wppConnectService.createSession(clientId);
      
      if (wppResult.success && wppResult.qrCode) {
        console.log(`✅ [CLIENT-WA] WppConnect conectado`);
        return {
          success: true,
          qrCode: wppResult.qrCode,
          message: 'Conectado via WppConnect'
        };
      }

      // Fallback para Evolution API
      const evolutionResult = await evolutionApiService.connectClient(clientId);
      
      if (evolutionResult.success) {
        console.log(`✅ [CLIENT-WA] Evolution conectado`);
        return evolutionResult;
      }

      return {
        success: false,
        message: 'Falha ao conectar'
      };

    } catch (error: any) {
      console.log(`❌ [CLIENT-WA] Erro connect:`, error.message);
      return {
        success: false,
        message: `Erro: ${error.message}`
      };
    }
  }

  async disconnectClient(clientId: string): Promise<{ success: boolean; message?: string }> {
    console.log(`🔌 [CLIENT-WA] Desconectando ${clientId}`);
    
    try {
      await wppConnectService.disconnect(clientId);
      await evolutionApiService.disconnectClient(clientId);

      return {
        success: true,
        message: 'Desconectado'
      };

    } catch (error: any) {
      console.log(`❌ [CLIENT-WA] Erro disconnect:`, error.message);
      return {
        success: false,
        message: `Erro: ${error.message}`
      };
    }
  }

  async sendMessage(clientId: string, phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log(`📤 [CLIENT-WA] Enviando para ${phoneNumber}`);
    
    try {
      const wppResult = await wppConnectService.sendMessage(clientId, phoneNumber, message);
      
      if (wppResult.success) {
        console.log(`✅ [CLIENT-WA] Enviado via WppConnect`);
        return wppResult;
      }

      const evolutionResult = await evolutionApiService.sendMessage(clientId, phoneNumber, message);
      
      if (evolutionResult.success) {
        console.log(`✅ [CLIENT-WA] Enviado via Evolution`);
        return evolutionResult;
      }

      return {
        success: false,
        error: 'Falha ao enviar'
      };

    } catch (error: any) {
      console.log(`❌ [CLIENT-WA] Erro sendMessage:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const clientWhatsAppService = new ClientWhatsAppService();