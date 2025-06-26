import { storage } from "../../server/storage";

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  webhookUrl: string;
}

interface WhatsAppMessage {
  to: string;
  type: 'text' | 'audio' | 'interactive';
  text?: {
    body: string;
  };
  audio?: {
    link: string;
  };
  interactive?: {
    type: 'button';
    body: {
      text: string;
    };
    action: {
      buttons: Array<{
        type: 'reply';
        reply: {
          id: string;
          title: string;
        };
      }>;
    };
  };
}

interface CandidateInterviewState {
  candidateId: number;
  candidateName: string;
  candidatePhone: string;
  selectionId: number;
  jobId: string;
  currentQuestionIndex: number;
  status: 'invited' | 'accepted' | 'declined' | 'in_progress' | 'completed';
  responses: Array<{
    questionNumber: number;
    question: string;
    audioUrl?: string;
    transcription?: string;
    timestamp: Date;
  }>;
  startedAt?: Date;
  completedAt?: Date;
}

export class WhatsAppService {
  private config: WhatsAppConfig | null = null;
  
  constructor() {
    this.loadConfig();
  }

  private async loadConfig() {
    try {
      const apiConfig = await storage.getApiConfig();
      if (apiConfig?.whatsappToken && apiConfig?.whatsappPhoneId) {
        this.config = {
          accessToken: apiConfig.whatsappToken,
          phoneNumberId: apiConfig.whatsappPhoneId,
          verifyToken: apiConfig.whatsappVerifyToken || 'verify_token_123',
          webhookUrl: process.env.WEBHOOK_URL || 'https://seu-app.replit.app/webhook/whatsapp'
        };
        console.log('✅ WhatsApp configurado com sucesso');
      } else {
        console.log('❌ Configuração do WhatsApp não encontrada');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar configuração WhatsApp:', error);
    }
  }

  private async sendMessage(message: WhatsAppMessage): Promise<boolean> {
    if (!this.config) {
      console.error('❌ WhatsApp não configurado');
      return false;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            ...message,
          }),
        }
      );

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Mensagem WhatsApp enviada:', result);
        return true;
      } else {
        console.error('❌ Erro ao enviar mensagem WhatsApp:', result);
        return false;
      }
    } catch (error) {
      console.error('❌ Erro na API WhatsApp:', error);
      return false;
    }
  }

  async sendInterviewInvitation(
    candidateName: string,
    candidatePhone: string,
    jobTitle: string,
    initialMessage: string,
    selectionId: number
  ): Promise<boolean> {
    // Personalizar mensagem com nome do candidato
    const personalizedMessage = initialMessage.replace(/\[nome do candidato\]/g, candidateName);

    const message: WhatsAppMessage = {
      to: candidatePhone,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: personalizedMessage
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: `accept_${selectionId}_${candidatePhone}`,
                title: 'Quero fazer entrevista'
              }
            },
            {
              type: 'reply',
              reply: {
                id: `decline_${selectionId}_${candidatePhone}`,
                title: 'Não quero fazer entrevista'
              }
            }
          ]
        }
      }
    };

    return await this.sendMessage(message);
  }

  async sendTextMessage(phone: string, text: string): Promise<boolean> {
    const message: WhatsAppMessage = {
      to: phone,
      type: 'text',
      text: {
        body: text
      }
    };

    return await this.sendMessage(message);
  }

  async sendAudioMessage(phone: string, audioUrl: string): Promise<boolean> {
    const message: WhatsAppMessage = {
      to: phone,
      type: 'audio',
      audio: {
        link: audioUrl
      }
    };

    return await this.sendMessage(message);
  }

  async handleWebhook(body: any): Promise<void> {
    try {
      console.log('📱 Webhook WhatsApp recebido:', JSON.stringify(body, null, 2));

      // Verificar se é uma mensagem de entrada
      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.field === 'messages') {
              await this.processMessage(change.value);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar webhook WhatsApp:', error);
    }
  }

  private async processMessage(messageData: any): Promise<void> {
    try {
      if (!messageData.messages) return;

      for (const message of messageData.messages) {
        const from = message.from;
        
        console.log(`📨 Mensagem de ${from}:`, message);

        // Processar botão de resposta (aceitar/recusar entrevista)
        if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
          await this.handleButtonResponse(from, message.interactive.button_reply);
        }
        
        // Processar áudio (resposta da entrevista)
        else if (message.type === 'audio') {
          await this.handleAudioResponse(from, message.audio);
        }

        // Processar texto (fallback)
        else if (message.type === 'text') {
          await this.handleTextResponse(from, message.text.body);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }

  private async handleButtonResponse(phone: string, buttonReply: any): Promise<void> {
    const buttonId = buttonReply.id;
    console.log(`🔘 Botão clicado: ${buttonId} por ${phone}`);

    // Extrair informações do botão
    const [action, selectionId, candidatePhone] = buttonId.split('_');

    if (action === 'accept') {
      await this.startInterview(phone, parseInt(selectionId));
    } else if (action === 'decline') {
      await this.handleDecline(phone, parseInt(selectionId));
    }
  }

  private async startInterview(phone: string, selectionId: number): Promise<void> {
    try {
      console.log(`🎤 Iniciando entrevista para ${phone} na seleção ${selectionId}`);

      // Buscar dados da seleção
      const selection = await storage.getSelectionById(selectionId);
      if (!selection) {
        console.error('❌ Seleção não encontrada:', selectionId);
        return;
      }

      // Buscar candidato pelo telefone
      const candidates = await storage.getCandidatesByClientId(selection.clientId);
      const candidate = candidates.find(c => c.phone === phone);
      
      if (!candidate) {
        console.error('❌ Candidato não encontrado:', phone);
        return;
      }

      // Buscar job e perguntas
      const job = await storage.getJobById(selection.jobId);
      if (!job) {
        console.error('❌ Job não encontrado:', selection.jobId);
        return;
      }

      // Criar estado da entrevista
      const interviewState: CandidateInterviewState = {
        candidateId: candidate.id,
        candidateName: candidate.name,
        candidatePhone: phone,
        selectionId: selectionId,
        jobId: selection.jobId,
        currentQuestionIndex: 0,
        status: 'accepted',
        responses: [],
        startedAt: new Date()
      };

      // Salvar estado no Firebase (usar uma coleção específica para estados)
      await this.saveInterviewState(phone, interviewState);

      // Enviar saudação personalizada
      const welcomeMessage = `Olá, ${candidate.name}. Vamos começar sua entrevista.`;
      await this.sendTextMessage(phone, welcomeMessage);

      // Gerar e enviar áudio de saudação
      await this.sendQuestionAudio(phone, welcomeMessage, true);

      // Aguardar um pouco e enviar primeira pergunta
      setTimeout(async () => {
        await this.sendNextQuestion(phone);
      }, 3000);

    } catch (error) {
      console.error('❌ Erro ao iniciar entrevista:', error);
    }
  }

  private async handleDecline(phone: string, selectionId: number): Promise<void> {
    console.log(`❌ Candidato ${phone} recusou a entrevista da seleção ${selectionId}`);
    
    // Salvar recusa no banco
    const interviewState: CandidateInterviewState = {
      candidateId: 0,
      candidateName: '',
      candidatePhone: phone,
      selectionId: selectionId,
      jobId: '',
      currentQuestionIndex: 0,
      status: 'declined',
      responses: [],
    };

    await this.saveInterviewState(phone, interviewState);
    
    // Enviar mensagem de confirmação
    await this.sendTextMessage(phone, "Tudo bem! Obrigado pelo seu tempo. Se mudar de ideia, entre em contato conosco.");
  }

  private async sendNextQuestion(phone: string): Promise<void> {
    try {
      const interviewState = await this.getInterviewState(phone);
      if (!interviewState || interviewState.status === 'completed') {
        return;
      }

      // Buscar job e perguntas
      const job = await storage.getJobById(interviewState.jobId);
      if (!job || !job.perguntas || job.perguntas.length === 0) {
        console.error('❌ Job ou perguntas não encontradas');
        return;
      }

      const questions = job.perguntas;
      const currentIndex = interviewState.currentQuestionIndex;

      // Verificar se chegou ao fim
      if (currentIndex >= questions.length) {
        await this.completeInterview(phone);
        return;
      }

      const currentQuestion = questions[currentIndex];
      const questionText = currentQuestion.pergunta || currentQuestion.question;

      console.log(`❓ Enviando pergunta ${currentIndex + 1}/${questions.length} para ${phone}: ${questionText}`);

      // Enviar pergunta como texto
      await this.sendTextMessage(phone, `Pergunta ${currentIndex + 1}/${questions.length}: ${questionText}`);

      // Gerar e enviar áudio da pergunta
      await this.sendQuestionAudio(phone, questionText);

      // Atualizar status para aguardando resposta
      interviewState.status = 'in_progress';
      await this.saveInterviewState(phone, interviewState);

    } catch (error) {
      console.error('❌ Erro ao enviar próxima pergunta:', error);
    }
  }

  private async sendQuestionAudio(phone: string, text: string, isWelcome: boolean = false): Promise<void> {
    try {
      // Gerar áudio usando TTS da OpenAI
      const response = await fetch('/api/natural-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          isWhatsApp: true
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        
        // Upload para Firebase Storage
        const audioUrl = await this.uploadAudioToFirebase(audioBlob, `question_${phone}_${Date.now()}.mp3`);
        
        if (audioUrl) {
          // Enviar áudio via WhatsApp
          await this.sendAudioMessage(phone, audioUrl);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao gerar/enviar áudio:', error);
    }
  }

  private async handleAudioResponse(phone: string, audioData: any): Promise<void> {
    try {
      console.log(`🔊 Áudio recebido de ${phone}:`, audioData);

      const interviewState = await this.getInterviewState(phone);
      if (!interviewState || interviewState.status !== 'in_progress') {
        console.log('❌ Estado de entrevista inválido para áudio');
        return;
      }

      // Download do áudio do WhatsApp
      const audioUrl = await this.downloadWhatsAppAudio(audioData.id);
      if (!audioUrl) {
        console.error('❌ Erro ao baixar áudio do WhatsApp');
        return;
      }

      // Transcrever áudio usando Whisper
      const transcription = await this.transcribeAudio(audioUrl);
      
      // Buscar pergunta atual
      const job = await storage.getJobById(interviewState.jobId);
      const currentQuestion = job?.perguntas?.[interviewState.currentQuestionIndex];
      
      if (!currentQuestion) {
        console.error('❌ Pergunta atual não encontrada');
        return;
      }

      // Salvar resposta
      const response = {
        questionNumber: interviewState.currentQuestionIndex + 1,
        question: currentQuestion.pergunta || currentQuestion.question,
        audioUrl: audioUrl,
        transcription: transcription,
        timestamp: new Date()
      };

      interviewState.responses.push(response);
      interviewState.currentQuestionIndex++;

      // Salvar no Firestore estruturado conforme especificação
      await this.saveResponseToFirestore({
        nome: interviewState.candidateName,
        numero: phone,
        pergunta: response.question,
        respostaAudioUrl: audioUrl,
        respostaTexto: transcription,
        numeroDaPergunta: response.questionNumber
      });

      await this.saveInterviewState(phone, interviewState);

      // Enviar próxima pergunta ou finalizar
      setTimeout(async () => {
        await this.sendNextQuestion(phone);
      }, 2000);

    } catch (error) {
      console.error('❌ Erro ao processar áudio:', error);
    }
  }

  private async completeInterview(phone: string): Promise<void> {
    try {
      const interviewState = await this.getInterviewState(phone);
      if (!interviewState) return;

      interviewState.status = 'completed';
      interviewState.completedAt = new Date();
      await this.saveInterviewState(phone, interviewState);

      // Mensagem de encerramento
      const farewell = `Obrigado, ${interviewState.candidateName}. Sua entrevista foi finalizada. Em breve você receberá o resultado. Até logo!`;
      
      await this.sendTextMessage(phone, farewell);
      await this.sendQuestionAudio(phone, farewell, true);

      console.log(`✅ Entrevista finalizada para ${phone}`);
    } catch (error) {
      console.error('❌ Erro ao finalizar entrevista:', error);
    }
  }

  private async handleTextResponse(phone: string, text: string): Promise<void> {
    // Fallback para mensagens de texto
    console.log(`💬 Mensagem de texto de ${phone}: ${text}`);
    await this.sendTextMessage(phone, "Por favor, responda com áudio para prosseguir com a entrevista.");
  }

  // Métodos auxiliares Firebase
  private async saveInterviewState(phone: string, state: CandidateInterviewState): Promise<void> {
    // Implementar salvamento no Firebase
    console.log('💾 Salvando estado da entrevista:', state);
  }

  private async getInterviewState(phone: string): Promise<CandidateInterviewState | null> {
    // Implementar busca no Firebase
    console.log('🔍 Buscando estado da entrevista para:', phone);
    return null;
  }

  private async saveResponseToFirestore(response: any): Promise<void> {
    // Implementar salvamento estruturado no Firestore
    console.log('💾 Salvando resposta no Firestore:', response);
  }

  private async downloadWhatsAppAudio(audioId: string): Promise<string | null> {
    // Implementar download do áudio via WhatsApp API
    console.log('⬇️ Baixando áudio do WhatsApp:', audioId);
    return null;
  }

  private async transcribeAudio(audioUrl: string): Promise<string> {
    // Implementar transcrição via Whisper
    console.log('🎙️ Transcrevendo áudio:', audioUrl);
    return 'Transcrição simulada';
  }

  private async uploadAudioToFirebase(audioBlob: Blob, filename: string): Promise<string | null> {
    // Implementar upload para Firebase Storage
    console.log('☁️ Upload para Firebase:', filename);
    return null;
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config?.verifyToken) {
      console.log('✅ Webhook verificado com sucesso');
      return challenge;
    }
    console.log('❌ Verificação de webhook falhou');
    return null;
  }
}

export const whatsappService = new WhatsAppService();