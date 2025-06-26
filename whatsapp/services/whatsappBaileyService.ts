import { storage } from '../../server/storage';
import { interactiveInterviewService } from './interactiveInterviewService';

// Usar import dinâmico para baileys e qrcode
let makeWASocket: any;
let useMultiFileAuthState: any;
let QRCode: any;

async function initializeDependencies() {
  if (!makeWASocket) {
    console.log('📦 Carregando dependências Baileys...');
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    const qrCodeModule = await import('qrcode');
    QRCode = qrCodeModule.default || qrCodeModule;
    console.log('📦 Dependências carregadas com sucesso');
  }
}

interface WhatsAppState {
  qrCode: string;
  isConnected: boolean;
  phoneNumber: string | null;
  socket: any;
}

class WhatsAppBaileyService {
  private connections: Map<string, WhatsAppState> = new Map();

  async initWhatsApp(clientId: string) {
    console.log(`🔑 Inicializando WhatsApp para cliente ${clientId}`);
    
    // Inicializar dependências primeiro
    await initializeDependencies();
    
    if (this.connections.has(clientId)) {
      const existing = this.connections.get(clientId)!;
      if (existing.isConnected) {
        console.log(`✅ Cliente ${clientId} já conectado`);
        return existing;
      }
    }

    try {
      const authDir = `whatsapp-sessions/client_${clientId}`;
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      
      const sock = makeWASocket({ 
        auth: state,
        printQRInTerminal: false,
        logger: {
          level: 'silent',
          child: () => ({ level: 'silent' }),
          trace: () => {},
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
          fatal: () => {}
        },
        defaultQueryTimeoutMs: 20000,
        connectTimeoutMs: 15000,
        keepAliveIntervalMs: 20000,
        retryRequestDelayMs: 1000,
        maxMsgRetryCount: 2, 
        printQRInTerminal: false,
        browser: ["WhatsApp Business", "Chrome", "118.0.0.0"],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000
      });

      const connectionState: WhatsAppState = {
        qrCode: '',
        isConnected: false,
        phoneNumber: null,
        socket: sock
      };

      this.connections.set(clientId, connectionState);

      sock.ev.on('connection.update', async ({ connection, qr }: any) => {
        if (qr) {
          connectionState.qrCode = await QRCode.toDataURL(qr);
          console.log(`📱 QR Code gerado para cliente ${clientId} - Length: ${connectionState.qrCode.length}`);
          console.log(`📱 QR Code Preview: ${connectionState.qrCode.substring(0, 50)}...`);
          await this.saveConnectionToDB(clientId, connectionState);
        }
        
        if (connection === 'open') {
          console.log(`✅ WhatsApp conectado para cliente ${clientId}`);
          connectionState.isConnected = true;
          connectionState.phoneNumber = sock.user?.id?.split(':')[0] || null;
          connectionState.qrCode = '';
          
          // Salvar status CONECTADO no banco
          try {
            const config = await storage.getApiConfig('client', clientId) || {};
            await storage.upsertApiConfig({
              ...config,
              entityType: 'client',
              entityId: clientId,
              whatsappQrConnected: true,
              whatsappQrPhoneNumber: connectionState.phoneNumber,
              whatsappQrCode: null, // Limpar QR Code quando conectado
              whatsappQrLastConnection: new Date()
            });
            console.log(`💾 Status CONECTADO salvo no banco para cliente ${clientId}`);
          } catch (error) {
            console.log(`❌ Erro ao salvar status conectado:`, error.message);
          }
        }
        
        if (connection === 'close') {
          console.log(`🔌 WhatsApp desconectado para cliente ${clientId}`);
          connectionState.isConnected = false;
          connectionState.phoneNumber = null;
          
          // Salvar status DESCONECTADO no banco
          try {
            const config = await storage.getApiConfig('client', clientId) || {};
            await storage.upsertApiConfig({
              ...config,
              entityType: 'client',
              entityId: clientId,
              whatsappQrConnected: false,
              whatsappQrPhoneNumber: null,
              whatsappQrLastConnection: new Date()
            });
            console.log(`💾 Status DESCONECTADO salvo no banco para cliente ${clientId}`);
          } catch (error) {
            console.log(`❌ Erro ao salvar status desconectado:`, error.message);
          }
          
          // Reconecta automaticamente após 2 segundos
          setTimeout(() => this.initWhatsApp(clientId), 2000);
        }
      });

      // Handler de mensagens com correção para download de áudio
      sock.ev.on('messages.upsert', async ({ messages }: any) => {
        for (const message of messages) {
          if (message.key.fromMe || !message.message) continue;
          
          const from = message.key.remoteJid;
          if (!from || !from.includes('@s.whatsapp.net')) continue;
          
          console.log(`📨 [INTERVIEW] Nova mensagem de ${from}`);
          
          // Extrair texto da mensagem
          let messageText = '';
          if (message.message.conversation) {
            messageText = message.message.conversation;
          } else if (message.message.extendedTextMessage?.text) {
            messageText = message.message.extendedTextMessage.text;
          }
          
          // Processar áudio com correção de payload
          if (message.message.audioMessage || message.message.viewOnceMessageV2) {
            console.log(`🎵 [INTERVIEW] Mensagem de áudio detectada - processando com correção`);
            await this.processAudioMessageWithFix(message, from, messageText, clientId, sock);
          } else {
            // Processar mensagem de texto normalmente
            try {
              const { interactiveInterviewService } = await import('./interactiveInterviewService');
              await interactiveInterviewService.handleMessage(from, messageText, null, clientId);
            } catch (error) {
              console.log(`❌ [INTERVIEW] Erro ao processar mensagem de texto:`, error.message);
            }
          }
        }
      });

      sock.ev.on('creds.update', saveCreds);

      // Keep-alive agressivo a cada 10 segundos para Replit
      const keepAliveInterval = setInterval(() => {
        if (sock?.sendPresenceUpdate && connectionState.isConnected) {
          try {
            sock.sendPresenceUpdate('available');
            console.log(`💓 [${clientId}] Keep-alive ping enviado`);
          } catch (error) {
            console.log(`⚠️ [${clientId}] Erro no keep-alive:`, error.message);
          }
        }
      }, 10000);

      // Limpar interval quando conexão fechar
      sock.ev.on('connection.update', ({ connection }) => {
        if (connection === 'close') {
          clearInterval(keepAliveInterval);
          console.log(`🔄 [${clientId}] Keep-alive interval limpo`);
        }
      });

      return connectionState;
    } catch (error) {
      console.error(`❌ Erro ao inicializar WhatsApp para cliente ${clientId}:`, error);
      throw error;
    }
  }

  private async saveConnectionToDB(clientId: string, state: WhatsAppState) {
    try {
      const currentConfig = await storage.getApiConfig('client', clientId);
      
      await storage.upsertApiConfig({
        ...currentConfig,
        entityType: 'client',
        entityId: clientId,
        whatsappQrConnected: state.isConnected,
        whatsappQrPhoneNumber: state.phoneNumber,
        whatsappQrCode: state.qrCode,
        whatsappQrLastConnection: state.isConnected ? new Date() : null
      });
      
      console.log(`💾 Status WhatsApp salvo para cliente ${clientId}: ${state.isConnected ? 'CONECTADO' : 'DESCONECTADO'}`);
      console.log(`💾 QR Code salvo: ${state.qrCode ? 'SIM' : 'NÃO'} - Length: ${state.qrCode?.length || 0}`);
    } catch (error) {
      console.error('❌ Erro ao salvar no banco:', error);
    }
  }

  getQR(clientId: string): string {
    const connection = this.connections.get(clientId);
    return connection?.qrCode || '';
  }

  isConnected(clientId: string): boolean {
    const connection = this.connections.get(clientId);
    return connection?.isConnected || false;
  }

  getPhoneNumber(clientId: string): string | null {
    const connection = this.connections.get(clientId);
    return connection?.phoneNumber || null;
  }

  getConnection(clientId: string): WhatsAppState | undefined {
    return this.connections.get(clientId);
  }

  async sendMessage(clientId: string, phone: string, text: string): Promise<boolean> {
    const connection = this.connections.get(clientId);
    
    if (!connection || !connection.isConnected) {
      throw new Error('WhatsApp não conectado para este cliente');
    }

    try {
      const formattedNumber = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
      const result = await connection.socket.sendMessage(formattedNumber, { text });
      console.log(`✅ Mensagem enviada para ${phone} via cliente ${clientId}:`, result?.key?.id);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via cliente ${clientId}:`, error);
      return false;
    }
  }

  getStatus(clientId: string) {
    const connection = this.connections.get(clientId);
    return {
      isConnected: connection?.isConnected || false,
      qrCode: connection?.qrCode || null,
      phoneNumber: connection?.phoneNumber || null
    };
  }

  getAllConnections() {
    return this.connections;
  }

  async connect(clientId: string) {
    const existingConnection = this.connections.get(clientId);
    if (existingConnection?.isConnected) {
      console.log(`📱 Cliente ${clientId} já conectado`);
      return {
        success: true,
        qrCode: null,
        message: 'Já conectado'
      };
    }
    
    return await this.initWhatsApp(clientId);
  }

  private async processAudioMessageWithFix(message: any, from: string, messageText: string, clientId: string, sock: any) {
    try {
      console.log(`🔄 [AUDIO_FIX] Iniciando processamento de áudio corrigido`);
      
      // Aguardar para garantir que o payload está completo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Recarregar mensagem completa se necessário
      let fullMessage = message;
      if (!message.message?.audioMessage && !message.message?.viewOnceMessageV2) {
        console.log(`🔄 [AUDIO_FIX] Recarregando mensagem completa...`);
        try {
          // Tentar buscar mensagem completa
          const reloadedMessage = await sock.loadMessage?.(message.key.remoteJid, message.key.id);
          if (reloadedMessage) {
            fullMessage = reloadedMessage;
            console.log(`✅ [AUDIO_FIX] Mensagem recarregada com sucesso`);
          }
        } catch (reloadError) {
          console.log(`⚠️ [AUDIO_FIX] Falha ao recarregar, usando mensagem original`);
        }
      }
      
      // Verificar novamente se temos áudio após reload
      if (!fullMessage.message?.audioMessage && !fullMessage.message?.viewOnceMessageV2) {
        console.log(`⚠️ [AUDIO_FIX] Áudio ainda não disponível, agendando retry em 2s`);
        setTimeout(() => {
          this.processAudioMessageWithFix(message, from, messageText, clientId, sock);
        }, 2000);
        return;
      }
      
      // Desembrulhar viewOnce/ephemeral se necessário
      let audioNode = fullMessage.message.audioMessage;
      if (fullMessage.message.viewOnceMessageV2?.message?.audioMessage) {
        audioNode = fullMessage.message.viewOnceMessageV2.message.audioMessage;
        console.log(`📦 [AUDIO_FIX] Áudio viewOnce detectado`);
      }
      
      if (!audioNode) {
        console.log(`❌ [AUDIO_FIX] AudioNode não encontrado após processamento`);
        // Fallback para processamento normal
        const { interactiveInterviewService } = await import('./interactiveInterviewService');
        await interactiveInterviewService.handleMessage(from, messageText, fullMessage, clientId);
        return;
      }
      
      console.log(`📋 [AUDIO_FIX] AudioNode encontrado:`, {
        mimetype: audioNode.mimetype,
        seconds: audioNode.seconds,
        fileLength: audioNode.fileLength,
        hasUrl: !!audioNode.url
      });
      
      // Download do áudio com método corrigido
      let audioBuffer: Buffer | null = null;
      try {
        const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(audioNode, 'audio');
        
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        audioBuffer = Buffer.concat(chunks);
        
        if (audioBuffer && audioBuffer.length > 100) {
          console.log(`✅ [AUDIO_FIX] Áudio baixado com sucesso: ${audioBuffer.length} bytes`);
          
          // Salvar áudio em arquivo temporário
          const fs = await import('fs');
          const audioPath = `uploads/audio_${from.replace('@s.whatsapp.net', '')}_${Date.now()}_fixed.ogg`;
          await fs.promises.writeFile(audioPath, audioBuffer);
          
          // Criar estrutura de mensagem corrigida para o handler
          const correctedMessage = {
            ...fullMessage,
            _audioBuffer: audioBuffer,
            _audioPath: audioPath,
            _audioFixed: true
          };
          
          // Processar via serviço de entrevistas com áudio corrigido
          const { interactiveInterviewService } = await import('./interactiveInterviewService');
          await interactiveInterviewService.handleMessage(from, messageText, correctedMessage, clientId);
          
        } else {
          console.log(`⚠️ [AUDIO_FIX] Buffer muito pequeno: ${audioBuffer?.length || 0} bytes`);
          throw new Error('Buffer inválido');
        }
        
      } catch (downloadError) {
        console.log(`❌ [AUDIO_FIX] Erro no download: ${downloadError.message}`);
        
        // Fallback para processamento normal
        const { interactiveInterviewService } = await import('./interactiveInterviewService');
        await interactiveInterviewService.handleMessage(from, messageText, fullMessage, clientId);
      }
      
    } catch (error) {
      console.log(`❌ [AUDIO_FIX] Erro geral no processamento:`, error.message);
      
      // Fallback final
      try {
        const { interactiveInterviewService } = await import('./interactiveInterviewService');
        await interactiveInterviewService.handleMessage(from, messageText, message, clientId);
      } catch (fallbackError) {
        console.log(`❌ [AUDIO_FIX] Fallback também falhou:`, fallbackError.message);
      }
    }
  }

  async disconnect(clientId: string) {
    const connection = this.connections.get(clientId);
    if (connection?.socket) {
      await connection.socket.logout();
      this.connections.delete(clientId);
      console.log(`🔌 Cliente ${clientId} desconectado`);
    }
  }

  async restoreConnections() {
    try {
      console.log('🔄 Restaurando conexões WhatsApp após restart...');
      
      const fs = await import('fs');
      if (fs.existsSync('./whatsapp-sessions')) {
        const sessions = fs.readdirSync('./whatsapp-sessions');
        
        for (const sessionDir of sessions) {
          if (sessionDir.startsWith('client_')) {
            const clientId = sessionDir.replace('client_', '');
            const credsPath = `./whatsapp-sessions/${sessionDir}/creds.json`;
            
            if (fs.existsSync(credsPath)) {
              console.log(`📱 Restaurando sessão para cliente ${clientId}...`);
              try {
                await this.initWhatsApp(clientId);
              } catch (error) {
                console.log(`❌ Erro ao restaurar cliente ${clientId}:`, error.message);
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`❌ Erro na restauração:`, error.message);
    }
  }

  async clearSession(clientId: string): Promise<void> {
    try {
      console.log(`🧹 [BAILEY] Iniciando limpeza completa de sessão para cliente ${clientId}...`);
      
      // 1. Desconectar sessão ativa se existir
      await this.disconnect(clientId);
      
      // 2. Limpar arquivos de sessão do disco
      const fs = await import('fs');
      const path = await import('path');
      const sessionPath = path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}`);
      
      if (fs.existsSync(sessionPath)) {
        const files = fs.readdirSync(sessionPath);
        console.log(`🧹 [BAILEY] Removendo ${files.length} arquivos de sessão: ${files.slice(0,3).join(', ')}${files.length > 3 ? '...' : ''}`);
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`✅ [BAILEY] Pasta de sessão removida: ${sessionPath}`);
      } else {
        console.log(`ℹ️ [BAILEY] Nenhuma pasta de sessão encontrada: ${sessionPath}`);
      }
      
      // 3. Limpar status no Firebase via storage
      try {
        const currentConfig = await storage.getApiConfig('client', clientId);
        await storage.upsertApiConfig({
          ...currentConfig,
          entityType: 'client',
          entityId: clientId,
          whatsappQrConnected: false,
          whatsappQrCode: null,
          whatsappQrPhoneNumber: null
        });
        console.log(`✅ [BAILEY] Status limpo no Firebase para cliente ${clientId}`);
      } catch (firebaseError) {
        console.log(`⚠️ [BAILEY] Erro ao limpar Firebase (não crítico): ${firebaseError.message}`);
      }
      
      console.log(`✅ [BAILEY] Limpeza completa finalizada para cliente ${clientId}`);
    } catch (error) {
      console.error(`❌ [BAILEY] Erro ao limpar sessão para cliente ${clientId}:`, error);
      throw error;
    }
  }
}

export const whatsappBaileyService = new WhatsAppBaileyService();