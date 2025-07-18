import qrcode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import P from 'pino';
import { storage } from '../../server/storage';
import { simpleInterviewService } from '../../server/simpleInterviewService';
import console from 'console';

interface WhatsAppQRConfig {
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
}

export class WhatsAppQRService {
  private socket: any = null;
  private config: WhatsAppQRConfig = {
    isConnected: false,
    qrCode: null,
    phoneNumber: null,
    lastConnection: null
  };
  private qrCodeListeners: ((qr: string | null) => void)[] = [];
  private connectionListeners: ((isConnected: boolean) => void)[] = [];
  private makeWASocket: any = null;
  private useMultiFileAuthState: any = null;
  private baileys: any = null;
  private isConnecting: boolean = false;
  private connectionPromise: Promise<void> | null = null;
  private currentClientId: string | null = null;

  constructor() {
    // Adicionar handler global para erros não capturados do Baileys
    process.on('uncaughtException', (error) => {
      if (error.message.includes('Unsupported state') || 
          error.message.includes('authenticate data') || 
          error.message.includes('Timed Out') || 
          error.message.includes('baileys') ||
          error.message.includes('cipher')) {
        this.handleWhatsAppError(error);
        return; // Não permitir que o processo termine
      }
      // Re-throw outros erros não relacionados ao WhatsApp
      throw error;
    });

    process.on('unhandledRejection', (reason) => {
      if (reason && typeof reason === 'object' && 'message' in reason) {
        const error = reason as Error;
        if (error.message.includes('Unsupported state') || 
            error.message.includes('authenticate data') || 
            error.message.includes('Timed Out') || 
            error.message.includes('baileys') ||
            error.message.includes('cipher')) {
          this.handleWhatsAppError(error);
          return;
        }
      }
    });

    // Inicializar de forma completamente assíncrona em background
    // Não deve bloquear a inicialização do servidor
    setImmediate(() => {
      this.safeInitialize().catch(error => {
        this.handleWhatsAppError(error);
      });
    });
  }

  private handleWhatsAppError(error: any) {
    // Resetar estado do WhatsApp para um estado seguro
    try {
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.end?.();
        this.socket = null;
      }
    } catch (cleanupError) {
      // Ignorar erros de limpeza
    }
    
    this.config.isConnected = false;
    this.config.qrCode = null;
    this.config.phoneNumber = null;
    this.isConnecting = false;
    this.connectionPromise = null;
    
    // Limpar diretório de sessão corrompida
    this.clearCorruptedSession().catch(() => {
      // Ignorar erros de limpeza
    });
    
    this.notifyConnectionListeners(false);
    this.notifyQRListeners(null);
  }

  private async clearCorruptedSession() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const sessionPath = path.join(process.cwd(), 'whatsapp-sessions');
      
      // Tentar remover sessão corrompida
      try {
        await fs.rm(sessionPath, { recursive: true, force: true });
      } catch (rmError) {
        // Ignorar se diretório não existe
      }
    } catch (error) {
      // Ignorar erros de limpeza
    }
  }

  private async safeInitialize() {
    try {
      // Timeout ainda mais curto para não atrasar o servidor - 3 segundos máximo
      await Promise.race([
        this.initializeWithTimeout(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na inicialização WhatsApp')), 3000)
        )
      ]);
      
    } catch (error) {
      this.config.isConnected = false;
      this.config.qrCode = null;
      this.config.phoneNumber = null;
      this.handleWhatsAppError(error);
    }
    
    // Sempre conectar ao sistema simplificado, mesmo se WhatsApp falhar
    try {
      simpleInterviewService.setWhatsAppService(this);
    } catch (serviceError) {
    }
  }

  private async initializeWithTimeout() {
    try {
      // Desabilitar inicialização do Baileys por enquanto para estabilizar aplicação
      throw new Error('WhatsApp temporariamente desabilitado');
      
      /*
      await this.initializeBaileys();
      
      try {
        await this.loadConnectionFromDB();
      } catch (dbError) {
      }
      
      // Timeout muito curto para conexão inicial - 2 segundos
      await Promise.race([
        this.initializeConnection(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na conexão WhatsApp')), 2000)
        )
      ]);
      */
      
    } catch (error) {
      throw error;
    }
  }

  private async initializeBaileys() {
    try {
      this.baileys = await import('@whiskeysockets/baileys');
      this.makeWASocket = this.baileys.default || this.baileys.makeWASocket;
      this.useMultiFileAuthState = this.baileys.useMultiFileAuthState;
      
      if (!this.makeWASocket) {
        throw new Error('makeWASocket não encontrado na biblioteca Baileys');
      }
    } catch (error) {
      throw error;
    }
  }

  private async loadConnectionFromDB() {
    try {
      // Usar nova arquitetura: buscar configuração específica do master
      const config = await storage.getApiConfig('master', '1749848502212');
      if (config) {
        // Atualizar configuração local com dados do banco
        this.config.isConnected = config.whatsappQrConnected || false;
        this.config.phoneNumber = config.whatsappQrPhoneNumber || null;
        this.config.lastConnection = config.whatsappQrLastConnection;
        
        // Se o banco indica que está conectado, notificar listeners
        if (this.config.isConnected) {
          this.notifyConnectionListeners(true);
        }
      }
    } catch (error) {
    }
  }

  private async saveConnectionToDB() {
    try {
      // Salvar na configuração do cliente ativo (isolamento por clientId)
      const clientId = this.currentClientId || '1749849987543'; // Default para Daniel
      const currentConfig = await storage.getApiConfig('client', clientId);
      
      // Detectar conexão real baseada no status atual
      const finalConnection = this.config.isConnected;
      const finalPhoneNumber = this.config.phoneNumber;
      
      await storage.upsertApiConfig({
        ...currentConfig,
        entityType: 'client',
        entityId: clientId,
        whatsappQrConnected: finalConnection,
        whatsappQrPhoneNumber: finalPhoneNumber,
        whatsappQrCode: this.config.qrCode, // Salvar QR Code também
        whatsappQrLastConnection: finalConnection ? new Date() : this.config.lastConnection,
        updatedAt: new Date()
      });
      
    } catch (error) {
    }
  }

  private async clearOldSessions() {
    try {
      // Só limpar sessões se realmente necessário (não a cada inicialização)
      if (this.socket) {
        return;
      }

      const fs = await import('fs');
      const path = await import('path');
      
      const authDir = './whatsapp-auth';
      if (fs.existsSync(authDir)) {
        // Verificar se há arquivos de sessão válidos
        const files = fs.readdirSync(authDir);
        const hasValidSession = files.some(file => 
          file.includes('creds.json') || file.includes('pre-key') || file.includes('session-')
        );

        if (!hasValidSession) {
          for (const file of files) {
            try {
              fs.unlinkSync(path.join(authDir, file));
            } catch (error) {
              // Ignorar erros de arquivos em uso
            }
          }
        }
      }
    } catch (error) {
    }
  }

  private async initializeConnection() {
    try {
      // Prevenir múltiplas conexões simultâneas
      if (this.isConnecting) {
        return this.connectionPromise;
      }

      if (this.socket && this.config.isConnected) {
        return;
      }

      this.isConnecting = true;
      this.connectionPromise = this._doInitializeConnection();
      
      try {
        await this.connectionPromise;
      } finally {
        this.isConnecting = false;
        this.connectionPromise = null;
      }
    } catch (error) {
      this.isConnecting = false;
      this.connectionPromise = null;
      throw error;
    }
  }

  private async _doInitializeConnection() {
    try {
      if (!this.makeWASocket || !this.useMultiFileAuthState) {
        return;
      }
      
      const { state, saveCreds } = await this.useMultiFileAuthState('./whatsapp-auth');
      
      this.socket = this.makeWASocket({
        auth: state,
        printQRInTerminal: false, // Desabilitar para evitar spam no console
        connectTimeoutMs: 120000, // 2 minutos timeout
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000, // Keep-alive mais agressivo
        retryRequestDelayMs: 2000, // Delay menor para tentativas
        maxMsgRetryCount: 5, // Mais tentativas
        qrTimeout: 180000, // QR Code válido por 3 minutos
        browser: ['Ubuntu', 'Chrome', '20.0.0'], // Browser moderno para Baileys v6.7.18
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false, // Não marcar online imediatamente
        shouldSyncHistoryMessage: () => false,
        emitOwnEvents: false,
        fireInitQueries: true, // Iniciar queries imediatamente
        version: [2, 2419, 6], // Versão estável do WhatsApp Web
        logger: P({ level: 'silent' }), // Logger silencioso
        getMessage: async (key) => {
          return {
            conversation: 'placeholder'
          };
        }
      });

      this.socket.ev.on('connection.update', async (update: any) => {
        try {
          const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
          
          // CORREÇÃO CRÍTICA: Se conexão está aberta, forçar reconexão de serviços WhatsApp
          if (connection === 'open') {
            
            // Configurar WhatsAppService no simpleInterviewService
            try {
              const whatsappService = {
                socket: this.socket,
                isConnected: () => true,
                sendMessage: async (to: string, message: any) => {
                  return await this.socket.sendMessage(to, message);
                }
              };
              
              simpleInterviewService.setWhatsAppService(whatsappService);
              
              // HEARTBEAT CRÍTICO: Ping a cada 8 segundos para manter conexão viva
              setInterval(async () => {
                try {
                  if (this.socket && this.socket.ws && this.socket.ws.readyState === 1) {
                    await this.socket.sendPresenceUpdate('available');
                  }
                } catch (pingError) {
                }
              }, 8000);
              
            } catch (serviceError) {
            }
          }
          
          if (qr) {
            // Evitar spam de QR codes - só gerar se diferente do anterior
            if (!this.config.qrCode || this.config.qrCode !== qr) {
              await this.generateQRCode(qr).catch(err => 
                null
              );
            }
          }
          
          if (connection === 'connecting') {
            this.config.isConnected = false;
            this.config.qrCode = null;
            this.notifyConnectionListeners(false);
          }
          
          if (connection === 'open') {
            
            // Extrair número do telefone conectado
            const phoneNumber = this.socket.user?.id?.split(':')[0] || null;
            
            // Atualizar configuração local
            this.config.isConnected = true;
            this.config.phoneNumber = phoneNumber;
            this.config.lastConnection = new Date();
            this.config.qrCode = null; // Limpar QR code após conectar
            
            // Notificar listeners
            this.notifyConnectionListeners(true);
            this.notifyQRListeners(null);
            
            // Salvar no banco de dados
            await this.saveConnectionToDB().catch(err => 
              null
            );
          }
          
          if (connection === 'close') {
            const errorCode = lastDisconnect?.error?.output?.statusCode;
            const errorMessage = lastDisconnect?.error?.message || 'Desconhecido';
            
            this.config.isConnected = false;
            this.config.phoneNumber = null;
            this.config.lastConnection = null;
            this.notifyConnectionListeners(false);
            
            // Salvar desconexão no banco de dados
            await this.saveConnectionToDB().catch(err => 
              null
            );
            
            // CORREÇÃO CRÍTICA: Detectar erro 428 como prioritário para reconexão imediata
            const isError428 = errorCode === 428 || errorMessage.includes('Connection Terminated by Server');
            const isStreamError = errorCode === 515 || errorMessage.includes('Stream Errored');
            const isConflictError = errorCode === 440 || errorMessage.includes('conflict') || errorMessage.includes('replaced');
            const shouldReconnect = errorCode !== 401 && errorCode !== 403 && 
                                   !errorMessage.includes('device_removed');
            
            // PRIORIDADE MÁXIMA: Erro 428 reconecta IMEDIATAMENTE
            if (isError428) {
              setTimeout(() => {
                this.initializeConnection().catch(err => 
                  null
                );
              }, 1000); // Apenas 1 segundo de delay
              return; // Sair imediatamente, não executar outras lógicas
            }
            
            if (isStreamError) {
              // Limpar credenciais antigas para forçar novo QR
              await this.clearOldSessions();
              setTimeout(() => {
                this.initializeConnection().catch(err => 
                  null
                );
              }, 5000);
            } else if (isConflictError) {
              // Para conflitos, limpar tudo e forçar nova autenticação
              this.config.isConnected = false;
              this.config.phoneNumber = null;
              this.config.lastConnection = null;
              this.config.qrCode = null;
              this.socket = null;
              
              // Limpar dados de autenticação para forçar novo QR Code
              try {
                const fs = await import('fs');
                const path = await import('path');
                const authDir = path.resolve('./whatsapp-auth');
                if (fs.existsSync(authDir)) {
                  fs.rmSync(authDir, { recursive: true, force: true });
                }
              } catch (cleanError) {
              }
              
              await this.saveConnectionToDB().catch(err => 
                null
              );
              this.notifyConnectionListeners(false);
              this.notifyQRListeners(null);
              
              // Iniciar processo de nova autenticação após delay
              setTimeout(() => {
                this.initializeConnection().catch(err => 
                  null
                );
              }, 5000);
            } else if (shouldReconnect) {
              setTimeout(() => {
                this.initializeConnection().catch(err => 
                  null
                );
              }, 5000);
            }
          }
        } catch (updateError) {
        }
      });

      this.socket.ev.on('creds.update', (creds: any) => {
        try {
          saveCreds();
        } catch (credsError) {
        }
      });
      
      this.socket.ev.on('messages.upsert', (data: any) => {
        try {
          this.handleIncomingMessages(data);
        } catch (messageError) {
        }
      });

    } catch (error) {
      this.config.isConnected = false;
      this.notifyConnectionListeners(false);
      
      // Tentar novamente em 30 segundos
      setTimeout(() => {
        this.initializeConnection().catch(err => 
          null
        );
      }, 30000);
    }
  }

  private async generateQRCode(qr: string) {
    try {
      const qrCodeDataURL = await qrcode.toDataURL(qr);
      this.config.qrCode = qrCodeDataURL;
      this.notifyQRListeners(qrCodeDataURL);
      
      qrcodeTerminal.generate(qr, { small: true });
    } catch (error) {
    }
  }

  private async handleIncomingMessages({ messages }: any) {
    try {
      for (const message of messages) {
        if (!message.key.fromMe && message.message) {
          const from = message.key.remoteJid;
          const text = message.message.conversation || 
                      message.message.extendedTextMessage?.text || '';
          const audioMessage = message.message?.audioMessage;
          
          try {
            // CORREÇÃO CRÍTICA: Detectar clientId automaticamente para todas as mensagens
            const phoneNumber = from.replace('@s.whatsapp.net', '');
            
            // Buscar candidato para obter clientId
            const candidates = await storage.getAllCandidates();
            const candidate = candidates.find(c => {
              const candidatePhone = (c.whatsapp || c.phone || '').replace(/\D/g, '');
              const searchPhone = phoneNumber.replace(/\D/g, '');
              return candidatePhone === searchPhone || candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
            });
            
            let detectedClientId = null;
            if (candidate) {
              detectedClientId = candidate.clientId?.toString();
            } else {
              detectedClientId = '1749849987543'; // Fallback para Grupo Maximuns
            }
            
            // CORREÇÃO CRÍTICA: Inicializar simpleInterviewService com este serviço WhatsApp ativo
            if (!simpleInterviewService.whatsappService) {
              simpleInterviewService.setWhatsAppService(this);
            }
            
            // Se é áudio, passar a mensagem completa para transcrição real
            if (audioMessage) {
              await simpleInterviewService.handleMessage(from, text, message, detectedClientId);
            } else {
              // Para mensagens de texto, usar o fluxo normal
              await simpleInterviewService.handleMessage(from, text, null, detectedClientId);
            }
          } catch (messageError) {
          }
        }
      }
    } catch (error) {
    }
  }

  private async processButtonResponse(from: string, buttonId: string) {
    
    if (buttonId.startsWith('start_interview_')) {
      // Extrair dados do botão: start_interview_{selectionId}_{candidateName}
      const parts = buttonId.split('_');
      const selectionId = parseInt(parts[2]);
      const candidateName = parts.slice(3).join('_');
      
      await this.startInterviewProcess(from, selectionId, candidateName);
    } 
    else if (buttonId.startsWith('decline_interview_')) {
      await this.sendTextMessage(from, "Obrigado pela resposta. Caso mude de ideia, entre em contato conosco.");
    }
  }

  private async startInterviewProcess(phoneNumber: string, selectionId: number, candidateName: string) {
    try {
      
      // Buscar dados da seleção e job
      const { storage } = await import('../../server/storage');
      const selection = await storage.getSelectionById(selectionId);
      if (!selection) {
        await this.sendTextMessage(phoneNumber, "Erro: seleção não encontrada.");
        return;
      }

      // Buscar job e perguntas
      let job = await storage.getJobById(selection.jobId);
      
      if (!job) {
        const allJobs = await storage.getJobsByClientId(selection.clientId);
        job = allJobs.find(j => j.id.toString().includes(selection.jobId.toString()) || selection.jobId.toString().includes(j.id.toString()));
        if (job) {
        }
      } else {
      }

      if (!job) {
        await this.sendTextMessage(phoneNumber, "Erro: vaga não encontrada.");
        return;
      }

      if (!job.perguntas || job.perguntas.length === 0) {
        await this.sendTextMessage(phoneNumber, "Desculpe, esta vaga não possui perguntas cadastradas. Entre em contato conosco.");
        return;
      }

      // Buscar candidato pelo telefone
      const phoneClean = phoneNumber.replace('@s.whatsapp.net', '');
      
      const allCandidates = await storage.getAllCandidates();
      const candidate = allCandidates.find(c => {
        if (!c.phone) return false;
        const candidatePhone = c.phone.replace(/\D/g, '');
        const searchPhone = phoneClean.replace(/\D/g, '');
        return candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
      });
      
      if (!candidate) {
        await this.sendTextMessage(phoneNumber, "Erro: candidato não encontrado.");
        return;
      }
      
      // Verificar se já existe entrevista em andamento
      const allInterviews = await storage.getAllInterviews();
      let interview = allInterviews.find(i => 
        i.selectionId === selectionId && 
        i.candidateId === candidate.id && 
        i.status === 'in_progress'
      );
      
      if (!interview) {
        // Criar nova entrevista apenas se não existir
        interview = await storage.createInterview({
          selectionId: selectionId,
          candidateId: candidate.id,
          token: `whatsapp_${Date.now()}`,
          status: 'in_progress'
        });
      } else {
      }

      // Enviar primeira pergunta por áudio
      await this.sendQuestionAudio(phoneNumber, candidateName, job.perguntas[0], interview.id, 0, job.perguntas.length);

    } catch (error) {
      await this.sendTextMessage(phoneNumber, "Desculpe, ocorreu um erro ao iniciar a entrevista. Tente novamente mais tarde.");
    }
  }

  private async sendQuestionAudio(phoneNumber: string, candidateName: string, question: any, interviewId: number, questionIndex: number, totalQuestions: number) {
    try {
      
      // Buscar configuração de voz
      const { storage } = await import('../../server/storage');
      const config = await storage.getApiConfig('master', '1749848502212');
      
      if (!config?.openaiApiKey) {
        await this.sendTextMessage(phoneNumber, `Pergunta ${questionIndex + 1}: ${question.pergunta}`);
        return;
      }

      // Preparar dados para TTS com velocidade mais lenta e formato OGG para mobile
      const ttsData = {
        model: "tts-1",
        input: question.pergunta,
        voice: config.openaiVoice || "nova",
        response_format: "opus",  // OGG/Opus funciona melhor no mobile
        speed: 1.0  // Velocidade normal do TTS
      };
      
      let response;
      try {
        // Criar AbortController para timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout
        
        response = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(ttsData),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
        }
        await this.sendTextMessage(phoneNumber, `Pergunta ${questionIndex + 1}: ${question.pergunta}`);
        return;
      }

      // Primeiro enviar pergunta por texto
      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      await this.sendTextMessage(phoneNumber, `Pergunta ${questionIndex + 1}: ${question.pergunta}`);
      
      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        
        // Aguardar um momento antes de enviar o áudio
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Enviar áudio via WhatsApp
        const sendResult = await this.socket.sendMessage(jid, {
          audio: Buffer.from(audioBuffer),
          mimetype: 'audio/mp4',
          ptt: true // Nota de voz
        });

        // Salvar estado da entrevista
        await this.saveInterviewState(interviewId, questionIndex, question.pergunta);
        
      } else {
        const errorText = await response.text();
      }

    } catch (error) {
      await this.sendTextMessage(phoneNumber, `Pergunta ${questionIndex + 1}: ${question.pergunta}`);
    }
  }

  private async processAudioResponse(from: string, message: any) {
    try {
      const { storage } = await import('../../server/storage');
      const fs = await import('fs');
      const path = await import('path');
      
      // Buscar candidato
      const phoneClean = from.replace('@s.whatsapp.net', '');
      
      const allCandidates = await storage.getAllCandidates();
      const candidate = allCandidates.find(c => {
        if (!c.phone) return false;
        const candidatePhone = c.phone.replace(/\D/g, '');
        const searchPhone = phoneClean.replace(/\D/g, '');
        return candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
      });
      
      if (!candidate) {
        await this.sendTextMessage(from, "Erro: candidato não encontrado.");
        return;
      }
      
      // Buscar entrevista em andamento para este candidato
      const allInterviews = await storage.getAllInterviews();
      
      let currentInterview = allInterviews.find(i => 
        i.candidateId === candidate.id && 
        i.status === 'in_progress'
      );
      
      if (!currentInterview) {
        await this.sendTextMessage(from, "Erro: entrevista não encontrada. Digite '1' novamente para iniciar.");
        return;
      }
      
      // Buscar seleção com logs detalhados
      
      // Tentar buscar por ID exato primeiro
      let selection = await storage.getSelectionById(currentInterview.selectionId);
      
      // Se não encontrou, listar todas as seleções para debug
      if (!selection) {
        const allSelections = await storage.getAllSelections();
        
        // Tentar encontrar seleção ativa para este candidato
        selection = allSelections.find(s => s.status === 'enviado');
        if (selection) {
          // Atualizar a entrevista com a seleção correta
          await storage.updateInterview(currentInterview.id, { 
            selectionId: selection.id 
          });
        }
      }
      
      if (!selection) {
        await this.sendTextMessage(from, "Erro: nenhuma seleção ativa encontrada. Tente enviar uma nova campanha.");
        return;
      }
      
      // Baixar arquivo de áudio usando método robusto
      
      try {
        // MÉTODO 1: Tentar downloadMediaMessage do Baileys (método principal)
        const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
        
        let audioBuffer: Buffer;
        
        audioBuffer = await downloadMediaMessage(
          message,
          'buffer',
          {},
          {
            logger: console,
            reuploadRequest: this.socket.updateMediaMessage
          }
        );
        
        if (!audioBuffer || audioBuffer.length < 1024) {
          
          // MÉTODO 2: Tentar downloadContentFromMessage
          try {
            const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
            
            const stream = await downloadContentFromMessage(message.message.audioMessage, 'audio');
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
            audioBuffer = Buffer.concat(chunks);
            
            if (audioBuffer && audioBuffer.length > 1024) {
            } else {
              throw new Error('Buffer ainda muito pequeno');
            }
          } catch (altError) {
            throw new Error('Todos os métodos de download falharam');
          }
        } else {
        }
        
      } catch (downloadError) {
        await this.sendTextMessage(from, "Erro ao baixar áudio. Tente enviar novamente.");
        return;
      }
      
      // Criar diretório de uploads se não existir
      const uploadsDir = './uploads';
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Salvar arquivo temporário primeiro para processamento
      const timestamp = Date.now();
      const tempAudioFileName = `whatsapp_audio_${timestamp}.ogg`;
      const tempAudioPath = path.join(uploadsDir, tempAudioFileName);
      
      try {
        fs.writeFileSync(tempAudioPath, audioBuffer);
      } catch (saveError) {
        await this.sendTextMessage(from, "Erro ao processar áudio. Tente novamente.");
        return;
      }
      
      // Buscar job com estratégia robusta
      let job = await storage.getJobById(selection.jobId);
      
      if (!job) {
        const allJobs = await storage.getJobsByClientId(selection.clientId);
        
        job = allJobs.find(j => 
          String(j.id).includes(String(selection.jobId)) || 
          String(selection.jobId).includes(String(j.id)) ||
          j.id === selection.jobId ||
          String(j.id) === String(selection.jobId)
        );
        
        if (job) {
          await storage.updateSelection(selection.id, { jobId: job.id });
        }
      }
      
      if (!job) {
        await this.sendTextMessage(from, "Erro: vaga não encontrada no sistema.");
        return;
      }
      
      if (!job.perguntas || job.perguntas.length === 0) {
        await this.sendTextMessage(from, "Erro: esta vaga não possui perguntas cadastradas.");
        return;
      }
      
      // Descobrir qual pergunta atual baseado nas respostas já dadas
      const allResponses = await storage.getAllResponses();
      const existingResponses = allResponses.filter(r => r.interviewId === currentInterview.id);
      const currentQuestionIndex = existingResponses.length;
      
      if (currentQuestionIndex >= job.perguntas.length) {
        await this.sendTextMessage(from, `🎉 Parabéns ${candidate.name}! Você já completou todas as perguntas da entrevista.`);
        return;
      }
      
      const currentQuestion = job.perguntas[currentQuestionIndex];
      
      // Buscar configuração OpenAI para transcrição
      const config = await storage.getApiConfig('master', '1749848502212');
      if (!config?.openaiApiKey) {
        await this.sendTextMessage(from, "Erro: sistema de transcrição não configurado.");
        return;
      }
      
      // Transcrever áudio usando OpenAI SDK (corrigido)
      let transcription = '';
      try {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: config.openaiApiKey });
        
        const transcriptionResult = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempAudioPath), 
          model: 'whisper-1',
          language: 'pt',
          response_format: 'text'
        });
        
        transcription = transcriptionResult || '';
        
        if (!transcription.trim()) {
          transcription = '[Áudio sem fala detectada]';
        }
        
      } catch (transcriptionError) {
        transcription = '[Erro na transcrição]';
      }
      
      // CRIAR ARQUIVO DEFINITIVO COM NOMENCLATURA CORRETA
      const selectionId = (currentInterview as any).selectionId || 'unknown';
      const questionNumber = currentQuestionIndex + 1;
      
      // Nova nomenclatura: audio_[telefone]_[selectionId]_R[numero].ogg
      const phoneForFilename = from.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      const audioFileName = `audio_${phoneForFilename}_${selectionId}_R${questionNumber}.ogg`;
      const audioPath = path.join(uploadsDir, audioFileName);
      
      try {
        // Copiar arquivo temporário para arquivo definitivo
        fs.copyFileSync(tempAudioPath, audioPath);
        
        // Remover arquivo temporário
        fs.unlinkSync(tempAudioPath);
        
      } catch (renameError) {
        // Se der erro, manter o arquivo temporário como definitivo
      }
      
      // Salvar resposta no banco de dados com logs detalhados
      try {
        const existingResponse = existingResponses.find(r => r.questionId === currentQuestion.id);
        let pontuacao = 50; // Valor padrão caso falhe
        
        if (existingResponse && existingResponse.score !== null && existingResponse.score !== undefined) {
          // Usar score já calculado para evitar gasto desnecessário de API
          pontuacao = existingResponse.score;
        } else {
          // Calcular pontuação usando IA apenas se não existe
          try {
            const { candidateEvaluationService } = await import('./candidateEvaluationService');
            const openaiApiKey = config.openaiApiKey;
            
            if (openaiApiKey && currentQuestion.respostaPerfeita && transcription) {
              const responseId = `whatsapp_response_${Date.now()}`;
              
              pontuacao = await candidateEvaluationService.evaluateInterviewResponse(
                responseId,
                currentQuestion.pergunta,
                transcription,
                currentQuestion.respostaPerfeita,
                openaiApiKey
              );
            }
          } catch (evaluationError) {
          }
        }

        const response = await storage.createResponse({
          interviewId: currentInterview.id,
          questionId: currentQuestion.id,
          responseText: transcription,
          audioUrl: audioFileName,
          score: pontuacao, // Pontuação de 0-100 calculada pela IA
          feedback: null
        });
        
        // Determinar próximos passos da entrevista
        const nextQuestionIndex = currentQuestionIndex + 1;
        const isLastQuestion = nextQuestionIndex >= job.perguntas.length;
        
        if (!isLastQuestion) {
          await this.sendTextMessage(from, `✅ Resposta ${currentQuestionIndex + 1} recebida! Preparando próxima pergunta...`);
          
          // Aguardar um momento antes de enviar próxima pergunta
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const nextQuestion = job.perguntas[nextQuestionIndex];
          
          await this.sendQuestionAudio(from, candidate.name, nextQuestion, currentInterview.id, nextQuestionIndex, job.perguntas.length);
          
        } else {
          // Última pergunta - finalizar entrevista
          const finalizationMessage = `🎉 Parabéns, ${candidate.name}! Você completou sua entrevista com sucesso. Todas as ${job.perguntas.length} perguntas foram respondidas. Nossa equipe analisará suas respostas e retornará em breve. Obrigado pela participação!`;
          
          await this.sendTextMessage(from, finalizationMessage);
          
          // Atualizar status da entrevista no banco
          await storage.updateInterview(currentInterview.id, { 
            status: 'completed',
            completedAt: new Date()
          });
        }
        
      } catch (saveError) {
        await this.sendTextMessage(from, "Erro ao salvar resposta. Tente novamente.");
      }
      
    } catch (error) {
      await this.sendTextMessage(from, "Erro ao processar resposta. Tente novamente.");
    }
  }

  private async processInterviewMessage(from: string, text: string, message: any) {
    try {
      
      // Normalizar texto
      const normalizedText = text.toLowerCase().trim();
      
      // Detectar respostas de aceitar entrevista
      if (normalizedText === 'sim' || normalizedText === '1' || 
          normalizedText === 'aceito' || normalizedText === 'começar' ||
          normalizedText === 'ok' || normalizedText === 'yes') {
        
        // Buscar seleção mais recente para este telefone
        const phoneClean = from.replace('@s.whatsapp.net', '');
        
        try {
          const { storage } = await import('../../server/storage');
          
          // Buscar todos os candidatos diretamente via storage
          const candidates = await storage.getCandidatesByClientId(1749849987543); // buscar do cliente ativo
          
          const candidate = candidates.find(c => {
            if (!c.phone) {
              return false;
            }
            const candidatePhone = c.phone.replace(/\D/g, '');
            const searchPhone = phoneClean.replace(/\D/g, '');
            const match = candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
            if (match) {
            }
            return match;
          });
          
          if (candidate) {
            
            // Buscar seleção mais recente que inclua este candidato
            const allSelections = await storage.getAllSelections();
            
            const candidateSelections = allSelections.filter(s => 
              s.candidateListId && s.status === 'enviado'
            );
            
            if (candidateSelections.length > 0) {
              // Pegar a seleção mais recente
              const selection = candidateSelections.sort((a, b) => 
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
              )[0];
              
              // Buscar job e suas perguntas
              let job = await storage.getJobById(selection.jobId);
              
              if (!job) {
                const allJobs = await storage.getJobsByClientId(selection.clientId);
                job = allJobs.find(j => j.id.toString().includes(selection.jobId.toString()) || selection.jobId.toString().includes(j.id.toString()));
                if (job) {
                }
              } else {
              }
              
              if (job && job.perguntas && job.perguntas.length > 0) {
                
                // Iniciar processo de entrevista
                await this.startInterviewProcess(from, selection.id, candidate.name);
                return;
              } else {
                if (job) {
                } else {
                }
              }
            } else {
            }
          } else {
          }
          
          // Fallback se não encontrar dados
          await this.sendTextMessage(from, "Perfeito! Iniciando sua entrevista...");
          
        } catch (error) {
          await this.sendTextMessage(from, "Perfeito! Iniciando sua entrevista...");
        }
        
      } 
      // Detectar respostas de recusar entrevista
      else if (normalizedText === 'não' || normalizedText === 'nao' || 
               normalizedText === '2' || normalizedText === 'recuso' || 
               normalizedText === 'no') {
        
        await this.sendTextMessage(from, "Obrigado pela resposta. Caso mude de ideia, entre em contato conosco.");
        
      } 
      // Mensagem padrão
      else {
        await this.sendTextMessage(from, `Olá! Para participar da entrevista, responda:

*"SIM"* ou *"1"* - para começar a entrevista
*"NÃO"* ou *"2"* - para não participar

Ou use os botões se disponíveis.`);
      }
      
    } catch (error) {
    }
  }

  private async saveInterviewState(interviewId: number, questionIndex: number, questionText: string) {
    try {
      const { storage } = await import('../../server/storage');
      
      // Salvar log da pergunta enviada
      await storage.createMessageLog({
        interviewId: interviewId,
        type: 'question',
        channel: 'whatsapp',
        status: 'sent',
        content: `Pergunta ${questionIndex + 1}: ${questionText}`
      });
      
    } catch (error) {
    }
  }

  public async sendTextMessage(phoneNumber: string, message: string): Promise<boolean> {
    
    try {
      // Verificações robustas de conectividade
      if (!this.socket) {
        await this.ensureInitialized();
        if (!this.socket) {
          return false;
        }
      }

      if (!this.socket.user) {
        await this.ensureInitialized();
        if (!this.socket || !this.socket.user) {
          return false;
        }
      }

      // Verificar estado do WebSocket de forma mais robusta
      if (!this.socket.ws || this.socket.ws.readyState !== 1) {
        
        // Força reconexão completa
        try {
          await this.ensureInitialized();
          
          // Verificar novamente após reconexão
          if (!this.socket?.ws || this.socket.ws.readyState !== 1) {
            return false;
          }
          
        } catch (reconnectError) {
          return false;
        }
      }

      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      
      // Verificar se o número existe no WhatsApp primeiro
      try {
        const [numberExists] = await this.socket.onWhatsApp(jid);
        if (!numberExists || !numberExists.exists) {
          return false;
        }
      } catch (checkError) {
      }
      
      // Envio com timeout reduzido
      const result = await Promise.race([
        this.socket.sendMessage(jid, { text: message }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout no envio')), 8000)
        )
      ]);
      
      if (result && result.key && result.key.id) {
        return true;
      } else {
        return false;
      }
      
    } catch (error: any) {
      
      // Tratar diferentes tipos de erro de conexão
      if (error?.message?.includes('Connection Closed') || 
          error?.message?.includes('Socket') ||
          error?.message?.includes('stream errored') ||
          error?.output?.statusCode === 428) {
        this.config.isConnected = false;
        await this.saveConnectionToDB();
      }
      
      return false;
    }
  }

  public async sendInterviewInvitation(
    phoneNumber: string, 
    candidateName: string, 
    jobTitle: string, 
    customMessage: string,
    selectionId: number
  ): Promise<boolean> {
    // Substituir placeholders na mensagem personalizada
    const personalizedMessage = customMessage
      .replace(/\[nome do candidato\]/g, candidateName)
      .replace(/\[Nome do Cliente\]/g, 'Grupo Maximus')
      .replace(/\[Nome da Vaga\]/g, jobTitle)
      .replace(/\[número de perguntas\]/g, '5'); // Placeholder por enquanto

    const finalMessage = `${personalizedMessage}

Você gostaria de iniciar a entrevista?`;

    // Enviar mensagem com botões interativos
    try {
      if (!this.socket || !this.config.isConnected) {
        throw new Error('WhatsApp QR não está conectado');
      }

      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      
      // Criar mensagem com botões (formato mais simples para máxima compatibilidade)
      const messageWithButtons = {
        text: finalMessage,
        footer: 'Sistema de Entrevistas IA',
        buttons: [
          {
            buttonId: `start_${selectionId}_${Date.now()}`,
            buttonText: { displayText: 'Sim, começar agora' },
            type: 1
          },
          {
            buttonId: `decline_${selectionId}_${Date.now()}`,
            buttonText: { displayText: 'Não quero participar' },
            type: 1
          }
        ],
        headerType: 1
      };

      try {
        // Enviar apenas texto simples com instruções claras
        const textWithInstructions = `${finalMessage}

*Para participar, responda:*
*1* - Sim, começar agora
*2* - Não quero participar`;

        const textResult = await this.socket.sendMessage(jid, { text: textWithInstructions });
        
        return true;
        
      } catch (quickError) {
        
        try {
          // Fallback para botões mais simples
          const simpleButtons = {
            text: finalMessage,
            buttons: [
              { buttonId: `start_${selectionId}`, buttonText: { displayText: 'Sim' }, type: 1 },
              { buttonId: `decline_${selectionId}`, buttonText: { displayText: 'Não' }, type: 1 }
            ]
          };
          
          const simpleResult = await this.socket.sendMessage(jid, simpleButtons);
          return true;
          
        } catch (simpleError) {
          
          try {
            // Fallback para lista interativa
            const listMessage = {
              text: finalMessage,
              footer: 'Sistema de Entrevistas IA',
              title: 'Entrevista de Emprego',
              buttonText: 'Escolha uma opção',
              sections: [{
                title: 'Opções',
                rows: [
                  {
                    rowId: `start_${selectionId}_${Date.now()}`,
                    title: 'Sim, começar agora',
                    description: 'Iniciar a entrevista'
                  },
                  {
                    rowId: `decline_${selectionId}_${Date.now()}`,
                    title: 'Não quero participar',
                    description: 'Recusar a entrevista'
                  }
                ]
              }]
            };

            const listResult = await this.socket.sendMessage(jid, listMessage);
            return true;
            
          } catch (listError) {
            
            // Fallback final para texto simples
            const textMessage = `${finalMessage}

*Responda com:*
• "SIM" ou "1" para começar a entrevista
• "NÃO" ou "2" para não participar`;
            
            return await this.sendTextMessage(phoneNumber, textMessage);
          }
        }
      }

    } catch (error) {
      return false;
    }
  }

  public getConnectionStatus(): WhatsAppQRConfig {
    return { ...this.config };
  }

  public setClientId(clientId: string) {
    this.currentClientId = clientId;
  }

  public onQRCode(callback: (qr: string | null) => void) {
    this.qrCodeListeners.push(callback);
  }

  public onConnectionChange(callback: (isConnected: boolean) => void) {
    this.connectionListeners.push(callback);
  }

  private notifyQRListeners(qr: string | null) {
    this.qrCodeListeners.forEach(callback => callback(qr));
  }

  getStatus() {
    return {
      isConnected: this.config.isConnected,
      phoneNumber: this.config.phoneNumber,
      qrCode: this.config.qrCode,
      lastConnection: this.config.lastConnection
    };
  }

  async connect(): Promise<{ success: boolean; message: string; qrCode?: string }> {
    try {
      await this.initializeConnection();
      return { 
        success: true, 
        message: 'Conexão iniciada',
        qrCode: this.config.qrCode || undefined
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  private notifyConnectionListeners(isConnected: boolean) {
    this.connectionListeners.forEach(callback => callback(isConnected));
  }

  public async disconnect() {
    try {
      if (this.socket) {
        await this.socket.logout();
        this.socket = null;
      }
      
      this.config.isConnected = false;
      this.config.qrCode = null;
      this.config.phoneNumber = null;
      this.config.lastConnection = null;
      
      this.notifyConnectionListeners(false);
      this.notifyQRListeners(null);
      
    } catch (error) {
    }
  }

  public async ensureInitialized(): Promise<void> {
    if (!this.baileys) {
      try {
        this.baileys = await import('@whiskeysockets/baileys');
        this.makeWASocket = this.baileys.default;
        this.useMultiFileAuthState = this.baileys.useMultiFileAuthState;
      } catch (error) {
        throw new Error('Falha na inicialização do WhatsApp');
      }
    }

    // Verificar se socket existe e está funcional para envio de mensagens
    const isSocketFunctional = this.socket && 
                               this.socket.user && 
                               this.socket.ws && 
                               this.socket.ws.readyState === 1;

    if (!isSocketFunctional) {
      
      // Limpar socket antigo
      this.socket = null;
      
      // Forçar nova conexão
      await this.initializeConnection();
      
      // Aguardar estabelecimento completo da conexão WebSocket
      let attempts = 0;
      const maxAttempts = 15;
      
      while (attempts < maxAttempts) {
        if (this.socket?.ws?.readyState === 1 && this.socket?.user) {
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (!this.socket?.ws || this.socket.ws.readyState !== 1) {
        throw new Error('Falha ao estabelecer conexão WebSocket funcional para envio de mensagens');
      }
    }
  }

  public async reconnect() {
    await this.disconnect();
    
    // Limpa o estado atual
    this.config.isConnected = false;
    this.config.qrCode = null;
    this.config.phoneNumber = null;
    this.config.lastConnection = null;
    
    // Remove credenciais antigas para forçar novo QR
    try {
      const fs = await import('fs');
      const path = await import('path');
      const authPath = path.join(process.cwd(), 'whatsapp-auth');
      
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
    } catch (error) {
    }
    
    // Força uma nova inicialização
    setTimeout(() => {
      this.initializeConnection();
    }, 2000);
  }
}

export const whatsappQRService = new WhatsAppQRService();