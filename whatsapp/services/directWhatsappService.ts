import { storage } from './storage';

interface WhatsAppMessage {
  phoneNumber: string;
  message: string;
  timestamp: Date;
}

export class DirectWhatsAppService {
  private messageQueue: WhatsAppMessage[] = [];
  private isProcessing = false;

  // Método direto para enviar mensagens sem depender de WebSocket
  async sendDirectMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      console.log(`📱 Enviando mensagem direta para ${phoneNumber}`);
      
      // Adicionar à fila de mensagens
      this.messageQueue.push({
        phoneNumber: phoneNumber.replace(/\D/g, ''), // Limpar formatação
        message,
        timestamp: new Date()
      });

      // Processar fila se não estiver processando
      if (!this.isProcessing) {
        await this.processQueue();
      }

      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem direta:', error);
      return false;
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.messageQueue.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      // Importar Baileys dinamicamente quando necessário
      const { makeWASocket, useMultiFileAuthState, DisconnectReason } = await import('@whiskeysockets/baileys');
      
      console.log('🔄 Processando fila de mensagens WhatsApp...');
      
      // Tentar conexão direta para envio
      const { state, saveCreds } = await useMultiFileAuthState('./whatsapp-auth');
      
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        connectTimeoutMs: 15000,
        defaultQueryTimeoutMs: 10000,
        browser: ['Sistema Entrevistas Direct', 'Chrome', '1.0.0']
      });

      // Aguardar conexão
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout na conexão')), 20000);
        
        socket.ev.on('connection.update', (update) => {
          const { connection, lastDisconnect } = update;
          
          if (connection === 'open') {
            clearTimeout(timeout);
            resolve(true);
          } else if (connection === 'close') {
            clearTimeout(timeout);
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) {
              reject(new Error('Conexão fechada'));
            } else {
              reject(new Error('Falha na autenticação'));
            }
          }
        });

        socket.ev.on('creds.update', saveCreds);
      });

      // Processar todas as mensagens na fila
      while (this.messageQueue.length > 0) {
        const messageData = this.messageQueue.shift()!;
        
        try {
          const formattedNumber = `55${messageData.phoneNumber}@s.whatsapp.net`;
          
          await socket.sendMessage(formattedNumber, {
            text: messageData.message
          });
          
          console.log(`✅ Mensagem enviada para ${messageData.phoneNumber}`);
          
          // Delay entre mensagens
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (sendError) {
          console.error(`❌ Erro ao enviar para ${messageData.phoneNumber}:`, sendError);
          // Recolocar na fila para tentar novamente
          this.messageQueue.unshift(messageData);
          break;
        }
      }

      // Fechar conexão
      socket.end();
      
    } catch (error) {
      console.error('❌ Erro no processamento da fila:', error);
    } finally {
      this.isProcessing = false;
      
      // Se ainda há mensagens na fila, tentar novamente em 30 segundos
      if (this.messageQueue.length > 0) {
        setTimeout(() => this.processQueue(), 30000);
      }
    }
  }

  // Enviar convite de entrevista específico
  async sendInterviewInvite(phoneNumber: string, candidateName: string, jobName: string): Promise<boolean> {
    const message = `Olá ${candidateName}! 

Somos da Grupo Maximuns e você se cadastrou para a vaga de ${jobName}.

Você foi selecionado(a) para a próxima etapa: uma entrevista virtual por áudio.

📋 Como funciona:
• Enviamos 3 perguntas por áudio
• Você responde também por áudio
• Não precisa gravar vídeo
• Nossa equipe analisa suas respostas

Para começar a entrevista, responda:
1️⃣ "1" ou "SIM" para iniciar
2️⃣ "2" ou "NÃO" para cancelar

Aguardamos sua resposta!`;

    return await this.sendDirectMessage(phoneNumber, message);
  }

  // Verificar status da fila
  getQueueStatus() {
    return {
      queueSize: this.messageQueue.length,
      isProcessing: this.isProcessing,
      nextMessage: this.messageQueue[0] || null
    };
  }
}

export const directWhatsappService = new DirectWhatsAppService();