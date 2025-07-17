/**
 * SISTEMA DE FALLBACK PARA ERRO 405
 * 
 * Este serviço implementa um sistema de contorno para o erro 405 "Connection Failure"
 * que está impedindo o handler de mensagens de funcionar corretamente.
 */

import { EventEmitter } from 'events';

interface FallbackConnection {
  connectionId: string;
  clientId: string;
  slotNumber: number;
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
  service: 'baileys-fallback';
  manuallyDisconnected: boolean;
  messageHandler?: (from: string, text: string, audioMessage?: any, clientId?: string) => Promise<void>;
}

export class BaileysFallbackService extends EventEmitter {
  private connections = new Map<string, FallbackConnection>();
  private messageHandlers = new Map<string, Function>();
  private simulateConnection = false;
  
  constructor() {
    super();
    console.log('🔄 [BAILEYS-FALLBACK] Serviço de fallback inicializado');
  }
  
  /**
   * Ativar modo de simulação para testing
   */
  enableSimulationMode() {
    this.simulateConnection = true;
    console.log('🎭 [BAILEYS-FALLBACK] Modo de simulação ativado');
  }
  
  /**
   * Registrar handler de mensagens para um cliente específico
   */
  registerMessageHandler(clientId: string, handler: Function) {
    this.messageHandlers.set(clientId, handler);
    console.log(`📝 [BAILEYS-FALLBACK] Handler registrado para cliente ${clientId}`);
  }
  
  /**
   * Simular conexão enquanto aguarda correção do erro 405
   */
  async connectToWhatsApp(connectionId: string, clientId: string, slotNumber: number): Promise<any> {
    console.log(`🔄 [BAILEYS-FALLBACK] Iniciando conexão fallback para slot ${slotNumber}...`);
    
    try {
      // Simular QR Code para manter interface funcionando
      const simulatedQRCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      
      const connection: FallbackConnection = {
        connectionId,
        clientId,
        slotNumber,
        isConnected: false,
        qrCode: simulatedQRCode,
        phoneNumber: null,
        lastConnection: new Date(),
        service: 'baileys-fallback',
        manuallyDisconnected: false
      };
      
      this.connections.set(connectionId, connection);
      
      // Simular processo de conexão
      setTimeout(() => {
        if (this.simulateConnection) {
          console.log(`✅ [BAILEYS-FALLBACK] Simulando conexão estabelecida para slot ${slotNumber}`);
          connection.isConnected = true;
          connection.qrCode = null;
          connection.phoneNumber = `55119${Math.floor(Math.random() * 100000000)}`;
          
          // Configurar handler de mensagens simulado
          this.setupMessageHandler(connectionId, clientId, slotNumber);
          
          this.emit('connectionUpdate', {
            connectionId,
            isConnected: true,
            phoneNumber: connection.phoneNumber
          });
        }
      }, 5000);
      
      console.log(`🎭 [BAILEYS-FALLBACK] QR Code simulado retornado para slot ${slotNumber}`);
      
      return {
        success: true,
        qrCode: simulatedQRCode,
        message: `[FALLBACK] QR Code simulado para slot ${slotNumber} - Aguardando correção erro 405`
      };
      
    } catch (error: any) {
      console.log(`❌ [BAILEYS-FALLBACK] Erro no fallback slot ${slotNumber}:`, error.message);
      
      return {
        success: false,
        message: `[FALLBACK] Erro: ${error.message}`
      };
    }
  }
  
  /**
   * Configurar handler de mensagens simulado
   */
  private setupMessageHandler(connectionId: string, clientId: string, slotNumber: number) {
    console.log(`📡 [BAILEYS-FALLBACK] Configurando handler simulado para slot ${slotNumber}`);
    
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    // Simular handler de mensagens que seria configurado no Baileys
    connection.messageHandler = async (from: string, text: string, audioMessage?: any, detectedClientId?: string) => {
      console.log(`📨 [BAILEYS-FALLBACK] Handler simulado - Nova mensagem:`, {
        from,
        text,
        hasAudio: !!audioMessage,
        clientId: detectedClientId || clientId
      });
      
      // Chamar handler real do sistema
      const registeredHandler = this.messageHandlers.get(clientId);
      if (registeredHandler) {
        try {
          await registeredHandler(from, text, audioMessage, detectedClientId || clientId);
          console.log(`✅ [BAILEYS-FALLBACK] Handler real processado com sucesso`);
        } catch (error) {
          console.error(`❌ [BAILEYS-FALLBACK] Erro no handler real:`, error);
        }
      } else {
        console.warn(`⚠️ [BAILEYS-FALLBACK] Handler não encontrado para cliente ${clientId}`);
      }
    };
  }
  
  /**
   * Simular recebimento de mensagem (para testes)
   */
  async simulateMessage(connectionId: string, from: string, text: string, audioMessage?: any) {
    console.log(`🎭 [BAILEYS-FALLBACK] Simulando mensagem recebida:`, { from, text, hasAudio: !!audioMessage });
    
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.messageHandler) {
      console.warn(`⚠️ [BAILEYS-FALLBACK] Handler não encontrado para conexão ${connectionId}`);
      return;
    }
    
    await connection.messageHandler(from, text, audioMessage, connection.clientId);
  }
  
  /**
   * Obter status da conexão
   */
  getConnectionStatus(connectionId: string): any {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return {
        isConnected: false,
        phoneNumber: null,
        qrCode: null,
        service: 'baileys-fallback'
      };
    }
    
    return {
      isConnected: connection.isConnected,
      phoneNumber: connection.phoneNumber,
      qrCode: connection.qrCode,
      service: connection.service
    };
  }
  
  /**
   * Obter todas as conexões de um cliente
   */
  getClientConnections(clientId: string): FallbackConnection[] {
    const clientConnections: FallbackConnection[] = [];
    
    for (const connection of this.connections.values()) {
      if (connection.clientId === clientId) {
        clientConnections.push(connection);
      }
    }
    
    return clientConnections;
  }
  
  /**
   * Simular envio de mensagem
   */
  async sendMessage(clientId: string, slotNumber: number, phoneNumber: string, message: string): Promise<any> {
    console.log(`📤 [BAILEYS-FALLBACK] Simulando envio de mensagem:`, {
      clientId,
      slotNumber,
      phoneNumber,
      messageLength: message.length
    });
    
    const connectionId = `${clientId}_${slotNumber}`;
    const connection = this.connections.get(connectionId);
    
    if (!connection || !connection.isConnected) {
      return {
        success: false,
        message: `[FALLBACK] Slot ${slotNumber} não está conectado`
      };
    }
    
    // Simular sucesso no envio
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`✅ [BAILEYS-FALLBACK] Mensagem simulada enviada com sucesso`);
    
    return {
      success: true,
      message: `[FALLBACK] Mensagem enviada via slot ${slotNumber}`
    };
  }
  
  /**
   * Desconectar uma conexão
   */
  async disconnect(connectionId: string): Promise<any> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { success: false, message: 'Conexão não encontrada' };
    }
    
    connection.isConnected = false;
    connection.qrCode = null;
    connection.phoneNumber = null;
    connection.manuallyDisconnected = true;
    
    console.log(`🔌 [BAILEYS-FALLBACK] Conexão ${connectionId} desconectada`);
    
    this.emit('connectionUpdate', {
      connectionId,
      isConnected: false,
      phoneNumber: null
    });
    
    return { success: true, message: 'Desconectado com sucesso' };
  }
  
  /**
   * Limpar todas as conexões
   */
  clearAllConnections() {
    console.log(`🧹 [BAILEYS-FALLBACK] Limpando todas as conexões`);
    this.connections.clear();
    this.messageHandlers.clear();
  }
}

// Singleton instance
export const baileysFallbackService = new BaileysFallbackService();