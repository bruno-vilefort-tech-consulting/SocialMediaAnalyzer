import { wppConnectService } from './wppConnectService';
import { evolutionApiService } from './evolutionApiService';
import { activeSessionDetector } from './activeSessionDetector';
import { emergencyConnectionDetector } from './emergencyConnectionDetector';
import { whatsappBaileyService } from './whatsappBaileyService';

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
  }

  async getConnectionStatus(clientId: string): Promise<WhatsAppClientConfig> {

    try {
      // PRIORIDADE 1: Detector de emergência (evita frustração do cliente)
      const emergencyDetection = await emergencyConnectionDetector.detectEmergencyConnection(clientId);
      
      if (emergencyDetection.isConnected && emergencyDetection.confidence === 'high') {
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
      
      // PRIORIDADE 1: Verificar Baileys para QR Code
      try {
        const baileysStatus = await whatsappBaileyService.getConnection(clientId);
        if (baileysStatus?.qrCode) {
          return {
            isConnected: false,
            qrCode: baileysStatus.qrCode,
            phoneNumber: null,
            lastConnection: null,
            clientId,
            instanceId: `baileys_${clientId}`
          };
        }
      } catch (error) {
      }
      
      // PRIORIDADE 2: Verificar WppConnect para QR Code
      const wppStatus = await wppConnectService.getConnectionStatus(clientId);
      if (wppStatus.qrCode) {
        return {
          isConnected: false,
          qrCode: wppStatus.qrCode,
          phoneNumber: null,
          lastConnection: null,
          clientId,
          instanceId: wppStatus.instanceId
        };
      }
      
      // PRIORIDADE 3: Verificar Evolution API para QR Code (fallback)
      const evolutionStatus = await evolutionApiService.getConnectionStatus(clientId);
      if (evolutionStatus.qrCode) {
        return {
          isConnected: false,
          qrCode: evolutionStatus.qrCode,
          phoneNumber: null,
          lastConnection: null,
          clientId,
          instanceId: evolutionStatus.instanceId
        };
      }

      return {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null,
        clientId
      };
      
    } catch (error) {
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
      // Verificar se já está conectado legitimamente
      const currentStatus = await this.getConnectionStatus(clientId);
      
      if (currentStatus.isConnected && currentStatus.phoneNumber) {
        return {
          success: false,
          message: `WhatsApp já conectado no número ${currentStatus.phoneNumber}. Use "Desconectar" primeiro se quiser trocar de número.`
        };
      }
      
      // PRIORIDADE 1: Tentar conectar via Baileys
      try {
        const baileysResult = await whatsappBaileyService.initWhatsApp(clientId);
        
        if (baileysResult?.qrCode) {
          return {
            success: true,
            qrCode: baileysResult.qrCode,
            message: 'QR Code gerado via Baileys'
          };
        }
      } catch (error: any) {
      }

      // PRIORIDADE 2: Tentar conectar via WppConnect
      const wppResult = await wppConnectService.createSession(clientId);
      
      if (wppResult.success && wppResult.qrCode) {
        return {
          success: true,
          qrCode: wppResult.qrCode,
          message: 'QR Code gerado via WppConnect'
        };
      }
      
      // PRIORIDADE 3: Fallback para Evolution API
      const evolutionResult = await evolutionApiService.connectClient(clientId);
      
      if (evolutionResult.success) {
        return evolutionResult;
      }
      
      return {
        success: false,
        message: 'Falha ao conectar via Baileys, WppConnect e Evolution API'
      };
      
    } catch (error: any) {
      return {
        success: false,
        message: `Erro de conexão: ${error.message}`
      };
    }
  }

  async disconnectClient(clientId: string): Promise<{ success: boolean; message?: string }> {
    
    try {
      // Desconectar de ambos os serviços
      const wppResult = await wppConnectService.disconnect(clientId);
      const evolutionResult = await evolutionApiService.disconnectClient(clientId);
      
      return {
        success: true,
        message: 'Cliente desconectado de todos os serviços'
      };
      
    } catch (error: any) {
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
      return {
        success: false,
        error: `Erro de envio: ${error.message}`
      };
    }
  }
}

export const clientWhatsAppService = new ClientWhatsAppService();