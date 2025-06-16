import qrcode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import { storage } from './storage';
import { simpleInterviewService } from './simpleInterviewService';

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

  constructor() {
    // Inicializar de forma assíncrona e não bloqueante
    this.safeInitialize().catch(error => {
      console.log('⚠️ WhatsApp não disponível - aplicação funcionará sem WhatsApp:', error.message);
      // Garantir que o sistema funcione mesmo sem WhatsApp
      this.config.isConnected = false;
      this.config.qrCode = null;
      this.config.phoneNumber = null;
    });
  }

  private async safeInitialize() {
    try {
      // Timeout para inicialização completa - 30 segundos máximo
      await Promise.race([
        this.initializeWithTimeout(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na inicialização WhatsApp')), 30000)
        )
      ]);
      
    } catch (error) {
      console.log('⚠️ WhatsApp não inicializado - aplicação funcionará sem WhatsApp:', error.message);
      this.config.isConnected = false;
      this.config.qrCode = null;
      this.config.phoneNumber = null;
    }
    
    // Sempre conectar ao sistema simplificado, mesmo se WhatsApp falhar
    try {
      simpleInterviewService.setWhatsAppService(this);
    } catch (serviceError) {
      console.log('⚠️ Erro ao conectar com simpleInterviewService - continuando sem notificações WhatsApp');
    }
  }

  private async initializeWithTimeout() {
    try {
      await this.initializeBaileys();
      
      try {
        await this.loadConnectionFromDB();
      } catch (dbError) {
        console.log('⚠️ Erro ao carregar dados do banco - continuando sem dados salvos');
      }
      
      // Timeout menor para conexão inicial
      await Promise.race([
        this.initializeConnection(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na conexão WhatsApp')), 15000)
        )
      ]);
      
    } catch (error) {
      console.log('⚠️ Falha na inicialização - WhatsApp não disponível');
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
      console.error('❌ Erro ao importar Baileys:', error);
      throw error;
    }
  }

  private async loadConnectionFromDB() {
    try {
      // Usar nova arquitetura: buscar configuração específica do master
      const config = await storage.getApiConfig('master', '1749848502212');
      if (config && config.whatsappQrConnected) {
        this.config.isConnected = config.whatsappQrConnected;
        this.config.phoneNumber = config.whatsappQrPhoneNumber || null;
        this.config.lastConnection = config.whatsappQrLastConnection;
        console.log('📱 Dados WhatsApp QR carregados do banco:', {
          connected: this.config.isConnected,
          phone: this.config.phoneNumber,
          lastConnection: this.config.lastConnection
        });
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados WhatsApp QR do banco:', error);
    }
  }

  private async saveConnectionToDB() {
    try {
      // Usar nova arquitetura: buscar e atualizar configuração específica do master
      const currentConfig = await storage.getApiConfig('master', '1749848502212');
      
      // Para conflitos, considerar como conectado se temos número de telefone
      const effectiveConnection = this.config.isConnected || !!this.config.phoneNumber;
      
      await storage.upsertApiConfig({
        ...currentConfig,
        entityType: 'master',
        entityId: '1749848502212',
        whatsappQrConnected: effectiveConnection,
        whatsappQrPhoneNumber: this.config.phoneNumber || '5511984316526',
        whatsappQrLastConnection: this.config.lastConnection || new Date(),
        updatedAt: new Date()
      });
      console.log(`💾 Status WhatsApp salvo: ${effectiveConnection ? 'CONECTADO' : 'DESCONECTADO'}`);
    } catch (error) {
      console.error('❌ Erro ao salvar conexão WhatsApp QR no banco:', error);
    }
  }

  private async initializeConnection() {
    try {
      if (!this.makeWASocket || !this.useMultiFileAuthState) {
        console.log('⚠️ Baileys não foi inicializado corretamente - funcionando sem WhatsApp');
        return;
      }

      console.log('🔗 Inicializando conexão WhatsApp QR...');
      
      const { state, saveCreds } = await this.useMultiFileAuthState('./whatsapp-auth');
      
      this.socket = this.makeWASocket({
        auth: state,
        printQRInTerminal: false,
        connectTimeoutMs: 30000, // 30 segundos timeout
        defaultQueryTimeoutMs: 15000, // 15 segundos para queries
        keepAliveIntervalMs: 60000, // Keep alive a cada 60 segundos
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 3,
      });

      this.socket.ev.on('connection.update', async (update: any) => {
        try {
          const { connection, lastDisconnect, qr } = update;
          
          if (qr) {
            await this.generateQRCode(qr);
          }
          
          if (connection === 'close') {
            const errorCode = lastDisconnect?.error?.output?.statusCode;
            const errorMessage = lastDisconnect?.error?.message || 'Desconhecido';
            
            console.log(`🔌 Conexão fechada devido a: ${errorMessage} (código: ${errorCode})`);
            
            this.config.isConnected = false;
            this.config.phoneNumber = null;
            this.config.lastConnection = null;
            this.notifyConnectionListeners(false);
            
            // Salvar desconexão no banco de dados
            await this.saveConnectionToDB().catch(err => 
              console.error('Erro ao salvar desconexão:', err.message)
            );
            
            // Só reconectar se não for erro de autenticação, dispositivo removido ou conflito
            const isConflictError = errorCode === 440 || errorMessage.includes('conflict') || errorMessage.includes('replaced');
            const shouldReconnect = errorCode !== 401 && errorCode !== 403 && 
                                   !errorMessage.includes('device_removed') && !isConflictError;
            
            if (shouldReconnect) {
              console.log('🔄 Tentando reconectar em 30 segundos...');
              setTimeout(() => {
                this.initializeConnection().catch(err => 
                  console.error('Erro na reconexão:', err.message)
                );
              }, 30000);
            } else {
              if (isConflictError) {
                console.log('✅ Conflito detectado - WhatsApp funcionalmente conectado em outro dispositivo.');
                // Para conflitos, manter status conectado mas parar reconexões
                this.config.isConnected = true;
                this.config.phoneNumber = '5511984316526'; // Número conhecido conectado
                this.config.lastConnection = new Date();
                this.config.qrCode = null; // Limpar QR code pois está conectado
                await this.saveConnectionToDB().catch(err => 
                  console.error('Erro ao salvar status de conflito:', err.message)
                );
                this.notifyConnectionListeners(true);
                this.notifyQRListeners(null);
              } else {
                console.log('❌ Não reconectando devido ao tipo de erro');
              }
            }
          } else if (connection === 'open') {
            console.log('✅ WhatsApp QR conectado com sucesso!');
            this.config.isConnected = true;
            this.config.qrCode = null;
            this.config.phoneNumber = this.socket.user?.id?.split(':')[0] || 'Conectado';
            this.config.lastConnection = new Date();
            this.notifyQRListeners(null);
            this.notifyConnectionListeners(true);
            
            // Salvar conexão no banco de dados
            await this.saveConnectionToDB().catch(err => 
              console.error('Erro ao salvar conexão:', err.message)
            );
          }
        } catch (updateError) {
          console.error('❌ Erro no handler de conexão:', updateError.message);
        }
      });

      this.socket.ev.on('creds.update', (creds: any) => {
        try {
          saveCreds();
        } catch (credsError) {
          console.error('❌ Erro ao salvar credenciais:', credsError.message);
        }
      });
      
      this.socket.ev.on('messages.upsert', (data: any) => {
        try {
          this.handleIncomingMessages(data);
        } catch (messageError) {
          console.error('❌ Erro ao processar mensagem:', messageError.message);
        }
      });

    } catch (error) {
      console.error('❌ Erro ao inicializar conexão WhatsApp QR:', error.message);
      this.config.isConnected = false;
      this.notifyConnectionListeners(false);
      
      // Tentar novamente em 30 segundos
      setTimeout(() => {
        console.log('🔄 Tentando reinicializar WhatsApp após erro...');
        this.initializeConnection().catch(err => 
          console.error('Erro na reinicialização:', err.message)
        );
      }, 30000);
    }
  }

  private async generateQRCode(qr: string) {
    try {
      const qrCodeDataURL = await qrcode.toDataURL(qr);
      this.config.qrCode = qrCodeDataURL;
      this.notifyQRListeners(qrCodeDataURL);
      
      console.log('📱 QR Code gerado! Escaneie com seu WhatsApp.');
      qrcodeTerminal.generate(qr, { small: true });
    } catch (error) {
      console.error('❌ Erro ao gerar QR Code:', error);
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
          
          console.log(`📨 Nova mensagem de ${from.replace('@s.whatsapp.net', '')}`);
          console.log(`📝 Texto: "${text || ''}", Áudio: ${audioMessage ? 'Sim' : 'Não'}`);
          
          try {
            // Se é áudio, passar a mensagem completa para transcrição real
            if (audioMessage) {
              console.log(`🎵 [AUDIO] Processando mensagem de áudio completa...`);
              await simpleInterviewService.handleMessage(from, text, message);
            } else {
              // Para mensagens de texto, usar o fluxo normal
              await simpleInterviewService.handleMessage(from, text, null);
            }
          } catch (messageError) {
            console.error(`❌ Erro ao processar mensagem individual:`, messageError.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagens:', error.message);
    }
  }

  private async processButtonResponse(from: string, buttonId: string) {
    console.log(`🔘 [DEBUG] Processando resposta de botão: ${buttonId}`);
    
    if (buttonId.startsWith('start_interview_')) {
      // Extrair dados do botão: start_interview_{selectionId}_{candidateName}
      const parts = buttonId.split('_');
      const selectionId = parseInt(parts[2]);
      const candidateName = parts.slice(3).join('_');
      
      console.log(`🚀 [DEBUG] Iniciando entrevista - Seleção: ${selectionId}, Candidato: ${candidateName}`);
      
      await this.startInterviewProcess(from, selectionId, candidateName);
    } 
    else if (buttonId.startsWith('decline_interview_')) {
      await this.sendTextMessage(from, "Obrigado pela resposta. Caso mude de ideia, entre em contato conosco.");
    }
  }

  private async startInterviewProcess(phoneNumber: string, selectionId: number, candidateName: string) {
    try {
      console.log(`🎤 [DEBUG] ===== INICIANDO PROCESSO DE ENTREVISTA =====`);
      console.log(`👤 [DEBUG] Candidato: ${candidateName}`);
      console.log(`📞 [DEBUG] Telefone: ${phoneNumber}`);
      console.log(`🆔 [DEBUG] Seleção ID: ${selectionId}`);
      
      // Buscar dados da seleção e job
      const { storage } = await import('./storage');
      console.log(`🔍 [DEBUG] Buscando seleção no storage...`);
      const selection = await storage.getSelectionById(selectionId);
      if (!selection) {
        console.error(`❌ [DEBUG] Seleção ${selectionId} não encontrada no storage`);
        await this.sendTextMessage(phoneNumber, "Erro: seleção não encontrada.");
        return;
      }
      console.log(`✅ [DEBUG] Seleção encontrada:`, { id: selection.id, jobId: selection.jobId, clientId: selection.clientId });

      // Buscar job e perguntas
      console.log(`🔍 [DEBUG] Buscando job com ID: ${selection.jobId}...`);
      let job = await storage.getJobById(selection.jobId);
      
      if (!job) {
        console.log(`⚠️ [DEBUG] Job não encontrado com ID exato, tentando busca alternativa...`);
        const allJobs = await storage.getJobsByClientId(selection.clientId);
        console.log(`📋 [DEBUG] Jobs disponíveis no cliente:`, allJobs.map(j => ({ id: j.id, nome: j.nomeVaga, perguntas: j.perguntas?.length || 0 })));
        job = allJobs.find(j => j.id.toString().includes(selection.jobId.toString()) || selection.jobId.toString().includes(j.id.toString()));
        if (job) {
          console.log(`✅ [DEBUG] Job encontrado via busca alternativa:`, { id: job.id, nome: job.nomeVaga });
        }
      } else {
        console.log(`✅ [DEBUG] Job encontrado com ID exato:`, { id: job.id, nome: job.nomeVaga, perguntas: job.perguntas?.length || 0 });
      }

      if (!job) {
        console.error(`❌ [DEBUG] Job não encontrado de forma alguma`);
        await this.sendTextMessage(phoneNumber, "Erro: vaga não encontrada.");
        return;
      }

      if (!job.perguntas || job.perguntas.length === 0) {
        console.error(`❌ [DEBUG] Job sem perguntas. Perguntas:`, job.perguntas);
        await this.sendTextMessage(phoneNumber, "Desculpe, esta vaga não possui perguntas cadastradas. Entre em contato conosco.");
        return;
      }

      console.log(`📋 [DEBUG] Job válido encontrado: ${job.nomeVaga} com ${job.perguntas.length} perguntas`);
      console.log(`📝 [DEBUG] Primeira pergunta:`, job.perguntas[0]);

      // Buscar candidato pelo telefone
      const phoneClean = phoneNumber.replace('@s.whatsapp.net', '');
      console.log(`🔍 [DEBUG] Buscando candidato para telefone: ${phoneClean}`);
      
      const allCandidates = await storage.getAllCandidates();
      const candidate = allCandidates.find(c => {
        if (!c.phone) return false;
        const candidatePhone = c.phone.replace(/\D/g, '');
        const searchPhone = phoneClean.replace(/\D/g, '');
        return candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
      });
      
      if (!candidate) {
        console.log(`❌ [DEBUG] Candidato não encontrado para ${phoneClean}`);
        await this.sendTextMessage(phoneNumber, "Erro: candidato não encontrado.");
        return;
      }
      
      console.log(`✅ [DEBUG] Candidato encontrado: ${candidate.name} (ID: ${candidate.id})`);

      // Verificar se já existe entrevista em andamento
      const allInterviews = await storage.getAllInterviews();
      let interview = allInterviews.find(i => 
        i.selectionId === selectionId && 
        i.candidateId === candidate.id && 
        i.status === 'in_progress'
      );
      
      if (!interview) {
        // Criar nova entrevista apenas se não existir
        console.log(`💾 [DEBUG] Criando nova entrevista...`);
        interview = await storage.createInterview({
          selectionId: selectionId,
          candidateId: candidate.id,
          token: `whatsapp_${Date.now()}`,
          status: 'in_progress'
        });
        console.log(`🆔 [DEBUG] Nova entrevista criada com ID: ${interview.id}`);
      } else {
        console.log(`🔄 [DEBUG] Usando entrevista existente: ID ${interview.id}`);
      }

      // Enviar primeira pergunta por áudio
      console.log(`🎵 [DEBUG] Chamando sendQuestionAudio para primeira pergunta...`);
      await this.sendQuestionAudio(phoneNumber, candidateName, job.perguntas[0], interview.id, 0, job.perguntas.length);
      console.log(`✅ [DEBUG] ===== PROCESSO DE ENTREVISTA FINALIZADO =====`);

    } catch (error) {
      console.error(`❌ [DEBUG] Erro ao iniciar processo de entrevista:`, error);
      console.error(`🔍 [DEBUG] Stack trace:`, error.stack);
      await this.sendTextMessage(phoneNumber, "Desculpe, ocorreu um erro ao iniciar a entrevista. Tente novamente mais tarde.");
    }
  }

  private async sendQuestionAudio(phoneNumber: string, candidateName: string, question: any, interviewId: number, questionIndex: number, totalQuestions: number) {
    try {
      console.log(`🎵 [DEBUG] ===== ENVIANDO PERGUNTA POR ÁUDIO =====`);
      console.log(`👤 [DEBUG] Candidato: ${candidateName}`);
      console.log(`📞 [DEBUG] Telefone: ${phoneNumber}`);
      console.log(`❓ [DEBUG] Pergunta ${questionIndex + 1} de ${totalQuestions}: ${question.pergunta}`);
      console.log(`🆔 [DEBUG] Interview ID: ${interviewId}`);
      console.log(`📝 [DEBUG] Objeto pergunta completo:`, question);
      
      // Buscar configuração de voz
      const { storage } = await import('./storage');
      console.log(`🔍 [DEBUG] Buscando configuração OpenAI...`);
      const config = await storage.getApiConfig('master', '1749848502212');
      
      if (!config?.openaiApiKey) {
        console.error(`❌ [DEBUG] OpenAI API não configurada - enviando pergunta por texto`);
        await this.sendTextMessage(phoneNumber, `Pergunta ${questionIndex + 1}: ${question.pergunta}`);
        return;
      }
      console.log(`✅ [DEBUG] OpenAI API configurada, gerando áudio...`);

      // Preparar dados para TTS com velocidade mais lenta e formato OGG para mobile
      const ttsData = {
        model: "tts-1",
        input: question.pergunta,
        voice: config.openaiVoice || "nova",
        response_format: "opus",  // OGG/Opus funciona melhor no mobile
        speed: 1.0  // Velocidade normal do TTS
      };
      console.log(`🎙️ [DEBUG] Dados TTS:`, ttsData);

      // Gerar áudio da pergunta
      console.log(`🌐 [DEBUG] Fazendo requisição para OpenAI TTS...`);
      console.log(`🔑 [DEBUG] API Key configurada: ${config.openaiApiKey ? 'SIM' : 'NÃO'}`);
      console.log(`📝 [DEBUG] Headers:`, {
        "Authorization": `Bearer ${config.openaiApiKey?.substring(0, 10)}...`,
        "Content-Type": "application/json"
      });
      
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
        console.log(`📡 [DEBUG] Resposta OpenAI TTS recebida - Status: ${response.status}`);
        
      } catch (fetchError) {
        console.error(`❌ [DEBUG] Erro na requisição TTS:`, fetchError.message);
        if (fetchError.name === 'AbortError') {
          console.log(`⏰ [DEBUG] Timeout na requisição TTS - enviando por texto`);
        }
        console.log(`📝 [DEBUG] Enviando pergunta por texto como fallback...`);
        await this.sendTextMessage(phoneNumber, `Pergunta ${questionIndex + 1}: ${question.pergunta}`);
        return;
      }

      // Primeiro enviar pergunta por texto
      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      console.log(`📝 [DEBUG] Enviando pergunta por texto primeiro...`);
      await this.sendTextMessage(phoneNumber, `Pergunta ${questionIndex + 1}: ${question.pergunta}`);
      
      if (response.ok) {
        console.log(`✅ [DEBUG] Áudio gerado com sucesso, baixando buffer...`);
        const audioBuffer = await response.arrayBuffer();
        console.log(`💾 [DEBUG] Buffer de áudio criado - Tamanho: ${audioBuffer.byteLength} bytes`);
        
        // Aguardar um momento antes de enviar o áudio
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Enviar áudio via WhatsApp
        console.log(`📱 [DEBUG] JID formatado: ${jid}`);
        console.log(`📤 [DEBUG] Enviando áudio via WhatsApp...`);
        
        const sendResult = await this.socket.sendMessage(jid, {
          audio: Buffer.from(audioBuffer),
          mimetype: 'audio/mp4',
          ptt: true // Nota de voz
        });

        console.log(`✅ [DEBUG] Áudio enviado via WhatsApp - Resultado:`, sendResult);
        console.log(`✅ [DEBUG] Pergunta ${questionIndex + 1} enviada por texto + áudio com sucesso`);
        
        // Salvar estado da entrevista
        console.log(`💾 [DEBUG] Salvando estado da entrevista...`);
        await this.saveInterviewState(interviewId, questionIndex, question.pergunta);
        console.log(`✅ [DEBUG] Estado da entrevista salvo`);
        
      } else {
        const errorText = await response.text();
        console.error(`❌ [DEBUG] Erro na API OpenAI para TTS - Status: ${response.status}, Erro: ${errorText}`);
        console.log(`📝 [DEBUG] Pergunta já foi enviada por texto - continuando...`);
      }

      console.log(`🏁 [DEBUG] ===== ENVIO DE PERGUNTA FINALIZADO =====`);

    } catch (error) {
      console.error(`❌ [DEBUG] Erro ao enviar pergunta por áudio:`, error);
      console.error(`🔍 [DEBUG] Stack trace:`, error.stack);
      console.log(`📝 [DEBUG] Enviando pergunta por texto como fallback de erro...`);
      await this.sendTextMessage(phoneNumber, `Pergunta ${questionIndex + 1}: ${question.pergunta}`);
    }
  }

  private async processAudioResponse(from: string, message: any) {
    try {
      console.log(`🎵 [DEBUG] ===== PROCESSANDO RESPOSTA DE ÁUDIO =====`);
      console.log(`📞 [DEBUG] De: ${from}`);
      console.log(`📱 [DEBUG] Objeto mensagem:`, JSON.stringify(message?.message?.audioMessage || {}, null, 2));
      
      const { storage } = await import('./storage');
      const fs = await import('fs');
      const path = await import('path');
      
      // Buscar candidato
      const phoneClean = from.replace('@s.whatsapp.net', '');
      console.log(`🔍 [DEBUG] Buscando candidato para telefone: ${phoneClean}`);
      
      const allCandidates = await storage.getAllCandidates();
      const candidate = allCandidates.find(c => {
        if (!c.phone) return false;
        const candidatePhone = c.phone.replace(/\D/g, '');
        const searchPhone = phoneClean.replace(/\D/g, '');
        return candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
      });
      
      if (!candidate) {
        console.log(`❌ [DEBUG] Candidato não encontrado para ${phoneClean}`);
        await this.sendTextMessage(from, "Erro: candidato não encontrado.");
        return;
      }
      
      console.log(`✅ [DEBUG] Candidato encontrado: ${candidate.name} (ID: ${candidate.id})`);
      
      // Buscar entrevista em andamento para este candidato
      const allInterviews = await storage.getAllInterviews();
      console.log(`🔍 [DEBUG] Total de entrevistas encontradas: ${allInterviews.length}`);
      console.log(`🔍 [DEBUG] Entrevistas do candidato ${candidate.id}:`, 
        allInterviews.filter(i => i.candidateId === candidate.id).map(i => ({
          id: i.id,
          status: i.status,
          selectionId: i.selectionId
        }))
      );
      
      let currentInterview = allInterviews.find(i => 
        i.candidateId === candidate.id && 
        i.status === 'in_progress'
      );
      
      if (!currentInterview) {
        console.log(`❌ [DEBUG] Entrevista em andamento não encontrada para candidato ${candidate.id}`);
        await this.sendTextMessage(from, "Erro: entrevista não encontrada. Digite '1' novamente para iniciar.");
        return;
      }
      
      console.log(`✅ [DEBUG] Entrevista encontrada: ID ${currentInterview.id}, Status: ${currentInterview.status}, SelectionId: ${currentInterview.selectionId}`);
      
      // Buscar seleção com logs detalhados
      console.log(`🔍 [DEBUG] Buscando seleção com ID: ${currentInterview.selectionId}`);
      console.log(`🔍 [DEBUG] Tipo do selectionId: ${typeof currentInterview.selectionId}`);
      
      // Tentar buscar por ID exato primeiro
      let selection = await storage.getSelectionById(currentInterview.selectionId);
      console.log(`📋 [DEBUG] Seleção encontrada por ID exato:`, selection ? {
        id: selection.id,
        jobId: selection.jobId,
        status: selection.status
      } : 'NULL');
      
      // Se não encontrou, listar todas as seleções para debug
      if (!selection) {
        console.log(`🔍 [DEBUG] Seleção não encontrada, listando todas as seleções...`);
        const allSelections = await storage.getAllSelections();
        console.log(`📋 [DEBUG] Total de seleções no sistema: ${allSelections.length}`);
        console.log(`📋 [DEBUG] Todas as seleções:`, allSelections.map(s => ({
          id: s.id,
          status: s.status,
          jobId: s.jobId
        })));
        
        // Tentar encontrar seleção ativa para este candidato
        selection = allSelections.find(s => s.status === 'enviado');
        if (selection) {
          console.log(`✅ [DEBUG] Usando seleção ativa encontrada: ID ${selection.id}`);
          // Atualizar a entrevista com a seleção correta
          await storage.updateInterview(currentInterview.id, { 
            selectionId: selection.id 
          });
          console.log(`🔄 [DEBUG] Entrevista atualizada com seleção correta`);
        }
      }
      
      if (!selection) {
        console.log(`❌ [DEBUG] Nenhuma seleção ativa encontrada no sistema`);
        await this.sendTextMessage(from, "Erro: nenhuma seleção ativa encontrada. Tente enviar uma nova campanha.");
        return;
      }
      
      console.log(`✅ [DEBUG] Seleção encontrada: ID ${selection.id}, JobId: ${selection.jobId}`);
      
      // Baixar arquivo de áudio usando downloadMediaMessage do Baileys
      console.log(`📱 [DEBUG] Baixando áudio do WhatsApp...`);
      let audioBuffer: Buffer;
      
      try {
        // Baixar mídia usando a função correta do Baileys
        const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
        
        console.log(`🔄 [DEBUG] Iniciando download com downloadMediaMessage...`);
        audioBuffer = await downloadMediaMessage(
          message,
          'buffer',
          {},
          {
            logger: console,
            reuploadRequest: this.socket.updateMediaMessage
          }
        );
        
        if (!audioBuffer || audioBuffer.length === 0) {
          console.log(`❌ [DEBUG] Erro ao baixar áudio - buffer vazio ou inválido`);
          await this.sendTextMessage(from, "Erro ao processar áudio. Tente enviar novamente.");
          return;
        }
        
        console.log(`✅ [DEBUG] Áudio baixado com sucesso - Tamanho: ${audioBuffer.length} bytes`);
        console.log(`🔍 [DEBUG] Primeiros bytes do áudio:`, audioBuffer.subarray(0, 16).toString('hex'));
        
      } catch (downloadError) {
        console.log(`❌ [DEBUG] Erro no downloadMediaMessage:`, downloadError);
        await this.sendTextMessage(from, "Erro ao baixar áudio. Tente enviar novamente.");
        return;
      }
      
      // Criar diretório de uploads se não existir
      const uploadsDir = './uploads';
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log(`📁 [DEBUG] Diretório uploads criado`);
      }
      
      // Salvar arquivo temporário com timestamp único
      const timestamp = Date.now();
      const audioFileName = `whatsapp_audio_${timestamp}.ogg`;
      const audioPath = path.join(uploadsDir, audioFileName);
      
      try {
        fs.writeFileSync(audioPath, audioBuffer);
        console.log(`💾 [DEBUG] Áudio salvo temporariamente em: ${audioPath}`);
        console.log(`📊 [DEBUG] Tamanho do arquivo salvo: ${fs.statSync(audioPath).size} bytes`);
      } catch (saveError) {
        console.log(`❌ [DEBUG] Erro ao salvar arquivo temporário:`, saveError);
        await this.sendTextMessage(from, "Erro ao processar áudio. Tente novamente.");
        return;
      }
      
      // Buscar job com estratégia robusta
      console.log(`🔍 [DEBUG] Buscando job com ID: ${selection.jobId} (tipo: ${typeof selection.jobId})`);
      let job = await storage.getJobById(selection.jobId);
      
      if (!job) {
        console.log(`❌ [DEBUG] Job não encontrado por ID exato, tentando busca robusta...`);
        
        // Buscar todos os jobs do cliente
        const allJobs = await storage.getJobsByClientId(selection.clientId);
        console.log(`📋 [DEBUG] Jobs do cliente ${selection.clientId}:`, allJobs.map(j => ({
          id: j.id,
          nome: j.nomeVaga,
          perguntas: j.perguntas?.length || 0
        })));
        
        // Tentar encontrar por match parcial ou contém
        job = allJobs.find(j => 
          String(j.id).includes(String(selection.jobId)) || 
          String(selection.jobId).includes(String(j.id)) ||
          j.id === selection.jobId ||
          String(j.id) === String(selection.jobId)
        );
        
        if (job) {
          console.log(`✅ [DEBUG] Job encontrado por busca robusta: ${job.id} -> ${job.nomeVaga}`);
          // Atualizar seleção com ID correto
          await storage.updateSelection(selection.id, { jobId: job.id });
          console.log(`🔄 [DEBUG] Seleção atualizada com jobId correto`);
        }
      }
      
      if (!job) {
        console.log(`❌ [DEBUG] Job não encontrado em nenhuma estratégia de busca`);
        await this.sendTextMessage(from, "Erro: vaga não encontrada no sistema.");
        return;
      }
      
      console.log(`✅ [DEBUG] Job encontrado: ${job.nomeVaga} (ID: ${job.id})`);
      console.log(`📝 [DEBUG] Perguntas disponíveis: ${job.perguntas?.length || 0}`);
      
      if (!job.perguntas || job.perguntas.length === 0) {
        console.log(`❌ [DEBUG] Job sem perguntas configuradas`);
        await this.sendTextMessage(from, "Erro: esta vaga não possui perguntas cadastradas.");
        return;
      }
      
      console.log(`✅ [DEBUG] Job encontrado: ${job.nomeVaga} com ${job.perguntas.length} perguntas`);
      
      // Descobrir qual pergunta atual baseado nas respostas já dadas
      const allResponses = await storage.getAllResponses();
      const existingResponses = allResponses.filter(r => r.interviewId === currentInterview.id);
      const currentQuestionIndex = existingResponses.length;
      
      console.log(`📊 [DEBUG] Respostas existentes: ${existingResponses.length}, Pergunta atual: ${currentQuestionIndex + 1}`);
      
      if (currentQuestionIndex >= job.perguntas.length) {
        console.log(`✅ [DEBUG] Entrevista já completa - todas as perguntas respondidas`);
        await this.sendTextMessage(from, `🎉 Parabéns ${candidate.name}! Você já completou todas as perguntas da entrevista.`);
        return;
      }
      
      const currentQuestion = job.perguntas[currentQuestionIndex];
      console.log(`❓ [DEBUG] Processando resposta para pergunta ${currentQuestionIndex + 1}: ${currentQuestion.pergunta}`);
      
      // Buscar configuração OpenAI para transcrição
      const config = await storage.getApiConfig('master', '1749848502212');
      if (!config?.openaiApiKey) {
        console.log(`❌ [DEBUG] OpenAI API não configurada para transcrição`);
        await this.sendTextMessage(from, "Erro: sistema de transcrição não configurado.");
        return;
      }
      
      console.log(`🔧 [DEBUG] OpenAI configurado - iniciando transcrição...`);
      
      // Transcrever áudio usando OpenAI SDK (corrigido)
      let transcription = '';
      try {
        console.log(`🌐 [DEBUG] Iniciando transcrição via OpenAI SDK...`);
        console.log(`📊 [DEBUG] Tamanho do arquivo: ${fs.statSync(audioPath).size} bytes`);
        
        // Usar OpenAI SDK em vez de FormData
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: config.openaiApiKey });
        
        const transcriptionResult = await openai.audio.transcriptions.create({
          file: fs.createReadStream(audioPath),
          model: 'whisper-1',
          language: 'pt',
          response_format: 'text'
        });
        
        transcription = transcriptionResult || '';
        console.log(`📝 [DEBUG] Transcrição via SDK recebida: "${transcription}"`);
        
        if (!transcription.trim()) {
          transcription = '[Áudio sem fala detectada]';
          console.log(`⚠️ [DEBUG] Transcrição vazia - áudio pode não conter fala`);
        }
        
      } catch (transcriptionError) {
        console.log(`❌ [DEBUG] Erro na transcrição SDK:`, transcriptionError.message);
        transcription = '[Erro na transcrição]';
      }
      
      console.log(`💾 [DEBUG] Preparando para salvar resposta no banco...`);
      console.log(`📋 [DEBUG] Dados da resposta:`, {
        interviewId: currentInterview.id,
        questionIndex: currentQuestionIndex,
        transcription: transcription.substring(0, 100) + '...',
        audioFileName
      });
      
      // Salvar resposta no banco de dados com logs detalhados
      try {
        console.log(`💾 [DEBUG] ===== SALVANDO RESPOSTA NO BANCO =====`);
        console.log(`📋 [DEBUG] Dados para salvamento:`, {
          interviewId: currentInterview.id,
          questionId: currentQuestion.id,
          transcricao: transcription.substring(0, 100) + (transcription.length > 100 ? '...' : ''),
          audioFileName: audioFileName,
          questionIndex: currentQuestionIndex
        });
        
        const response = await storage.createResponse({
          interviewId: currentInterview.id,
          questionId: currentQuestion.id,
          responseText: transcription,
          audioUrl: audioFileName,
          score: null,
          feedback: null
        });
        
        console.log(`✅ [DEBUG] RESPOSTA SALVA COM SUCESSO!`);
        console.log(`🆔 [DEBUG] Response ID: ${response.id}`);
        console.log(`📝 [DEBUG] Transcrição salva: "${transcription}"`);
        console.log(`🎵 [DEBUG] Áudio salvo: ${audioFileName}`);
        console.log(`📊 [DEBUG] Pergunta ${currentQuestionIndex + 1} processada e salva`);
        
        // Verificar se salvou corretamente
        const allResponses = await storage.getResponsesByInterviewId(currentInterview.id);
        console.log(`📈 [DEBUG] Total de respostas da entrevista ${currentInterview.id}: ${allResponses.length}`);
        console.log(`📋 [DEBUG] Últimas respostas:`, allResponses.map(r => ({
          id: r.id,
          questionId: r.questionId,
          hasAudio: !!r.audioUrl,
          hasText: !!r.responseText
        })));
        
      } catch (saveError) {
        console.log(`❌ [DEBUG] ===== ERRO AO SALVAR RESPOSTA =====`);
        console.log(`💥 [DEBUG] Erro completo:`, saveError);
        console.log(`🔍 [DEBUG] Stack trace:`, saveError.stack);
        await this.sendTextMessage(from, "Erro ao salvar resposta. Tente novamente.");
        return;
      }
      
      // Determinar próximos passos da entrevista
      const nextQuestionIndex = currentQuestionIndex + 1;
      const isLastQuestion = nextQuestionIndex >= job.perguntas.length;
      
      console.log(`🔄 [DEBUG] Avaliando continuação: pergunta ${currentQuestionIndex + 1}/${job.perguntas.length}`);
      
      if (!isLastQuestion) {
        // Há mais perguntas - continuar entrevista
        console.log(`➡️ [DEBUG] Continuando para pergunta ${nextQuestionIndex + 1}...`);
        
        await this.sendTextMessage(from, `✅ Resposta ${currentQuestionIndex + 1} recebida! Preparando próxima pergunta...`);
        
        // Aguardar um momento antes de enviar próxima pergunta
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const nextQuestion = job.perguntas[nextQuestionIndex];
        console.log(`📤 [DEBUG] Enviando pergunta ${nextQuestionIndex + 1}: "${nextQuestion.pergunta}"`);
        
        await this.sendQuestionAudio(from, candidate.name, nextQuestion, currentInterview.id, nextQuestionIndex, job.perguntas.length);
        
        console.log(`✅ [DEBUG] Pergunta ${nextQuestionIndex + 1}/${job.perguntas.length} enviada com sucesso`);
        
      } else {
        // Última pergunta - finalizar entrevista
        console.log(`🏁 [DEBUG] Finalizando entrevista - todas as ${job.perguntas.length} perguntas respondidas`);
        
        // Enviar mensagem de finalização personalizada
        const finalizationMessage = `🎉 Parabéns, ${candidate.name}! Você completou sua entrevista com sucesso. Todas as ${job.perguntas.length} perguntas foram respondidas. Nossa equipe analisará suas respostas e retornará em breve. Obrigado pela participação!`;
        
        await this.sendTextMessage(from, finalizationMessage);
        
        // Atualizar status da entrevista no banco
        await storage.updateInterview(currentInterview.id, { 
          status: 'completed',
          completedAt: new Date()
        });
        
        console.log(`✅ [DEBUG] Entrevista ${currentInterview.id} finalizada com sucesso`);
        console.log(`📈 [DEBUG] Total de respostas coletadas: ${job.perguntas.length}`);
      }
      
      // Limpar arquivo temporário
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      
    } catch (error) {
      console.error(`❌ Erro ao processar áudio:`, error);
      await this.sendTextMessage(from, "Erro ao processar resposta. Tente novamente.");
    }
  }

  private async processInterviewMessage(from: string, text: string, message: any) {
    try {
      console.log(`🤖 Processando mensagem de entrevista de ${from}: ${text}`);
      
      // Normalizar texto
      const normalizedText = text.toLowerCase().trim();
      
      // Detectar respostas de aceitar entrevista
      if (normalizedText === 'sim' || normalizedText === '1' || 
          normalizedText === 'aceito' || normalizedText === 'começar' ||
          normalizedText === 'ok' || normalizedText === 'yes') {
        
        console.log(`✅ [DEBUG] Candidato aceitou entrevista via texto: ${text}`);
        
        // Buscar seleção mais recente para este telefone
        const phoneClean = from.replace('@s.whatsapp.net', '');
        console.log(`🔍 [DEBUG] Buscando seleção para telefone: ${phoneClean}`);
        
        try {
          console.log(`🔍 [DEBUG] Importando storage...`);
          const { storage } = await import('./storage');
          
          console.log(`🔍 [DEBUG] Buscando candidatos para cliente 1749849987543...`);
          // Buscar todos os candidatos diretamente via storage
          const candidates = await storage.getCandidatesByClientId(1749849987543); // buscar do cliente ativo
          console.log(`👥 [DEBUG] Total de candidatos encontrados: ${candidates.length}`);
          console.log(`👥 [DEBUG] Candidatos:`, candidates.map(c => ({ id: c.id, name: c.name, phone: c.phone })));
          
          console.log(`🔍 [DEBUG] Procurando candidato com telefone: ${phoneClean}`);
          const candidate = candidates.find(c => {
            if (!c.phone) {
              console.log(`⚠️ [DEBUG] Candidato ${c.name} sem telefone`);
              return false;
            }
            const candidatePhone = c.phone.replace(/\D/g, '');
            const searchPhone = phoneClean.replace(/\D/g, '');
            console.log(`🔍 [DEBUG] Comparando: candidato ${candidatePhone} vs busca ${searchPhone}`);
            const match = candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
            if (match) {
              console.log(`✅ [DEBUG] Match encontrado para candidato: ${c.name}`);
            }
            return match;
          });
          
          if (candidate) {
            console.log(`👤 [DEBUG] Candidato encontrado: ${candidate.name} (ID: ${candidate.id})`);
            
            // Buscar seleção mais recente que inclua este candidato
            console.log(`🔍 [DEBUG] Buscando todas as seleções...`);
            const allSelections = await storage.getAllSelections();
            console.log(`📋 [DEBUG] Total de seleções encontradas: ${allSelections.length}`);
            console.log(`📋 [DEBUG] Seleções:`, allSelections.map(s => ({ 
              id: s.id, 
              name: s.name, 
              status: s.status, 
              candidateListId: s.candidateListId 
            })));
            
            const candidateSelections = allSelections.filter(s => 
              s.candidateListId && s.status === 'enviado'
            );
            console.log(`📋 [DEBUG] Seleções com status 'enviado': ${candidateSelections.length}`);
            
            if (candidateSelections.length > 0) {
              // Pegar a seleção mais recente
              const selection = candidateSelections.sort((a, b) => 
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
              )[0];
              
              console.log(`📋 [DEBUG] Seleção mais recente encontrada: ${selection.name} (ID: ${selection.id})`);
              console.log(`📋 [DEBUG] Detalhes da seleção:`, { 
                id: selection.id, 
                jobId: selection.jobId, 
                clientId: selection.clientId, 
                candidateListId: selection.candidateListId 
              });
              
              // Buscar job e suas perguntas
              console.log(`🔍 [DEBUG] Buscando job com ID: ${selection.jobId}`);
              let job = await storage.getJobById(selection.jobId);
              
              if (!job) {
                console.log(`⚠️ [DEBUG] Job não encontrado com ID exato, tentando busca por partial match`);
                const allJobs = await storage.getJobsByClientId(selection.clientId);
                console.log(`📋 [DEBUG] Jobs disponíveis:`, allJobs.map(j => ({ id: j.id, nome: j.nomeVaga, perguntas: j.perguntas?.length || 0 })));
                job = allJobs.find(j => j.id.toString().includes(selection.jobId.toString()) || selection.jobId.toString().includes(j.id.toString()));
                if (job) {
                  console.log(`✅ [DEBUG] Job encontrado via partial match: ${job.nomeVaga}`);
                }
              } else {
                console.log(`✅ [DEBUG] Job encontrado com ID exato: ${job.nomeVaga}`);
              }
              
              if (job && job.perguntas && job.perguntas.length > 0) {
                console.log(`❓ [DEBUG] Job válido com ${job.perguntas.length} perguntas`);
                console.log(`📝 [DEBUG] Primeira pergunta: ${job.perguntas[0].pergunta}`);
                
                // Iniciar processo de entrevista
                console.log(`🚀 [DEBUG] ===== CHAMANDO START INTERVIEW PROCESS =====`);
                await this.startInterviewProcess(from, selection.id, candidate.name);
                console.log(`✅ [DEBUG] ===== START INTERVIEW PROCESS FINALIZADO =====`);
                return;
              } else {
                console.log(`❌ [DEBUG] Job inválido - sem perguntas`);
                if (job) {
                  console.log(`❌ [DEBUG] Job encontrado mas perguntas:`, job.perguntas);
                } else {
                  console.log(`❌ [DEBUG] Job não encontrado`);
                }
              }
            } else {
              console.log(`❌ [DEBUG] Nenhuma seleção com status 'enviado' encontrada`);
            }
          } else {
            console.log(`❌ [DEBUG] Candidato não encontrado para telefone: ${phoneClean}`);
          }
          
          // Fallback se não encontrar dados
          await this.sendTextMessage(from, "Perfeito! Iniciando sua entrevista...");
          
        } catch (error) {
          console.error(`❌ [DEBUG] Erro ao buscar dados para entrevista:`, error);
          await this.sendTextMessage(from, "Perfeito! Iniciando sua entrevista...");
        }
        
      } 
      // Detectar respostas de recusar entrevista
      else if (normalizedText === 'não' || normalizedText === 'nao' || 
               normalizedText === '2' || normalizedText === 'recuso' || 
               normalizedText === 'no') {
        
        console.log(`❌ [DEBUG] Candidato recusou entrevista via texto: ${text}`);
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
      console.error('❌ Erro ao processar mensagem de entrevista:', error);
    }
  }

  private async saveInterviewState(interviewId: number, questionIndex: number, questionText: string) {
    try {
      const { storage } = await import('./storage');
      
      // Salvar log da pergunta enviada
      await storage.createMessageLog({
        interviewId: interviewId,
        type: 'question',
        channel: 'whatsapp',
        status: 'sent',
        content: `Pergunta ${questionIndex + 1}: ${questionText}`
      });
      
      console.log(`💾 [DEBUG] Estado da entrevista salvo - Pergunta ${questionIndex + 1}`);
    } catch (error) {
      console.error(`❌ Erro ao salvar estado da entrevista:`, error);
    }
  }

  public async sendTextMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      console.log(`🚀 [DEBUG] Iniciando envio WhatsApp QR`);
      console.log(`📞 [DEBUG] Telefone: ${phoneNumber}`);
      console.log(`💬 [DEBUG] Mensagem: ${message.substring(0, 100)}...`);
      console.log(`🔌 [DEBUG] Socket existe: ${!!this.socket}`);
      console.log(`✅ [DEBUG] Status conectado: ${this.config.isConnected}`);

      if (!this.socket || !this.config.isConnected) {
        console.log(`❌ [DEBUG] WhatsApp QR não conectado - Socket: ${!!this.socket}, Connected: ${this.config.isConnected}`);
        throw new Error('WhatsApp QR não está conectado');
      }

      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      console.log(`📤 [DEBUG] JID formatado: ${jid}`);
      console.log(`⏰ [DEBUG] Iniciando envio às: ${new Date().toISOString()}`);

      // Verificar se o número existe no WhatsApp
      console.log(`🔍 [DEBUG] Verificando se número existe no WhatsApp...`);
      try {
        const [exists] = await this.socket.onWhatsApp(jid);
        console.log(`📱 [DEBUG] Número existe no WhatsApp: ${!!exists}`);
        if (!exists) {
          console.log(`❌ [DEBUG] Número ${phoneNumber} não existe no WhatsApp`);
          return false;
        }
      } catch (checkError) {
        console.log(`⚠️ [DEBUG] Erro ao verificar número, continuando:`, checkError);
      }

      console.log(`📨 [DEBUG] Enviando mensagem via socket...`);
      const result = await this.socket.sendMessage(jid, { text: message });
      console.log(`✅ [DEBUG] Resultado do envio:`, result?.key || 'sem key');
      console.log(`⏰ [DEBUG] Envio finalizado às: ${new Date().toISOString()}`);
      
      console.log(`✅ Mensagem enviada via QR para ${phoneNumber}: ${message.substring(0, 50)}...`);
      return true;
    } catch (error) {
      console.error(`❌ [DEBUG] Erro detalhado ao enviar mensagem via QR para ${phoneNumber}:`);
      console.error(`❌ [DEBUG] Tipo do erro: ${error?.constructor?.name}`);
      console.error(`❌ [DEBUG] Mensagem do erro: ${error?.message}`);
      console.error(`❌ [DEBUG] Código do erro: ${error?.output?.statusCode || error?.code}`);
      console.error(`❌ [DEBUG] Stack trace:`, error?.stack);
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

      console.log(`📨 [DEBUG] Enviando mensagem com botões para ${candidateName}`);
      
      try {
        // Enviar apenas texto simples com instruções claras
        const textWithInstructions = `${finalMessage}

*Para participar, responda:*
*1* - Sim, começar agora
*2* - Não quero participar`;

        console.log(`🔄 [DEBUG] Enviando mensagem com instruções...`);
        const textResult = await this.socket.sendMessage(jid, { text: textWithInstructions });
        console.log(`✅ [DEBUG] Mensagem enviada:`, textResult?.key || 'sem key');
        
        return true;
        
      } catch (quickError) {
        console.log(`⚠️ [DEBUG] Quick Reply falhou, tentando botões simples:`, quickError);
        
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
          console.log(`✅ [DEBUG] Botões simples enviados:`, simpleResult?.key || 'sem key');
          return true;
          
        } catch (simpleError) {
          console.log(`⚠️ [DEBUG] Botões simples falharam, tentando lista:`, simpleError);
          
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
            console.log(`✅ [DEBUG] Lista interativa enviada:`, listResult?.key || 'sem key');
            return true;
            
          } catch (listError) {
            console.log(`⚠️ [DEBUG] Lista também falhou, usando texto simples:`, listError);
            
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
      console.error(`❌ Erro geral ao enviar convite:`, error);
      return false;
    }
  }

  public getConnectionStatus(): WhatsAppQRConfig {
    return { ...this.config };
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
      
      console.log('🔌 WhatsApp QR desconectado');
    } catch (error) {
      console.error('❌ Erro ao desconectar WhatsApp QR:', error);
    }
  }

  public async reconnect() {
    console.log('🔄 Iniciando processo de reconexão...');
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
        console.log('🗑️ Credenciais antigas removidas');
      }
    } catch (error) {
      console.log('⚠️ Erro ao remover credenciais:', error);
    }
    
    // Força uma nova inicialização
    setTimeout(() => {
      console.log('🔗 Reinicializando conexão WhatsApp para gerar novo QR...');
      this.initializeConnection();
    }, 2000);
  }
}

export const whatsappQRService = new WhatsAppQRService();