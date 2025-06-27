/**
 * WhatsApp Connection Detector
 * 
 * Implements multiple detection methods to identify existing WhatsApp connections
 * even when the primary service doesn't properly detect persistent sessions.
 */

import { wppConnectService } from './wppConnectService';
import { simplifiedWebService } from './simplifiedWebService';
import { evolutionApiService } from './evolutionApiService';

interface ConnectionStatus {
  isConnected: boolean;
  phoneNumber?: string;
  service?: string;
  instanceId?: string;
  qrCode?: string;
}

export class ConnectionDetector {
  /**
   * Verifica conexão usando múltiplos métodos de detecção
   */
  async detectConnection(clientId: string): Promise<ConnectionStatus> {
    console.log(`🔍 [DETECTOR] Iniciando detecção abrangente para cliente ${clientId}`);
    
    // Método 1: Verificação de sessão ativa via WPPConnect
    try {
      const wppStatus = await this.checkWppConnectSession(clientId);
      if (wppStatus.isConnected) {
        console.log(`✅ [DETECTOR] WPPConnect detectou conexão ativa: ${wppStatus.phoneNumber}`);
        return { ...wppStatus, service: 'WPPConnect' };
      }
    } catch (error) {
      console.log(`⚠️ [DETECTOR] Erro WPPConnect:`, error);
    }

    // Método 2: Verificação via WhatsApp Web Service
    try {
      const webStatus = await this.checkWhatsAppWebSession(clientId);
      if (webStatus.isConnected) {
        console.log(`✅ [DETECTOR] WhatsApp Web detectou conexão ativa: ${webStatus.phoneNumber}`);
        return { ...webStatus, service: 'WhatsAppWeb' };
      }
    } catch (error) {
      console.log(`⚠️ [DETECTOR] Erro WhatsApp Web:`, error);
    }

    // Método 3: Verificação via Evolution API
    try {
      const evolutionStatus = await this.checkEvolutionApiSession(clientId);
      if (evolutionStatus.isConnected) {
        console.log(`✅ [DETECTOR] Evolution API detectou conexão ativa`);
        return { ...evolutionStatus, service: 'EvolutionAPI' };
      }
    } catch (error) {
      console.log(`⚠️ [DETECTOR] Erro Evolution API:`, error);
    }

    // Método 4: Verificação de arquivos de sessão diretamente
    try {
      const fileStatus = await this.checkSessionFiles(clientId);
      if (fileStatus.isConnected) {
        console.log(`✅ [DETECTOR] Arquivos de sessão indicam conexão ativa`);
        return { ...fileStatus, service: 'FileSystem' };
      }
    } catch (error) {
      console.log(`⚠️ [DETECTOR] Erro verificação de arquivos:`, error);
    }

    console.log(`❌ [DETECTOR] Nenhuma conexão ativa detectada para ${clientId}`);
    return { isConnected: false };
  }

  private async checkWppConnectSession(clientId: string): Promise<ConnectionStatus> {
    const status = await wppConnectService.getConnectionStatus(clientId);
    return {
      isConnected: status.isConnected,
      phoneNumber: status.phoneNumber || undefined,
      instanceId: status.instanceId,
      qrCode: status.qrCode || undefined
    };
  }

  private async checkWhatsAppWebSession(clientId: string): Promise<ConnectionStatus> {
    try {
      console.log(`🔍 [DETECTOR] Verificando WhatsApp Web simplificado para ${clientId}`);
      const status = await simplifiedWebService.getConnectionStatus(clientId);
      
      if (status.isConnected) {
        return {
          isConnected: true,
          phoneNumber: status.phoneNumber,
          service: 'WhatsApp Web Simplified',
          instanceId: status.instanceId
        };
      }
    } catch (error) {
      console.log(`⚠️ [DETECTOR] Erro WhatsApp Web simplificado ${clientId}:`, error);
    }
    
    return { isConnected: false };
  }

  private async checkEvolutionApiSession(clientId: string): Promise<ConnectionStatus> {
    const status = await evolutionApiService.getConnectionStatus(clientId);
    return {
      isConnected: status.isConnected,
      phoneNumber: status.phoneNumber || undefined,
      instanceId: status.instanceId,
      qrCode: status.qrCode || undefined
    };
  }

  private async checkSessionFiles(clientId: string): Promise<ConnectionStatus> {
    try {
      const fs = await import('fs');
      const fsPromises = fs.promises;
      const path = await import('path');
      
      // Verificar diretórios de sessão conhecidos
      const sessionPaths = [
        `whatsapp-sessions/client_${clientId}`,
        `whatsapp-sessions/${clientId}`,
        `tokens/session-client_${clientId}.data.json`,
        `tokens/client_${clientId}.data.json`
      ];

      for (const sessionPath of sessionPaths) {
        try {
          const stats = await fsPromises.stat(sessionPath);
          if (stats.isDirectory() || stats.isFile()) {
            // Verificar se a sessão foi modificada recentemente (últimas 24 horas)
            const lastModified = stats.mtime;
            const now = new Date();
            const hoursDiff = (now.getTime() - lastModified.getTime()) / (1000 * 60 * 60);
            
            if (hoursDiff < 24) {
              console.log(`📁 [DETECTOR] Sessão ativa encontrada em: ${sessionPath} (modificado há ${hoursDiff.toFixed(1)}h)`);
              
              // Tentar extrair número do telefone de arquivos de sessão
              const phoneNumber = await this.extractPhoneFromSession(sessionPath);
              
              return {
                isConnected: true,
                phoneNumber,
                instanceId: `file_${clientId}`
              };
            }
          }
        } catch {
          // Arquivo/diretório não existe, continuar
        }
      }
      
      return { isConnected: false };
    } catch (error) {
      console.log(`⚠️ [DETECTOR] Erro ao verificar arquivos de sessão:`, error);
      return { isConnected: false };
    }
  }

  private async extractPhoneFromSession(sessionPath: string): Promise<string | undefined> {
    try {
      const fs = await import('fs');
      const fsPromises = fs.promises;
      const path = await import('path');
      
      // Se for um arquivo JSON direto
      if (sessionPath.endsWith('.json')) {
        const content = await fsPromises.readFile(sessionPath, 'utf8');
        const sessionData = JSON.parse(content);
        
        // Buscar número em diferentes estruturas possíveis
        const phoneNumber = sessionData.me?.id?.user || 
                           sessionData.me?.user || 
                           sessionData.phoneNumber ||
                           sessionData.wid?.user;
        
        return phoneNumber;
      }
      
      // Se for um diretório, procurar arquivos de configuração
      const stats = await fsPromises.stat(sessionPath);
      if (stats.isDirectory()) {
        const files = await fsPromises.readdir(sessionPath);
        
        for (const file of files) {
          if (file.includes('session') || file.includes('config') || file.endsWith('.json')) {
            try {
              const filePath = path.join(sessionPath, file);
              const content = await fsPromises.readFile(filePath, 'utf8');
              const data = JSON.parse(content);
              
              const phoneNumber = data.me?.id?.user || 
                                 data.me?.user || 
                                 data.phoneNumber ||
                                 data.wid?.user;
              
              if (phoneNumber) {
                return phoneNumber;
              }
            } catch {
              // Ignorar arquivos que não são JSON válidos
            }
          }
        }
      }
      
      return undefined;
    } catch (error) {
      console.log(`⚠️ [DETECTOR] Erro ao extrair número da sessão:`, error);
      return undefined;
    }
  }

  /**
   * Força nova verificação ignorando cache
   */
  async forceRefreshConnection(clientId: string): Promise<ConnectionStatus> {
    console.log(`🔄 [DETECTOR] Forçando atualização de status para ${clientId}`);
    
    // Limpar qualquer cache que os serviços possam ter
    // (implementar se necessário)
    
    return await this.detectConnection(clientId);
  }
}

export const connectionDetector = new ConnectionDetector();