/**
 * Enhanced WhatsApp Connection Service
 * 
 * Direct approach to connection detection without ES module dependencies
 * Focus on filesystem-based session detection and Evolution API integration
 */

import * as path from 'path';
import * as fs from 'fs';
import { evolutionApiService } from './evolutionApiService';

interface ConnectionResult {
  isConnected: boolean;
  phoneNumber?: string;
  instanceId?: string;
  qrCode?: string;
  service?: string;
  lastConnection?: Date;
}

export class EnhancedConnectionService {
  private sessionsPath: string;

  constructor() {
    this.sessionsPath = path.join(process.cwd(), 'whatsapp-sessions');
    
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true });
    }
  }

  /**
   * Detecta conexão ativa usando múltiplos métodos diretos
   */
  async detectConnection(clientId: string): Promise<ConnectionResult> {
    try {
      console.log(`🔍 [ENHANCED] Verificando conexão para cliente ${clientId}`);

      // Método 1: Verificar Evolution API primeiro (mais confiável)
      const evolutionStatus = await this.checkEvolutionApi(clientId);
      if (evolutionStatus.isConnected) {
        console.log(`✅ [ENHANCED] Evolution API detectou conexão ativa`);
        return evolutionStatus;
      }

      // Método 2: Verificar sessões persistentes via filesystem
      const sessionStatus = await this.checkSessionFiles(clientId);
      if (sessionStatus.isConnected) {
        console.log(`✅ [ENHANCED] Sessão persistente detectada: ${sessionStatus.phoneNumber}`);
        return sessionStatus;
      }

      // Método 3: Verificar tokens de sessão recentes
      const tokenStatus = await this.checkTokenFiles(clientId);
      if (tokenStatus.isConnected) {
        console.log(`✅ [ENHANCED] Token ativo detectado: ${tokenStatus.phoneNumber}`);
        return tokenStatus;
      }

      // Se nenhuma conexão detectada, retornar QR Code se disponível
      const qrCode = evolutionStatus.qrCode;
      console.log(`❌ [ENHANCED] Nenhuma conexão ativa. QR Code disponível: ${!!qrCode}`);
      
      return {
        isConnected: false,
        qrCode,
        instanceId: `client_${clientId}`
      };

    } catch (error) {
      console.error(`❌ [ENHANCED] Erro ao detectar conexão:`, error);
      return { isConnected: false };
    }
  }

  private async checkEvolutionApi(clientId: string): Promise<ConnectionResult> {
    try {
      const status = await evolutionApiService.getConnectionStatus(clientId);
      
      return {
        isConnected: status.isConnected,
        phoneNumber: status.phoneNumber,
        instanceId: status.instanceId,
        qrCode: status.qrCode,
        service: 'Evolution API',
        lastConnection: status.lastConnection
      };
    } catch (error) {
      console.log(`⚠️ [ENHANCED] Evolution API erro:`, error);
      return { isConnected: false };
    }
  }

  private async checkSessionFiles(clientId: string): Promise<ConnectionResult> {
    try {
      const clientSessionPath = path.join(this.sessionsPath, `client_${clientId}`);
      
      if (!fs.existsSync(clientSessionPath)) {
        return { isConnected: false };
      }

      const files = fs.readdirSync(clientSessionPath);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(clientSessionPath, file);
        const stats = fs.statSync(filePath);
        const hoursSinceModified = (now - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        // Considerar ativo se modificado nas últimas 24 horas
        if (hoursSinceModified < 24) {
          let phoneNumber = undefined;
          
          // Tentar extrair número do telefone de arquivos JSON
          if (file.endsWith('.json')) {
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              const data = JSON.parse(content);
              phoneNumber = data.me?.id?.user || data.me?.user || data.phoneNumber;
            } catch {
              // Ignore parsing errors
            }
          }
          
          return {
            isConnected: true,
            phoneNumber,
            service: 'Session Files',
            instanceId: `web_${clientId}`,
            lastConnection: stats.mtime
          };
        }
      }
      
      return { isConnected: false };
    } catch (error) {
      console.log(`⚠️ [ENHANCED] Session files erro:`, error);
      return { isConnected: false };
    }
  }

  private async checkTokenFiles(clientId: string): Promise<ConnectionResult> {
    try {
      const tokensPath = path.join(process.cwd(), 'tokens');
      
      if (!fs.existsSync(tokensPath)) {
        return { isConnected: false };
      }

      const tokenFile = path.join(tokensPath, `client_${clientId}.json`);
      
      if (fs.existsSync(tokenFile)) {
        const stats = fs.statSync(tokenFile);
        const hoursSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceModified < 12) { // Token válido por 12 horas
          try {
            const content = fs.readFileSync(tokenFile, 'utf8');
            const tokenData = JSON.parse(content);
            
            return {
              isConnected: true,
              phoneNumber: tokenData.phoneNumber,
              service: 'Token Files',
              instanceId: `token_${clientId}`,
              lastConnection: stats.mtime
            };
          } catch {
            // Ignore parsing errors
          }
        }
      }
      
      return { isConnected: false };
    } catch (error) {
      console.log(`⚠️ [ENHANCED] Token files erro:`, error);
      return { isConnected: false };
    }
  }

  /**
   * Força limpeza de sessões para gerar novo QR Code
   */
  async clearAllSessions(clientId: string): Promise<void> {
    try {
      const clientSessionPath = path.join(this.sessionsPath, `client_${clientId}`);
      const tokenFile = path.join(process.cwd(), 'tokens', `client_${clientId}.json`);
      
      if (fs.existsSync(clientSessionPath)) {
        fs.rmSync(clientSessionPath, { recursive: true, force: true });
        console.log(`🧹 [ENHANCED] Sessões removidas: ${clientSessionPath}`);
      }
      
      if (fs.existsSync(tokenFile)) {
        fs.unlinkSync(tokenFile);
        console.log(`🧹 [ENHANCED] Token removido: ${tokenFile}`);
      }
      
    } catch (error) {
      console.error(`❌ [ENHANCED] Erro ao limpar sessões:`, error);
    }
  }
}

export const enhancedConnectionService = new EnhancedConnectionService();