import { storage } from './storage';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

// Estado em memória das entrevistas ativas
interface ActiveInterview {
  candidateId: string;
  candidateName: string;
  phone: string;
  jobId: string;
  jobName: string;
  currentQuestion: number;
  questions: any[];
  responses: Array<{
    questionId: number;
    questionText: string;
    responseText?: string;
    audioFile?: string;
    timestamp: string;
  }>;
  startTime: string;
}

class SimpleInterviewService {
  private activeInterviews: Map<string, ActiveInterview> = new Map();
  private openai: OpenAI;
  private whatsappService: any = null;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  setWhatsAppService(service: any) {
    this.whatsappService = service;
  }

  async handleMessage(from: string, text: string, audioMessage?: any): Promise<void> {
    const phone = from.replace('@s.whatsapp.net', '');
    console.log(`📱 Mensagem de ${phone}: "${text}" ${audioMessage ? '+ áudio' : ''}`);

    // Verificar se há entrevista ativa
    const activeInterview = this.activeInterviews.get(phone);

    if (text === '1' && !activeInterview) {
      await this.startInterview(phone);
    } else if (text === '2') {
      await this.sendMessage(from, "Entendido. Obrigado!");
    } else if (text.toLowerCase() === 'parar' || text.toLowerCase() === 'sair') {
      await this.stopInterview(phone);
    } else if (activeInterview) {
      await this.processResponse(from, activeInterview, text, audioMessage);
    } else {
      await this.sendMessage(from, "Digite:\n1 - Iniciar entrevista\n2 - Não participar");
    }
  }

  private async startInterview(phone: string): Promise<void> {
    console.log(`🚀 Iniciando entrevista para ${phone}`);

    // Buscar candidato
    const candidate = await this.findCandidate(phone);
    if (!candidate) {
      await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Candidato não encontrado.");
      return;
    }

    // Buscar vaga com perguntas
    const allJobs = await storage.getAllJobs();
    const job = allJobs.find(j => j.perguntas && j.perguntas.length > 0);
    
    if (!job) {
      await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Nenhuma vaga disponível no momento.");
      return;
    }

    console.log(`✅ Vaga encontrada: ${job.nomeVaga} com ${job.perguntas.length} perguntas`);

    // Criar entrevista ativa
    const interview: ActiveInterview = {
      candidateId: candidate.id,
      candidateName: candidate.name,
      phone: phone,
      jobId: job.id,
      jobName: job.nomeVaga,
      currentQuestion: 0,
      questions: job.perguntas,
      responses: [],
      startTime: new Date().toISOString()
    };

    this.activeInterviews.set(phone, interview);

    await this.sendMessage(`${phone}@s.whatsapp.net`, 
      `🎯 Entrevista iniciada para: ${job.nomeVaga}\n👋 Olá ${candidate.name}!\n📝 ${job.perguntas.length} perguntas\n\n⏳ Preparando primeira pergunta...`
    );

    // Enviar primeira pergunta
    await this.sendNextQuestion(phone, interview);
  }

  private async sendNextQuestion(phone: string, interview: ActiveInterview): Promise<void> {
    const question = interview.questions[interview.currentQuestion];
    
    if (!question) {
      await this.finishInterview(phone, interview);
      return;
    }

    const questionNum = interview.currentQuestion + 1;
    const total = interview.questions.length;
    
    const message = `📝 Pergunta ${questionNum}/${total}:\n\n${question.pergunta}\n\n🎤 Responda com áudio ou texto`;

    await this.sendMessage(`${phone}@s.whatsapp.net`, message);

    // Tentar enviar áudio TTS
    try {
      await this.sendQuestionAudio(phone, question.pergunta);
    } catch (error) {
      console.log(`⚠️ TTS falhou, pergunta enviada por texto`);
    }
  }

  private async sendQuestionAudio(phone: string, questionText: string): Promise<void> {
    try {
      const response = await this.openai.audio.speech.create({
        model: "tts-1",
        input: questionText,
        voice: "nova",
        response_format: "opus",
        speed: 1.0
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        
        if (this.whatsappService && this.whatsappService.socket) {
          await this.whatsappService.socket.sendMessage(`${phone}@s.whatsapp.net`, {
            audio: Buffer.from(audioBuffer),
            mimetype: 'audio/mp4',
            ptt: true
          });
          
          console.log(`🎵 Áudio TTS enviado para ${phone}`);
        }
      }
    } catch (error) {
      console.log(`❌ Erro TTS:`, error.message);
    }
  }

  private async processResponse(from: string, interview: ActiveInterview, text: string, audioMessage?: any): Promise<void> {
    const phone = from.replace('@s.whatsapp.net', '');
    console.log(`📝 Processando resposta da pergunta ${interview.currentQuestion + 1}`);

    let responseText = text;
    let audioFile: string | undefined;

    // Se há áudio, transcrever
    if (audioMessage) {
      console.log(`🎵 Processando áudio...`);
      try {
        const transcription = await this.transcribeAudio(audioMessage);
        responseText = transcription || text;
        audioFile = `audio_${Date.now()}.ogg`;
        console.log(`✅ Transcrição: "${responseText}"`);
      } catch (error) {
        console.log(`❌ Erro na transcrição:`, error.message);
      }
    }

    // Salvar resposta
    const currentQuestion = interview.questions[interview.currentQuestion];
    const response = {
      questionId: interview.currentQuestion,
      questionText: currentQuestion.pergunta,
      responseText: responseText,
      audioFile: audioFile,
      timestamp: new Date().toISOString()
    };

    interview.responses.push(response);
    
    console.log(`💾 Resposta ${interview.currentQuestion + 1} salva: "${responseText.substring(0, 50)}..."`);

    // Avançar para próxima pergunta
    interview.currentQuestion++;
    this.activeInterviews.set(phone, interview);

    // Enviar confirmação e próxima pergunta
    await this.sendMessage(from, `✅ Resposta recebida! Obrigado.`);
    
    setTimeout(async () => {
      await this.sendNextQuestion(phone, interview);
    }, 1500);
  }

  private async transcribeAudio(audioMessage: any): Promise<string> {
    try {
      // Baixar áudio
      const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
      const audioBuffer = await downloadMediaMessage(audioMessage, 'buffer', {});
      
      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('Áudio vazio');
      }

      // Salvar temporariamente
      const tempFile = path.join('./uploads', `temp_${Date.now()}.ogg`);
      fs.writeFileSync(tempFile, audioBuffer);

      // Transcrever com OpenAI
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempFile));
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`OpenAI erro: ${response.status}`);
      }

      const result = await response.json();
      
      // Limpar arquivo temporário
      fs.unlinkSync(tempFile);
      
      return result.text || '';
      
    } catch (error) {
      console.log(`❌ Erro transcrição:`, error.message);
      return '';
    }
  }

  private async finishInterview(phone: string, interview: ActiveInterview): Promise<void> {
    console.log(`🎉 Finalizando entrevista de ${interview.candidateName}`);

    // Salvar respostas no banco de dados
    try {
      await this.saveInterviewResults(interview);
      console.log(`💾 Entrevista salva no banco de dados`);
    } catch (error) {
      console.log(`❌ Erro ao salvar:`, error.message);
    }

    // Mensagem final
    await this.sendMessage(`${phone}@s.whatsapp.net`, 
      `🎉 Parabéns ${interview.candidateName}!\n\n✅ Entrevista concluída com sucesso!\n📊 ${interview.responses.length} respostas registradas\n\nObrigado pela participação! Entraremos em contato em breve.`
    );

    // Remover da memória
    this.activeInterviews.delete(phone);
  }

  private async stopInterview(phone: string): Promise<void> {
    const interview = this.activeInterviews.get(phone);
    if (interview) {
      await this.sendMessage(`${phone}@s.whatsapp.net`, `⏹️ Entrevista encerrada. Obrigado ${interview.candidateName}!`);
      this.activeInterviews.delete(phone);
    } else {
      await this.sendMessage(`${phone}@s.whatsapp.net`, "Nenhuma entrevista ativa.");
    }
  }

  private async saveInterviewResults(interview: ActiveInterview): Promise<void> {
    // Implementar salvamento no Firebase/PostgreSQL se necessário
    // Por enquanto, apenas log
    console.log(`📊 Resultados da entrevista:`, {
      candidato: interview.candidateName,
      vaga: interview.jobName,
      respostas: interview.responses.length,
      inicio: interview.startTime,
      fim: new Date().toISOString()
    });
  }

  private async findCandidate(phone: string) {
    const candidates = await storage.getAllCandidates();
    return candidates.find(c => {
      if (!c.phone) return false;
      const candidatePhone = c.phone.replace(/\D/g, '');
      const searchPhone = phone.replace(/\D/g, '');
      return candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
    });
  }

  private async sendMessage(to: string, message: string): Promise<void> {
    if (this.whatsappService) {
      await this.whatsappService.sendTextMessage(to, message);
    } else {
      console.log(`📱 Enviaria mensagem para ${to}: ${message}`);
    }
  }

  // Métodos para debug
  getActiveInterviews(): Map<string, ActiveInterview> {
    return this.activeInterviews;
  }

  getInterviewStatus(phone: string): ActiveInterview | undefined {
    return this.activeInterviews.get(phone);
  }
}

export const simpleInterviewService = new SimpleInterviewService();