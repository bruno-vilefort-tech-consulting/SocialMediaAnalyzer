/**
 * Simplified WhatsApp Web Service
 * 
 * Focused on session detection via filesystem without ES module issues
 */

import * as path from 'path';
import * as fs from 'fs';

export class SimplifiedWebService {
  private sessionsPath: string;

  constructor() {
    this.sessionsPath = path.join(process.cwd(), 'whatsapp-sessions');
    
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true });
    }
  }

  /**
   * Detecta conexão ativa via arquivos de sessão
   */
  async getConnectionStatus(clientId: string): Promise<{
    isConnected: boolean;
    phoneNumber?: string;
    instanceId?: string;
  }> {
    try {
      const sessionPath = path.join(this.sessionsPath, `client_${clientId}`);
      
      if (!fs.existsSync(sessionPath)) {
        return { isConnected: false };
      }

      // Verificar arquivos recentes na sessão (últimas 24 horas)
      const files = fs.readdirSync(sessionPath);
      let hasRecentActivity = false;
      let phoneNumber: string | undefined;

      for (const file of files) {
        const filePath = path.join(sessionPath, file);
        const stats = fs.statSync(filePath);
        const hoursSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceModified < 24) {
          hasRecentActivity = true;

          // Tentar extrair número da sessão
          if (file.endsWith('.json')) {
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              const data = JSON.parse(content);
              phoneNumber = data.me?.id?.user || data.me?.user || data.phoneNumber || phoneNumber;
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }

      if (hasRecentActivity) {
        return {
          isConnected: true,
          phoneNumber,
          instanceId: `web_${clientId}`
        };
      }

      return { isConnected: false };
      
    } catch (error) {
      return { isConnected: false };
    }
  }

  /**
   * Retorna fallback para casos onde a biblioteca principal falha
   */
  async createSession(clientId: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    return {
      success: false,
      error: 'Criação de sessão não disponível - use Evolution API ou WPPConnect'
    };
  }

  async disconnect(clientId: string): Promise<boolean> {
    try {
      const sessionPath = path.join(this.sessionsPath, `client_${clientId}`);
      
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
}

export const simplifiedWebService = new SimplifiedWebService();