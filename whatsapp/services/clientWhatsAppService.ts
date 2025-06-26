import { storage } from '../../server/storage';
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
    console.log('✅ [CLIENT-WA] Evolution API Service inicializado');
  }

  async getConnectionStatus(clientId: string): Promise<WhatsAppClientConfig> {
    try {
      console.log(`📊 [CLIENT-WA] Verificando status Evolution API para cliente ${clientId}`);
      
      // Usar Evolution API diretamente
      const evolutionStatus = await evolutionApiService.getConnectionStatus(clientId);
      
      console.log(`📱 [Evolution] Status recebido:`, {
        isConnected: evolutionStatus.isConnected,
        hasQrCode: !!evolutionStatus.qrCode,
        instanceId: evolutionStatus.instanceId
      });

      return {
        isConnected: evolutionStatus.isConnected,
        qrCode: evolutionStatus.qrCode || null,
        phoneNumber: evolutionStatus.phoneNumber || null,
        lastConnection: evolutionStatus.lastConnection || null,
        clientId,
        instanceId: evolutionStatus.instanceId
      };
    } catch (error) {
      console.error(`❌ [CLIENT-WA] Erro ao verificar status Evolution API:`, error);
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
      console.log(`🔗 [CLIENT-WA] Conectando via Evolution API para cliente ${clientId}`);
      
      const result = await evolutionApiService.connectClient(clientId);
      
      console.log(`🔗 [Evolution] Resultado da conexão:`, {
        success: result.success,
        hasQrCode: !!result.qrCode,
        error: result.error
      });
      
      return result;
    } catch (error) {
      console.error(`❌ [CLIENT-WA] Erro na conexão Evolution API:`, error);
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