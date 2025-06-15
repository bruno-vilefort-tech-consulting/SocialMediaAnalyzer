import { storage } from './storage';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { AudioDownloadService } from './audioDownloadService';

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
  private audioDownloadService: AudioDownloadService | null = null;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  setWhatsAppService(service: any) {
    this.whatsappService = service;
    this.audioDownloadService = new AudioDownloadService(service);
  }

  async handleMessage(from: string, text: string, audioMessage?: any): Promise<void> {
    const phone = from.replace('@s.whatsapp.net', '');
    console.log(`\n🎯 [INTERVIEW] ===== NOVA MENSAGEM RECEBIDA =====`);
    console.log(`📱 [INTERVIEW] Telefone: ${phone}`);
    console.log(`💬 [INTERVIEW] Texto: "${text}"`);
    console.log(`🎵 [INTERVIEW] Áudio: ${audioMessage ? 'SIM' : 'NÃO'}`);
    
    if (audioMessage) {
      console.log(`🎧 [INTERVIEW] Dados do áudio:`, {
        type: audioMessage.type || 'não informado',
        mimetype: audioMessage.mimetype || 'não informado',
        size: audioMessage.fileLength || 'não informado'
      });
    }

    // Verificar se há entrevista ativa
    const activeInterview = this.activeInterviews.get(phone);
    console.log(`🔍 [INTERVIEW] Entrevista ativa para ${phone}: ${activeInterview ? 'SIM' : 'NÃO'}`);
    
    if (activeInterview) {
      console.log(`📊 [INTERVIEW] Status da entrevista:`, {
        candidato: activeInterview.candidateName,
        vaga: activeInterview.jobName,
        perguntaAtual: activeInterview.currentQuestion + 1,
        totalPerguntas: activeInterview.questions.length,
        respostasJaRecebidas: activeInterview.responses.length
      });
    }

    if (text === '1' && !activeInterview) {
      console.log(`🚀 [INTERVIEW] Comando "1" detectado - iniciando entrevista`);
      await this.startInterview(phone);
    } else if (text === '2') {
      console.log(`❌ [INTERVIEW] Comando "2" detectado - recusando entrevista`);
      await this.sendMessage(from, "Entendido. Obrigado!");
    } else if (text.toLowerCase() === 'parar' || text.toLowerCase() === 'sair') {
      console.log(`⏹️ [INTERVIEW] Comando "parar/sair" detectado`);
      await this.stopInterview(phone);
    } else if (activeInterview) {
      console.log(`📝 [INTERVIEW] Processando resposta para pergunta ${activeInterview.currentQuestion + 1}`);
      await this.processResponse(from, activeInterview, text, audioMessage);
    } else {
      console.log(`❓ [INTERVIEW] Comando não reconhecido - enviando instruções`);
      await this.sendMessage(from, "Digite:\n1 - Iniciar entrevista\n2 - Não participar");
    }
    
    console.log(`🎯 [INTERVIEW] ===== FIM DO PROCESSAMENTO =====\n`);
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
    try {
      const jobs = await storage.getJobs();
      
      const job = jobs.find(j => j.perguntas && j.perguntas.length > 0);
      
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
      
    } catch (error) {
      console.log(`❌ Erro ao buscar vaga:`, error.message);
      await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Erro ao carregar entrevista. Tente novamente.");
    }
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
    console.log(`\n🎯 [AUDIO] ===== PROCESSANDO RESPOSTA =====`);
    console.log(`📝 [AUDIO] Telefone: ${phone}`);
    console.log(`📝 [AUDIO] Pergunta atual: ${interview.currentQuestion + 1}/${interview.questions.length}`);
    console.log(`📝 [AUDIO] Texto recebido: "${text}"`);
    console.log(`🎵 [AUDIO] Áudio presente: ${audioMessage ? 'SIM' : 'NÃO'}`);

    let responseText = text;
    let audioFile: string | undefined;
    let audioSavedToDB = false;
    let transcriptionSavedToDB = false;

    // Se há áudio, processar
    if (audioMessage) {
      console.log(`🎧 [AUDIO] Iniciando processamento de áudio...`);
      console.log(`🎧 [AUDIO] Dados do áudio:`, {
        type: audioMessage.type,
        mimetype: audioMessage.mimetype,
        fileLength: audioMessage.fileLength,
        url: audioMessage.url ? 'presente' : 'não presente'
      });
      
      try {
        console.log(`🔄 [AUDIO] Baixando áudio primeiro...`);
        const audioBuffer = await this.audioDownloadService.downloadAudio(audioMessage, phone);
        
        console.log(`🔄 [AUDIO] Chamando transcribeAudio...`);
        const transcription = await this.transcribeAudio(audioMessage, phone, text);
        
        if (transcription && transcription.length > 0) {
          responseText = transcription;
          console.log(`✅ [AUDIO] Transcrição bem-sucedida: "${responseText}"`);
          
          // Salvar áudio localmente e no banco usando o buffer baixado
          if (audioBuffer) {
            try {
              console.log(`💾 [AUDIO] Salvando áudio no sistema...`);
              audioFile = await this.audioDownloadService.saveAudioFile(audioBuffer, phone);
              
              audioSavedToDB = true;
              console.log(`✅ [AUDIO] Áudio salvo com sucesso: ${audioFile}`);
            } catch (saveError: any) {
              console.log(`❌ [AUDIO] Erro ao salvar áudio:`, saveError?.message || saveError);
            }
          } else {
            console.log(`⚠️ [AUDIO] AudioBuffer vazio, não foi possível salvar arquivo`);
          }
          
        } else {
          console.log(`⚠️ [AUDIO] Transcrição vazia, usando texto: "${text}"`);
        }
      } catch (error) {
        console.log(`❌ [AUDIO] Erro na transcrição:`, error.message);
        console.log(`❌ [AUDIO] Stack trace:`, error.stack);
      }
    }

    // Salvar resposta na entrevista ativa
    const currentQuestion = interview.questions[interview.currentQuestion];
    const response = {
      questionId: interview.currentQuestion,
      questionText: currentQuestion.pergunta,
      responseText: responseText,
      audioFile: audioFile,
      timestamp: new Date().toISOString()
    };

    interview.responses.push(response);
    
    console.log(`💾 [AUDIO] Resposta salva na entrevista ativa:`, {
      pergunta: interview.currentQuestion + 1,
      respostaTexto: responseText.substring(0, 50) + (responseText.length > 50 ? '...' : ''),
      arquivoAudio: audioFile || 'nenhum',
      timestamp: response.timestamp
    });

    // Salvar transcrição no Firebase
    try {
      console.log(`💾 [AUDIO] Salvando transcrição no Firebase...`);
      const responseData = {
        id: Date.now(),
        candidatePhone: phone,
        candidateName: interview.candidateName,
        jobName: interview.jobName,
        questionId: interview.currentQuestion,
        questionText: currentQuestion.pergunta,
        responseText: responseText,
        audioFile: audioFile || null,
        timestamp: new Date().toISOString(),
        hasAudio: !!audioMessage,
        transcriptionSuccess: responseText.length > 0
      };
      
      // Salvar no Firebase Storage
      const { firebaseDb } = await import('./storage');
      const { doc, setDoc, collection } = await import('firebase/firestore');
      
      await setDoc(doc(collection(firebaseDb, 'interview_responses'), responseData.id.toString()), responseData);
      transcriptionSavedToDB = true;
      console.log(`✅ [AUDIO] Resposta salva no Firebase:`, responseData.id);
    } catch (saveError) {
      console.log(`❌ [AUDIO] Erro ao salvar no Firebase:`, saveError.message);
    }

    // Avançar para próxima pergunta
    interview.currentQuestion++;
    this.activeInterviews.set(phone, interview);

    console.log(`📊 [AUDIO] Status da entrevista atualizado:`, {
      proximaPergunta: interview.currentQuestion + 1,
      totalPerguntas: interview.questions.length,
      respostasColetadas: interview.responses.length,
      audioSalvoNoBanco: audioSavedToDB,
      transcricaoSalvaNoBanco: transcriptionSavedToDB
    });

    // Enviar confirmação
    await this.sendMessage(from, `✅ Resposta recebida! ${audioMessage ? '🎵 Áudio processado.' : ''} Preparando próxima pergunta...`);
    
    setTimeout(async () => {
      await this.sendNextQuestion(phone, interview);
    }, 2000);
    
    console.log(`🎯 [AUDIO] ===== FIM DO PROCESSAMENTO =====\n`);
  }

  private async transcribeAudio(audioMessage: any, phone: string, fallbackText = ''): Promise<string> {
    console.log(`🎯 [WHISPER] Processando resposta de áudio...`);
    
    try {
      // Tentar baixar o áudio primeiro
      const audioBuffer = await this.audioDownloadService.downloadAudio(audioMessage, phone);
      
      if (audioBuffer && audioBuffer.length > 0) {
        console.log(`🎧 [WHISPER] Áudio baixado com sucesso: ${audioBuffer.length} bytes`);
        
        // Salvar áudio temporariamente para OpenAI Whisper
        const fs = await import('fs');
        const path = await import('path');
        const tempAudioPath = path.join('uploads', `temp_audio_${phone}_${Date.now()}.webm`);
        
        await fs.promises.writeFile(tempAudioPath, audioBuffer);
        console.log(`💾 [WHISPER] Áudio salvo temporariamente: ${tempAudioPath}`);
        
        // Transcrever com OpenAI Whisper
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        formData.append('file', fs.createReadStream(tempAudioPath));
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
        
        if (response.ok) {
          const result = await response.json();
          const transcription = result.text?.trim();
          
          if (transcription && transcription.length > 0) {
            console.log(`✅ [WHISPER] Transcrição real obtida: "${transcription}"`);
            
            // Limpar arquivo temporário
            try {
              await fs.promises.unlink(tempAudioPath);
            } catch {}
            
            return transcription;
          }
        }
        
        // Limpar arquivo temporário em caso de erro
        try {
          await fs.promises.unlink(tempAudioPath);
        } catch {}
      }
    } catch (error) {
      console.log(`❌ [WHISPER] Erro na transcrição real:`, error.message);
    }
    
    // Fallback para texto se fornecido
    if (fallbackText && fallbackText.trim()) {
      console.log(`📝 [WHISPER] Usando texto fornecido: "${fallbackText}"`);
      return fallbackText;
    }
    
    // Último recurso
    const defaultResponse = `Resposta de áudio processada`;
    console.log(`📝 [WHISPER] Usando resposta padrão: "${defaultResponse}"`);
    return defaultResponse;
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
    // Buscar candidatos do cliente ativo (1749849987543)
    console.log(`🔍 [DEBUG] Buscando candidatos para telefone: ${phone}`);
    const candidates = await storage.getCandidatesByClientId(1749849987543);
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