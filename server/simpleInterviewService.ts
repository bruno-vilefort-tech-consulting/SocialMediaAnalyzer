import { storage } from './storage';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { AudioDownloadService } from './audioDownloadService';
import { UPLOADS_DIR } from '../src/config/paths';

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
  selectionId?: string;  // ADICIONADO: para nomenclatura consistente dos arquivos de áudio
  clientId?: number;     // ADICIONADO: para contexto adicional
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

  async handleMessage(from: string, text: string, audioMessage?: any, clientId?: string): Promise<void> {
    const phone = from.replace('@s.whatsapp.net', '');

    // Verificar se há entrevista ativa
    const activeInterview = this.activeInterviews.get(phone);

    if (text === '1' && !activeInterview) {
      // CORREÇÃO CRÍTICA: Verificar se WhatsApp está conectado antes de iniciar
      if (!this.whatsappService || (this.whatsappService.isConnected && !this.whatsappService.isConnected())) {
        await this.sendMessage(from, "Aguarde um momento, estamos conectando o sistema...");
        // Tentar novamente em 3 segundos
        setTimeout(async () => {
          await this.startInterview(phone);
        }, 3000);
        return;
      }
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
      
      // Criar entrevista ativa
      const interview: ActiveInterview = {
        candidateId: candidate.id.toString(),
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
    
    const message = `📝 Pergunta ${questionNum}/${total}:\n\n${question.pergunta}\n\n🎤 Responda somente por áudio`;

    await this.sendMessage(`${phone}@s.whatsapp.net`, message);

    // Tentar enviar áudio TTS
    try {
      await this.sendQuestionAudio(phone, question.pergunta);
    } catch (error) {
      // TTS failed, question sent via text
    }
  }

  private async sendQuestionAudio(phone: string, questionText: string): Promise<void> {
    try {
      // Buscar configuração OpenAI
      const config = await storage.getMasterSettings();
      if (!config?.openaiApiKey) {
        return;
      }

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: questionText,
          voice: "nova",
          response_format: "opus",
          speed: 1.0
        })
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        
        // Tentar enviar áudio via sistema multi-WhatsApp
        try {
          const fs = await import('fs');
          const path = await import('path');
          
          // Salvar áudio temporário para envio
          const tempDir = path.join(process.cwd(), 'temp');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          const tempFileName = `tts_${phone}_${Date.now()}.ogg`;
          const tempFilePath = path.join(tempDir, tempFileName);
          
          // Salvar buffer como arquivo
          fs.writeFileSync(tempFilePath, Buffer.from(audioBuffer));
          
          const { simpleMultiBaileyService } = await import('../whatsapp/services/simpleMultiBailey');
          const clientConnections = await simpleMultiBaileyService.getClientConnections('1749849987543');
          
          if (clientConnections && clientConnections.activeConnections > 0) {
            // Usar primeiro slot ativo
            const activeSlot = clientConnections.connections.find((conn: any) => conn.isConnected);
            if (activeSlot) {
              const result = await simpleMultiBaileyService.sendAudioMessage('1749849987543', activeSlot.slotNumber, phone, Buffer.from(audioBuffer));
            }
          }
          
          // Limpar arquivo temporário
          setTimeout(() => {
            try {
              if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
              }
            } catch (cleanupError) {
              // Cleanup error handled silently
            }
          }, 10000); // Remover após 10 segundos
          
        } catch (audioError: any) {
          // Audio send error handled silently
        }
      } else {
        const errorText = await response.text();
      }
    } catch (error) {
      // TTS error handled silently
    }
  }

  private async processResponse(from: string, interview: ActiveInterview, text: string, audioMessage?: any): Promise<void> {
    const phone = from.replace('@s.whatsapp.net', '');

    let responseText = text;
    let audioFile: string | undefined;
    let audioSavedToDB = false;
    let transcriptionSavedToDB = false;

    // Se há áudio, processar
    if (audioMessage) {
      try {
        const audioBuffer = await this.audioDownloadService.downloadAudio(audioMessage, phone);
        
        const transcription = await this.transcribeAudio(audioMessage, phone, text);
        
        if (transcription && transcription.length > 0) {
          responseText = transcription;
          
          // Salvar áudio localmente e no banco usando o buffer baixado
          if (audioBuffer) {
            try {
              // CORRIGIDO: Incluir selectionId e questionNumber para nomenclatura consistente
              const selectionId = interview.selectionId || 'unknown';
              const questionNumber = interview.currentQuestion + 1;
              audioFile = await this.audioDownloadService.saveAudioFile(audioBuffer, phone, selectionId, questionNumber);
              
              audioSavedToDB = true;
            } catch (saveError: any) {
              // Audio save error handled silently
            }
          }
        }
      } catch (error) {
        // Audio processing error handled silently
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

    // Salvar transcrição no Firebase
    try {
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
      
      // Salvar resposta usando storage interface
      const responseForDB = {
        interviewId: parseInt(interview.candidateId),
        questionId: interview.currentQuestion,
        transcription: responseText || '',
        audioUrl: audioFile || '',
        score: 0,
        recordingDuration: 0
      };
      
      await storage.createResponse(responseForDB);
      transcriptionSavedToDB = true;
    } catch (saveError) {
      // Firebase save error handled silently
    }

    // Avançar para próxima pergunta
    interview.currentQuestion++;
    this.activeInterviews.set(phone, interview);

    // Enviar confirmação
    await this.sendMessage(from, `✅ Resposta recebida! ${audioMessage ? '🎵 Áudio processado.' : ''} Preparando próxima pergunta...`);
    
    setTimeout(async () => {
      await this.sendNextQuestion(phone, interview);
    }, 2000);
  }

  private async transcribeAudio(audioMessage: any, phone: string, fallbackText = ''): Promise<string> {
    try {
      // Tentar baixar o áudio primeiro
      const audioBuffer = await this.audioDownloadService.downloadAudio(audioMessage, phone);
      
      if (audioBuffer && audioBuffer.length > 0) {
        // Salvar áudio temporariamente para OpenAI Whisper
        const fs = await import('fs');
        const path = await import('path');
        const tempAudioPath = path.join(UPLOADS_DIR, `temp_audio_${phone}_${Date.now()}.webm`);
        
        await fs.promises.writeFile(tempAudioPath, audioBuffer);
        
        // Transcrever com OpenAI Whisper usando OpenAI SDK
        const transcription = await this.openai.audio.transcriptions.create({
          file: fs.createReadStream(tempAudioPath),
          model: 'whisper-1',
          language: 'pt',
          response_format: 'text'
        });
        
        // Limpar arquivo temporário
        try {
          await fs.promises.unlink(tempAudioPath);
        } catch {}
        
        if (transcription && transcription.trim().length > 0) {
          return transcription.trim();
        }

        // Limpar arquivo temporário em caso de erro
        try {
          await fs.promises.unlink(tempAudioPath);
        } catch {}
      }
    } catch (error) {
      // Transcription error handled silently
    }
    
    // Fallback para texto se fornecido
    if (fallbackText && fallbackText.trim()) {
      return fallbackText;
    }
    
    // Último recurso
    const defaultResponse = `Resposta de áudio processada`;
    return defaultResponse;
  }

  private async finishInterview(phone: string, interview: ActiveInterview): Promise<void> {
    // Salvar respostas no banco de dados
    try {
      await this.saveInterviewResults(interview);
    } catch (error) {
      // Save error handled silently
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
    try {
      // Buscar candidato para obter o ID
      const candidate = await this.findCandidate(interview.phone);
      if (!candidate) {
        return;
      }
      
      // Criar entrevista no banco PostgreSQL
      const newInterview = await storage.createInterview({
        candidateId: candidate.id,
        selectionId: 1, // ID padrão por enquanto
        token: `interview_${Date.now()}`,
        status: 'completed',
        startedAt: new Date(interview.startTime),
        completedAt: new Date(),
        category: 'whatsapp'
      });
      
      // Salvar cada resposta no banco
      for (let i = 0; i < interview.responses.length; i++) {
        const response = interview.responses[i];
        
        try {
          const savedResponse = await storage.createResponse({
            interviewId: newInterview.id,
            questionId: response.questionId,
            transcription: response.responseText || '',
            audioUrl: response.audioFile || '',
            score: 0,
            recordingDuration: 0
          });
          
        } catch (responseError) {
          // Response save error handled silently
        }
      }
      
    } catch (error) {
      // Interview save error handled silently
    }
  }

  private async findCandidate(phone: string) {
    // Buscar todos os candidatos no Firebase
    const candidates = await storage.getAllCandidates();
    
    const candidate = candidates.find(c => {
      // Buscar tanto no campo whatsapp quanto no campo phone
      const candidateWhatsApp = c.whatsapp;
      const candidatePhone = (c as any).phone;
      
      if (!candidateWhatsApp && !candidatePhone) return false;
      
      const searchPhone = phone.replace(/\D/g, '');
      
      // Verificar campo whatsapp
      if (candidateWhatsApp) {
        const normalizedWhatsApp = candidateWhatsApp.replace(/\D/g, '');
        if (normalizedWhatsApp === searchPhone) return true;
      }
      
      // Verificar campo phone
      if (candidatePhone) {
        const normalizedPhone = candidatePhone.replace(/\D/g, '');
        if (normalizedPhone === searchPhone) return true;
      }
      
      return false;
    });
    
    return candidate;
  }

  private async sendMessage(to: string, message: string): Promise<void> {
    try {
      if (this.whatsappService && this.whatsappService.socket) {
        // Usar socket direto do WhatsApp QR Service
        await this.whatsappService.socket.sendMessage(to, { text: message });
      } else if (this.whatsappService && this.whatsappService.sendTextMessage) {
        // Usar método sendTextMessage se disponível
        const phone = to.replace('@s.whatsapp.net', '');
        await this.whatsappService.sendTextMessage(phone, message);
              }
      } catch (error) {
        // Send error handled silently
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