import { storage } from '../../server/storage';
import { evolutionApiService } from './evolutionApiService';
import { wppConnectService } from './wppConnectService';
import { whatsappWebService } from './whatsappWebService';

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
      console.log(`📊 [CLIENT-WA] Verificando status com múltiplos serviços para cliente ${clientId}`);
      
      // Método 1: Verificar WPPConnect (mais confiável para sessões persistentes)
      let wppConnectStatus;
      try {
        wppConnectStatus = await wppConnectService.getConnectionStatus(clientId);
        console.log(`📱 [WPPConnect] Status:`, {
          isConnected: wppConnectStatus.isConnected,
          hasPhone: !!wppConnectStatus.phoneNumber,
          hasQrCode: !!wppConnectStatus.qrCode
        });
        
        // Se WPPConnect detecta conexão, usar este status
        if (wppConnectStatus.isConnected && wppConnectStatus.phoneNumber) {
          console.log(`✅ [CLIENT-WA] WPPConnect detectou conexão ativa: ${wppConnectStatus.phoneNumber}`);
          return {
            isConnected: true,
            qrCode: null, // Não mostrar QR quando conectado
            phoneNumber: wppConnectStatus.phoneNumber,
            lastConnection: new Date(),
            clientId,
            instanceId: wppConnectStatus.instanceId
          };
        }
      } catch (wppError) {
        console.log(`⚠️ [WPPConnect] Erro na verificação:`, wppError);
      }

      // Método 2: Verificar WhatsApp Web Service
      let webServiceStatus;
      try {
        webServiceStatus = await whatsappWebService.getConnectionStatus(clientId);
        console.log(`📱 [WhatsAppWeb] Status:`, {
          isConnected: webServiceStatus.isConnected,
          hasPhone: !!webServiceStatus.phoneNumber
        });
        
        if (webServiceStatus.isConnected && webServiceStatus.phoneNumber) {
          console.log(`✅ [CLIENT-WA] WhatsApp Web detectou conexão ativa: ${webServiceStatus.phoneNumber}`);
          return {
            isConnected: true,
            qrCode: null,
            phoneNumber: webServiceStatus.phoneNumber,
            lastConnection: new Date(),
            clientId,
            instanceId: `web_${clientId}`
          };
        }
      } catch (webError) {
        console.log(`⚠️ [WhatsAppWeb] Erro na verificação:`, webError);
      }

      // Método 3: Verificar Evolution API como fallback
      let evolutionStatus;
      try {
        evolutionStatus = await evolutionApiService.getConnectionStatus(clientId);
        console.log(`📱 [Evolution] Status:`, {
          isConnected: evolutionStatus.isConnected,
          hasQrCode: !!evolutionStatus.qrCode,
          instanceId: evolutionStatus.instanceId
        });

        if (evolutionStatus.isConnected) {
          console.log(`✅ [CLIENT-WA] Evolution API detectou conexão ativa`);
          return {
            isConnected: true,
            qrCode: null,
            phoneNumber: evolutionStatus.phoneNumber || null,
            lastConnection: evolutionStatus.lastConnection || new Date(),
            clientId,
            instanceId: evolutionStatus.instanceId
          };
        }
      } catch (evoError) {
        console.log(`⚠️ [Evolution] Erro na verificação:`, evoError);
      }

      // Se nenhum serviço detectou conexão, retornar status baseado em QR Code disponível
      const hasQrCode = wppConnectStatus?.qrCode || evolutionStatus?.qrCode;
      
      console.log(`📱 [CLIENT-WA] Nenhuma conexão ativa detectada. QR Code disponível: ${!!hasQrCode}`);
      
      return {
        isConnected: false,
        qrCode: hasQrCode || null,
        phoneNumber: null,
        lastConnection: null,
        clientId,
        instanceId: evolutionStatus?.instanceId || `client_${clientId}`
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