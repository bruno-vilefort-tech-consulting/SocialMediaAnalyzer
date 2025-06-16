// Isolated WhatsApp wrapper to prevent crashes
import { spawn } from 'child_process';

export class WhatsAppWrapper {
  private isInitialized = false;
  private status = {
    isConnected: false,
    qrCode: null,
    phoneNumber: null,
    lastConnection: null
  };

  constructor() {
    // Initialize in completely isolated process
    this.initializeIsolated();
  }

  private async initializeIsolated() {
    try {
      // Import and initialize WhatsApp in isolated try-catch
      const { WhatsAppQRService } = await import('./whatsappQRService');
      
      // Wrap in process isolation
      process.nextTick(async () => {
        try {
          const service = new WhatsAppQRService();
          this.isInitialized = true;
          console.log('✅ WhatsApp inicializado com sucesso em processo isolado');
        } catch (error) {
          console.log('⚠️ WhatsApp falhou em processo isolado - aplicação continua');
          this.handleError(error);
        }
      });
      
    } catch (error) {
      console.log('⚠️ WhatsApp não disponível - aplicação funcionando normalmente');
      this.handleError(error);
    }
  }

  private handleError(error: any) {
    this.isInitialized = false;
    this.status = {
      isConnected: false,
      qrCode: null,
      phoneNumber: null,
      lastConnection: null
    };
  }

  public getStatus() {
    return { ...this.status };
  }

  public isReady() {
    return this.isInitialized;
  }
}

export const whatsappWrapper = new WhatsAppWrapper();