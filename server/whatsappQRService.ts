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
          await this.processAudioResponse(from, audioMessage);
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
      console.log(`🎤 [DEBUG] Iniciando processo de entrevista para ${candidateName}`);
      
      // Buscar dados da seleção e job
      const { storage } = await import('./storage');
      const selection = await storage.getSelectionById(selectionId);
      if (!selection) {
        console.error(`❌ Seleção ${selectionId} não encontrada`);
        return;
      }

      // Buscar job e perguntas
      let job = await storage.getJobById(selection.jobId);
      if (!job) {
        // Busca por ID parcial se não encontrar
        const allJobs = await storage.getJobsByClientId(selection.clientId);
        job = allJobs.find(j => j.id.toString().startsWith(selection.jobId.toString()));
      }

      if (!job || !job.perguntas || job.perguntas.length === 0) {
        await this.sendTextMessage(phoneNumber, "Desculpe, não conseguimos encontrar as perguntas da entrevista. Entre em contato conosco.");
        return;
      }

      console.log(`📋 [DEBUG] Job encontrado: ${job.nomeVaga} com ${job.perguntas.length} perguntas`);

      // Criar registro de entrevista
      const interview = await storage.createInterview({
        selectionId: selectionId,
        candidateId: 0, // Placeholder - buscar pelo telefone depois
        token: `whatsapp_${Date.now()}`,
        status: 'in_progress'
      });

      console.log(`🆔 [DEBUG] Entrevista criada com ID: ${interview.id}`);

      // Enviar primeira pergunta por áudio
      await this.sendQuestionAudio(phoneNumber, candidateName, job.perguntas[0], interview.id, 0, job.perguntas.length);

    } catch (error) {
      console.error(`❌ Erro ao iniciar processo de entrevista:`, error);
      await this.sendTextMessage(phoneNumber, "Desculpe, ocorreu um erro ao iniciar a entrevista. Tente novamente mais tarde.");
    }
  }

  private async sendQuestionAudio(phoneNumber: string, candidateName: string, question: any, interviewId: number, questionIndex: number, totalQuestions: number) {
    try {
      console.log(`🎵 [DEBUG] Enviando pergunta ${questionIndex + 1} de ${totalQuestions} por áudio para ${candidateName}`);
      
      // Buscar configuração de voz
      const { storage } = await import('./storage');
      const config = await storage.getApiConfig();
      
      if (!config?.openaiApiKey) {
        console.error(`❌ OpenAI API não configurada`);
        await this.sendTextMessage(phoneNumber, `Pergunta ${questionIndex + 1}: ${question.pergunta}`);
        return;
      }

      // Gerar áudio da pergunta
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: question.pergunta,
          voice: config.voiceSettings?.voice || "nova",
          response_format: "mp3"
        }),
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        
        // Enviar áudio via WhatsApp
        const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
        await this.socket.sendMessage(jid, {
          audio: Buffer.from(audioBuffer),
          mimetype: 'audio/mp4',
          ptt: true // Nota de voz
        });

        console.log(`✅ [DEBUG] Pergunta ${questionIndex + 1} enviada por áudio`);
        
        // Salvar estado da entrevista
        await this.saveInterviewState(interviewId, questionIndex, question.pergunta);
        
      } else {
        console.error(`❌ Erro na API OpenAI para TTS`);
        await this.sendTextMessage(phoneNumber, `Pergunta ${questionIndex + 1}: ${question.pergunta}`);
      }

    } catch (error) {
      console.error(`❌ Erro ao enviar pergunta por áudio:`, error);
      await this.sendTextMessage(phoneNumber, `Pergunta ${questionIndex + 1}: ${question.pergunta}`);
    }
  }

  private async processAudioResponse(from: string, audioMessage: any) {
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
      
      // Baixar arquivo de áudio
      const audioBuffer = await this.socket.downloadMediaMessage(audioMessage);
      if (!audioBuffer) {
        console.log(`❌ [DEBUG] Erro ao baixar áudio`);
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
          const { storage } = await import('./storage');
          
          // Buscar todos os candidatos diretamente via storage
          const candidates = await storage.getCandidatesByClientId(1749849987543); // buscar do cliente ativo
          const candidate = candidates.find(c => {
            if (!c.phone) return false;
            const candidatePhone = c.phone.replace(/\D/g, '');
            const searchPhone = phoneClean.replace(/\D/g, '');
            return candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
          });
          
          if (candidate) {
            console.log(`👤 [DEBUG] Candidato encontrado: ${candidate.name}`);
            
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
              
              console.log(`📋 [DEBUG] Seleção encontrada: ${selection.name} (ID: ${selection.id})`);
              
              // Buscar job e suas perguntas
              const job = await storage.getJobById(selection.jobId);
              if (job && job.perguntas && job.perguntas.length > 0) {
                console.log(`❓ [DEBUG] Job encontrado com ${job.perguntas.length} perguntas`);
                
                // Iniciar processo de entrevista
                await this.startInterviewProcess(from, selection.id, candidate.name);
                return;
              } else {
                console.log(`❌ [DEBUG] Job não encontrado ou sem perguntas`);
              }
            }
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