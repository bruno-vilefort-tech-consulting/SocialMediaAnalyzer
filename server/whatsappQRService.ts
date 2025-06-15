import qrcode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import { storage } from './storage';

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
    this.initializeBaileys().then(() => {
      this.loadConnectionFromDB().then(() => {
        this.initializeConnection();
      });
    }).catch(error => {
      console.error('❌ Erro ao inicializar WhatsApp QR:', error.message);
    });
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
      const config = await storage.getApiConfig();
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
      const currentConfig = await storage.getApiConfig();
      await storage.upsertApiConfig({
        ...currentConfig,
        whatsappQrConnected: this.config.isConnected,
        whatsappQrPhoneNumber: this.config.phoneNumber,
        whatsappQrLastConnection: this.config.lastConnection
      });
      console.log('💾 Conexão WhatsApp QR salva no banco de dados');
    } catch (error) {
      console.error('❌ Erro ao salvar conexão WhatsApp QR no banco:', error);
    }
  }

  private async initializeConnection() {
    try {
      if (!this.makeWASocket || !this.useMultiFileAuthState) {
        throw new Error('Baileys não foi inicializado corretamente');
      }

      console.log('🔗 Inicializando conexão WhatsApp QR...');
      
      const { state, saveCreds } = await this.useMultiFileAuthState('./whatsapp-auth');
      
      this.socket = this.makeWASocket({
        auth: state,
        printQRInTerminal: true,
      });

      this.socket.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          this.generateQRCode(qr);
        }
        
        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
          console.log('🔌 Conexão fechada devido a:', lastDisconnect?.error?.message);
          
          this.config.isConnected = false;
          this.config.phoneNumber = null;
          this.config.lastConnection = null;
          this.notifyConnectionListeners(false);
          
          // Salvar desconexão no banco de dados
          this.saveConnectionToDB();
          
          if (shouldReconnect) {
            console.log('🔄 Reconectando...');
            setTimeout(() => this.initializeConnection(), 5000);
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
          this.saveConnectionToDB();
        }
      });

      this.socket.ev.on('creds.update', saveCreds);
      this.socket.ev.on('messages.upsert', this.handleIncomingMessages.bind(this));

    } catch (error) {
      console.error('❌ Erro ao inicializar conexão WhatsApp QR:', error);
      this.config.isConnected = false;
      this.notifyConnectionListeners(false);
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
    for (const message of messages) {
      if (!message.key.fromMe && message.message) {
        const from = message.key.remoteJid;
        const text = message.message.conversation || 
                    message.message.extendedTextMessage?.text || '';
        const buttonResponse = message.message?.buttonsResponseMessage?.selectedButtonId;
        const audioMessage = message.message?.audioMessage;
        
        console.log(`📨 [DEBUG] Mensagem recebida de ${from}`);
        console.log(`📝 [DEBUG] Texto: ${text || 'N/A'}`);
        console.log(`🔘 [DEBUG] Botão: ${buttonResponse || 'N/A'}`);
        console.log(`🎵 [DEBUG] Áudio: ${audioMessage ? 'SIM' : 'NÃO'}`);
        
        if (buttonResponse) {
          await this.processButtonResponse(from, buttonResponse);
        } else if (audioMessage) {
          await this.processAudioResponse(from, message);
        } else if (text) {
          await this.processInterviewMessage(from, text, message);
        }
      }
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

      // Criar registro de entrevista
      console.log(`💾 [DEBUG] Criando registro de entrevista...`);
      const interview = await storage.createInterview({
        selectionId: selectionId,
        candidateId: 0, // Placeholder - buscar pelo telefone depois
        token: `whatsapp_${Date.now()}`,
        status: 'in_progress'
      });

      console.log(`🆔 [DEBUG] Entrevista criada com ID: ${interview.id}`);

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
      const config = await storage.getApiConfig();
      
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
        speed: 0.75  // Velocidade mais lenta para melhor compreensão
      };
      console.log(`🎙️ [DEBUG] Dados TTS:`, ttsData);

      // Gerar áudio da pergunta
      console.log(`🌐 [DEBUG] Fazendo requisição para OpenAI TTS...`);
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ttsData),
      });

      console.log(`📡 [DEBUG] Resposta OpenAI TTS - Status: ${response.status}`);

      if (response.ok) {
        console.log(`✅ [DEBUG] Áudio gerado com sucesso, baixando buffer...`);
        const audioBuffer = await response.arrayBuffer();
        console.log(`💾 [DEBUG] Buffer de áudio criado - Tamanho: ${audioBuffer.byteLength} bytes`);
        
        // Enviar áudio via WhatsApp
        const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
        console.log(`📱 [DEBUG] JID formatado: ${jid}`);
        console.log(`📤 [DEBUG] Enviando áudio via WhatsApp...`);
        
        const sendResult = await this.socket.sendMessage(jid, {
          audio: Buffer.from(audioBuffer),
          mimetype: 'audio/mp4',
          ptt: true // Nota de voz
        });

        console.log(`✅ [DEBUG] Áudio enviado via WhatsApp - Resultado:`, sendResult);
        console.log(`✅ [DEBUG] Pergunta ${questionIndex + 1} enviada por áudio com sucesso`);
        
        // Salvar estado da entrevista
        console.log(`💾 [DEBUG] Salvando estado da entrevista...`);
        await this.saveInterviewState(interviewId, questionIndex, question.pergunta);
        console.log(`✅ [DEBUG] Estado da entrevista salvo`);
        
      } else {
        const errorText = await response.text();
        console.error(`❌ [DEBUG] Erro na API OpenAI para TTS - Status: ${response.status}, Erro: ${errorText}`);
        console.log(`📝 [DEBUG] Enviando pergunta por texto como fallback...`);
        await this.sendTextMessage(phoneNumber, `Pergunta ${questionIndex + 1}: ${question.pergunta}`);
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
      console.log(`🎵 [DEBUG] Processando resposta de áudio de ${from}`);
      
      const { storage } = await import('./storage');
      const fs = await import('fs');
      const path = await import('path');
      
      // Buscar entrevista em andamento para este telefone
      const phoneClean = from.replace('@s.whatsapp.net', '');
      const candidates = await storage.getCandidatesByClientId(1749849987543);
      const candidate = candidates.find(c => {
        if (!c.phone) return false;
        const candidatePhone = c.phone.replace(/\D/g, '');
        const searchPhone = phoneClean.replace(/\D/g, '');
        return candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
      });
      
      if (!candidate) {
        console.log(`❌ [DEBUG] Candidato não encontrado para ${phoneClean}`);
        return;
      }
      
      // Buscar entrevista em andamento
      const allSelections = await storage.getAllSelections();
      const activeSelection = allSelections.find(s => s.status === 'enviado' && s.candidateListId);
      
      if (!activeSelection) {
        console.log(`❌ [DEBUG] Seleção ativa não encontrada`);
        return;
      }
      
      // Baixar arquivo de áudio usando downloadMediaMessage do Baileys
      console.log(`📱 [DEBUG] Baixando áudio do WhatsApp...`);
      let audioBuffer: Buffer;
      
      try {
        // Baixar mídia usando a função correta do Baileys
        const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
        audioBuffer = await downloadMediaMessage(
          message,
          'buffer',
          {},
          {
            logger: console,
            reuploadRequest: this.socket.updateMediaMessage
          }
        );
        
        if (!audioBuffer) {
          console.log(`❌ [DEBUG] Erro ao baixar áudio - buffer vazio`);
          await this.sendTextMessage(from, "Erro ao processar áudio. Tente enviar novamente.");
          return;
        }
        
        console.log(`✅ [DEBUG] Áudio baixado com sucesso - Tamanho: ${audioBuffer.length} bytes`);
      } catch (error) {
        console.log(`❌ [DEBUG] Erro ao baixar áudio:`, error);
        await this.sendTextMessage(from, "Erro ao processar áudio. Tente enviar novamente.");
        return;
      }
      
      // Salvar arquivo temporário
      const audioFileName = `audio_${Date.now()}.ogg`;
      const audioPath = path.join('./uploads', audioFileName);
      
      // Criar diretório se não existir
      if (!fs.existsSync('./uploads')) {
        fs.mkdirSync('./uploads', { recursive: true });
      }
      
      fs.writeFileSync(audioPath, audioBuffer);
      console.log(`💾 [DEBUG] Áudio salvo em: ${audioPath}`);
      
      // Transcrever áudio usando OpenAI Whisper
      const config = await storage.getApiConfig();
      if (!config?.openaiApiKey) {
        console.log(`❌ [DEBUG] OpenAI API não configurada para transcrição`);
        await this.sendTextMessage(from, "Resposta recebida! Aguarde a próxima pergunta...");
        return;
      }
      
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('file', fs.createReadStream(audioPath));
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');
      
      const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      let transcription = '';
      if (transcriptionResponse.ok) {
        const result = await transcriptionResponse.json();
        transcription = result.text || '';
        console.log(`📝 [DEBUG] Transcrição: "${transcription}"`);
      } else {
        console.log(`❌ [DEBUG] Erro na transcrição OpenAI`);
        transcription = '[Áudio não transcrito]';
      }
      
      // Salvar resposta no banco de dados
      const interview = await storage.createInterview({
        selectionId: activeSelection.id,
        candidateId: candidate.id,
        token: `whatsapp_${Date.now()}`,
        status: 'in_progress'
      });
      
      // Buscar job e pergunta atual
      const job = await storage.getJobById(activeSelection.jobId);
      if (job && job.perguntas && job.perguntas.length > 0) {
        // Por simplicidade, vamos assumir que é a primeira pergunta
        // Em um sistema completo, você manteria o estado da entrevista
        const currentQuestion = job.perguntas[0];
        
        // Salvar resposta
        const response = await storage.createResponse({
          interviewId: interview.id,
          questionId: currentQuestion.id,
          responseText: transcription,
          audioUrl: audioFileName,
          score: null,
          feedback: null
        });
        
        console.log(`✅ [DEBUG] Resposta salva no banco: ID ${response.id}`);
        
        // Enviar confirmação e próxima pergunta
        await this.sendTextMessage(from, "✅ Resposta recebida e processada!");
        
        // Se há mais perguntas, enviar a próxima
        if (job.perguntas.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          await this.sendQuestionAudio(from, candidate.name, job.perguntas[1], interview.id, 1, job.perguntas.length);
        } else {
          // Finalizar entrevista
          await this.sendTextMessage(from, `🎉 Parabéns ${candidate.name}! Você completou a entrevista. Nossa equipe analisará suas respostas e retornará em breve.`);
          await storage.updateInterview(interview.id, { 
            status: 'completed',
            completedAt: new Date()
          });
        }
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
    await this.disconnect();
    setTimeout(() => this.initializeConnection(), 2000);
  }
}

export const whatsappQRService = new WhatsAppQRService();