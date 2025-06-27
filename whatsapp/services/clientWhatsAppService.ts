import { stableWppService } from './stableWppService';
import { evolutionApiService } from './evolutionApiService';
import { activeSessionDetector } from './activeSessionDetector';
import { emergencyConnectionDetector } from './emergencyConnectionDetector';

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
    console.log(`🔍 [CLIENT-WA] Verificando status para cliente ${clientId} usando ActiveSessionDetector`);

    try {
      // PRIORIDADE 1: Detector de emergência (evita frustração do cliente)
      const emergencyDetection = await emergencyConnectionDetector.detectEmergencyConnection(clientId);
      
      if (emergencyDetection.isConnected && emergencyDetection.confidence === 'high') {
        console.log(`🚨 [CLIENT-WA] CONEXÃO FORÇADA VIA EMERGÊNCIA - ${emergencyDetection.reason}`);
        return {
          isConnected: true,
          qrCode: null,
          phoneNumber: emergencyDetection.phoneNumber || null,
          lastConnection: new Date(),
          clientId,
          instanceId: `emergency_${clientId}`
        };
      }
      
      // PRIORIDADE 2: ActiveSessionDetector para detecção robusta
      const activeConnection = await activeSessionDetector.detectActiveConnection(clientId);
      
      if (activeConnection.isConnected) {
        console.log(`✅ [CLIENT-WA] Conexão ativa detectada via ${activeConnection.source} - Número: ${activeConnection.phoneNumber}`);
        return {
          isConnected: true,
          qrCode: null,
          phoneNumber: activeConnection.phoneNumber || null,
          lastConnection: new Date(),
          clientId,
          instanceId: activeConnection.sessionId
        };
      }
      
      // Se não há conexão ativa, verificar se há QR Code disponível
      console.log(`🔍 [CLIENT-WA] Nenhuma conexão ativa, verificando QR Codes...`);
      
      // Verificar Evolution API para QR Code
      const evolutionStatus = await evolutionApiService.getConnectionStatus(clientId);
      if (evolutionStatus.qrCode) {
        console.log(`📱 [CLIENT-WA] Evolution API QR Code disponível`);
        return {
          isConnected: false,
          qrCode: evolutionStatus.qrCode,
          phoneNumber: null,
          lastConnection: null,
          clientId,
          instanceId: evolutionStatus.instanceId
        };
      }
      
      // Verificar StableWpp para QR Code
      const stableStatus = await stableWppService.getConnectionStatus(clientId);
      if (stableStatus.isConnected) {
        console.log(`📱 [CLIENT-WA] StableWpp conectado`);
        return {
          isConnected: true,
          qrCode: null,
          phoneNumber: stableStatus.phoneNumber,
          lastConnection: new Date(),
          clientId,
          instanceId: stableStatus.instanceId
        };
      }

      console.log(`❌ [CLIENT-WA] Nenhuma conexão ou QR Code encontrado para cliente ${clientId}`);
      return {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null,
        clientId
      };
      
    } catch (error) {
      console.error(`❌ [CLIENT-WA] Erro ao verificar status:`, error);
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
      // Verificar se já está conectado legitimamente
      const currentStatus = await this.getConnectionStatus(clientId);
      
      if (currentStatus.isConnected && currentStatus.phoneNumber) {
        console.log(`⚠️ [CLIENT-WA] WhatsApp já conectado em ${currentStatus.phoneNumber}`);
        return {
          success: false,
          message: `WhatsApp já conectado no número ${currentStatus.phoneNumber}. Use "Desconectar" primeiro se quiser trocar de número.`
        };
      }
      
      // Tentar conectar via WppConnect
      const wppResult = await wppConnectService.createSession(clientId);
      
      if (wppResult.success && wppResult.qrCode) {
        console.log(`✅ [CLIENT-WA] WppConnect conectado`);
        return {
          success: true,
          qrCode: wppResult.qrCode,
          message: 'QR Code gerado via WppConnect'
        };
      }
      
      // Fallback para Evolution API
      const evolutionResult = await evolutionApiService.connectClient(clientId);
      
      if (evolutionResult.success) {
        console.log(`✅ [CLIENT-WA] Evolution conectado com novo QR Code`);
        return evolutionResult;
      }
      
      return {
        success: false,
        message: 'Falha ao conectar via WppConnect e Evolution API'
      };
      
    } catch (error: any) {
      console.error(`❌ [CLIENT-WA] Erro ao conectar:`, error);
      return {
        success: false,
        message: `Erro de conexão: ${error.message}`
      };
    }
  }

  async disconnectClient(clientId: string): Promise<{ success: boolean; message?: string }> {
    console.log(`🔌 [CLIENT-WA] Desconectando ${clientId}`);
    
    try {
      // Desconectar de ambos os serviços
      const wppResult = await wppConnectService.disconnect(clientId);
      const evolutionResult = await evolutionApiService.disconnectClient(clientId);
      
      return {
        success: true,
        message: 'Cliente desconectado de todos os serviços'
      };
      
    } catch (error: any) {
      console.error(`❌ [CLIENT-WA] Erro ao desconectar:`, error);
      return {
        success: false,
        message: `Erro de desconexão: ${error.message}`
      };
    }
  }

  async sendMessage(clientId: string, phoneNumber: string, message: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    console.log(`📤 [CLIENT-WA] Enviando mensagem para ${phoneNumber} via cliente ${clientId}`);
    
    try {
      // Verificar conexão ativa primeiro
      const activeConnection = await activeSessionDetector.detectActiveConnection(clientId);
      
      if (!activeConnection.isConnected) {
        return {
          success: false,
          error: 'WhatsApp não está conectado'
        };
      }
      
      // Tentar enviar via WppConnect primeiro
      if (activeConnection.source === 'wppconnect') {
        const wppResult = await wppConnectService.sendMessage(clientId, phoneNumber, message);
        if (wppResult.success) {
          return wppResult;
        }
      }
      
      // Fallback para Evolution API
      const evolutionResult = await evolutionApiService.sendMessage(clientId, phoneNumber, message);
      return evolutionResult;
      
    } catch (error: any) {
      console.error(`❌ [CLIENT-WA] Erro ao enviar mensagem:`, error);
      return {
        success: false,
        error: `Erro de envio: ${error.message}`
      };
    }
  }
}

export const clientWhatsAppService = new ClientWhatsAppService();