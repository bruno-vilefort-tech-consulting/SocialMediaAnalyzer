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
    console.log(`\n🎯 [INTERVIEW] ===== NOVA MENSAGEM RECEBIDA =====`);
    console.log(`📱 [INTERVIEW] Telefone: ${phone}`);
    console.log(`💬 [INTERVIEW] Texto: "${text}"`);
    console.log(`🎵 [INTERVIEW] Áudio: ${audioMessage ? 'SIM' : 'NÃO'}`);
    console.log(`🏢 [INTERVIEW] Cliente ID: ${clientId || 'não informado'}`);
    
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
      // CORREÇÃO CRÍTICA: Verificar se WhatsApp está conectado antes de iniciar
      if (!this.whatsappService || (this.whatsappService.isConnected && !this.whatsappService.isConnected())) {
        console.log(`❌ [CRITICAL_FIX] WhatsApp não conectado - aguardando reconexão...`);
        await this.sendMessage(from, "Aguarde um momento, estamos conectando o sistema...");
        // Tentar novamente em 3 segundos
        setTimeout(async () => {
          await this.startInterview(phone);
        }, 3000);
        return;
      }
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
    
    const message = `📝 Pergunta ${questionNum}/${total}:\n\n${question.pergunta}\n\n🎤 Responda somente por áudio`;

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
      console.log(`🎙️ [TTS] Iniciando geração de áudio para pergunta: "${questionText}"`);
      
      // Buscar configuração OpenAI
      const config = await storage.getMasterSettings();
      if (!config?.openaiApiKey) {
        console.log(`❌ [TTS] OpenAI API não configurada - pergunta enviada apenas por texto`);
        return;
      }

      console.log(`✅ [TTS] OpenAI API configurada - gerando áudio TTS`);

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
        console.log(`✅ [TTS] Áudio gerado com sucesso - convertendo para buffer`);
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
          console.log(`💾 [TTS] Áudio salvo temporariamente: ${tempFilePath}`);
          
          const { simpleMultiBaileyService } = await import('../whatsapp/services/simpleMultiBailey');
          const clientConnections = await simpleMultiBaileyService.getClientConnections('1749849987543');
          
          if (clientConnections && clientConnections.activeConnections > 0) {
            console.log(`📱 [TTS] Enviando áudio via simpleMultiBailey para ${phone}`);
            
            // Usar primeiro slot ativo
            const activeSlot = clientConnections.connections.find((conn: any) => conn.isConnected);
            if (activeSlot) {
              const result = await simpleMultiBaileyService.sendAudioMessage('1749849987543', activeSlot.slotNumber, phone, Buffer.from(audioBuffer));
              
              if (result.success) {
                console.log(`🎵 [TTS] Áudio TTS enviado com sucesso para ${phone} via slot ${activeSlot.slotNumber}`);
              } else {
                console.log(`❌ [TTS] Falha no envio do áudio: ${result.error}`);
              }
            } else {
              console.log(`❌ [TTS] Nenhum slot ativo encontrado`);
            }
          } else {
            console.log(`❌ [TTS] Nenhuma conexão WhatsApp ativa encontrada`);
          }
          
          // Limpar arquivo temporário
          setTimeout(() => {
            try {
              if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log(`🗑️ [TTS] Arquivo temporário removido: ${tempFilePath}`);
              }
            } catch (cleanupError) {
              console.log(`⚠️ [TTS] Erro ao remover arquivo temporário:`, cleanupError);
            }
          }, 10000); // Remover após 10 segundos
          
        } catch (audioError: any) {
          console.log(`❌ [TTS] Erro ao enviar áudio via simpleMultiBailey:`, audioError.message);
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ [TTS] Erro na API OpenAI: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.log(`❌ [TTS] Erro ao processar TTS:`, error.message);
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
              // CORRIGIDO: Incluir selectionId e questionNumber para nomenclatura consistente
              const selectionId = interview.selectionId || 'unknown';
              const questionNumber = interview.currentQuestion + 1;
              audioFile = await this.audioDownloadService.saveAudioFile(audioBuffer, phone, selectionId, questionNumber);
              
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
      
      // Salvar resposta usando storage interface com estrutura completa
      const responseWithSelection = {
        interviewId: parseInt(interview.candidateId),
        questionId: interview.currentQuestion + 1,
        audioUrl: audioFile || null,
        transcription: responseText,
        score: null,
        aiAnalysis: { rawResponse: responseData },
        recordingDuration: null,
        selectionId: interview.selectionId || 'unknown',
        clientId: interview.clientId,
        candidateId: parseInt(interview.candidateId),
        questionText: interview.questions[interview.currentQuestion].pergunta
      };
      
      console.log(`💾 [DEBUG_NOVA_SELEÇÃO] Salvando resposta simples com estrutura:`, {
        candidateId: responseWithSelection.candidateId,
        selectionId: responseWithSelection.selectionId,
        clientId: responseWithSelection.clientId,
        questionId: responseWithSelection.questionId
      });
      
      if (storage.createResponseWithSelection) {
        await storage.createResponseWithSelection(responseWithSelection);
      } else {
        await storage.createResponse(responseWithSelection);
      }
      transcriptionSavedToDB = true;
      console.log(`✅ [DEBUG_NOVA_SELEÇÃO] Resposta simples salva no Firebase:`, responseData.id);
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
        const tempAudioPath = path.join(UPLOADS_DIR, `temp_audio_${phone}_${Date.now()}.webm`);
        
        await fs.promises.writeFile(tempAudioPath, audioBuffer);
        console.log(`💾 [WHISPER] Áudio salvo temporariamente: ${tempAudioPath}`);
        
        // Transcrever com OpenAI Whisper usando OpenAI SDK
        const transcription = await this.openai.audio.transcriptions.create({
          file: fs.createReadStream(tempAudioPath),
          model: 'whisper-1',
          language: 'pt',
          response_format: 'text'
        });
        
        console.log(`🌐 [WHISPER] Transcrição via OpenAI SDK...`);
        console.log(`✅ [WHISPER] Transcrição obtida: "${transcription}"`);
        
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
    try {
      console.log(`💾 [SAVE] Salvando entrevista no PostgreSQL...`);
      
      // Buscar candidato para obter o ID
      const candidate = await this.findCandidate(interview.phone);
      if (!candidate) {
        console.log(`❌ [SAVE] Candidato não encontrado para ${interview.phone}`);
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
      
      console.log(`✅ [SAVE] Entrevista criada no BD com ID: ${newInterview.id}`);
      
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
          
          console.log(`✅ [SAVE] Resposta ${i + 1} salva com ID: ${savedResponse.id}`);
        } catch (responseError) {
          console.log(`❌ [SAVE] Erro ao salvar resposta ${i + 1}:`, responseError.message);
        }
      }
      
      console.log(`🎉 [SAVE] Entrevista completa salva no PostgreSQL`);
      
    } catch (error) {
      console.log(`❌ [SAVE] Erro ao salvar entrevista:`, error.message);
    }
  }

  private async findCandidate(phone: string) {
    console.log(`🔍 [DEBUG] Buscando candidatos para telefone: ${phone}`);
    
    // Buscar todos os candidatos no Firebase
    const candidates = await storage.getAllCandidates();
    console.log(`📋 [DEBUG] Total de candidatos encontrados: ${candidates.length}`);
    
    // Log dos candidatos para debug
    candidates.forEach(c => {
      const candidatePhone = (c as any).phone || c.whatsapp;
      console.log(`📱 [DEBUG] Candidato: ${c.name} - WhatsApp: ${c.whatsapp} - Phone: ${candidatePhone}`);
    });
    
    const candidate = candidates.find(c => {
      // Buscar tanto no campo whatsapp quanto no campo phone
      const candidateWhatsApp = c.whatsapp;
      const candidatePhone = (c as any).phone;
      
      if (!candidateWhatsApp && !candidatePhone) return false;
      
      const searchPhone = phone.replace(/\D/g, '');
      
      // Verificar campo whatsapp
      if (candidateWhatsApp) {
        const normalizedWhatsApp = candidateWhatsApp.replace(/\D/g, '');
        console.log(`🔍 [DEBUG] Comparando WhatsApp: ${normalizedWhatsApp} com ${searchPhone}`);
        if (normalizedWhatsApp === searchPhone) return true;
      }
      
      // Verificar campo phone
      if (candidatePhone) {
        const normalizedPhone = candidatePhone.replace(/\D/g, '');
        console.log(`🔍 [DEBUG] Comparando Phone: ${normalizedPhone} com ${searchPhone}`);
        if (normalizedPhone === searchPhone) return true;
      }
      
      return false;
    });
    
    if (candidate) {
      console.log(`✅ [DEBUG] Candidato encontrado: ${candidate.name} (ID: ${candidate.id})`);
    } else {
      console.log(`❌ [DEBUG] Nenhum candidato encontrado para ${phone}`);
    }
    
    return candidate;
  }

  private async sendMessage(to: string, message: string): Promise<void> {
    try {
      console.log(`📤 [SEND] Tentando enviar mensagem para ${to}: "${message.substring(0, 50)}..."`);
      
      if (this.whatsappService && this.whatsappService.socket) {
        // Usar socket direto do WhatsApp QR Service
        await this.whatsappService.socket.sendMessage(to, { text: message });
        console.log(`✅ [SEND] Mensagem enviada via socket`);
      } else if (this.whatsappService && this.whatsappService.sendTextMessage) {
        // Usar método sendTextMessage se disponível
        const phone = to.replace('@s.whatsapp.net', '');
        await this.whatsappService.sendTextMessage(phone, message);
        console.log(`✅ [SEND] Mensagem enviada via sendTextMessage`);
      } else {
        // Fallback: usar interactiveInterviewService que tem método de envio funcionando
        console.log(`🔄 [SEND] Usando fallback via interactiveInterviewService`);
        const { interactiveInterviewService } = await import('./interactiveInterviewService');
        await interactiveInterviewService.sendMessage(to, message);
        console.log(`✅ [SEND] Mensagem enviada via fallback`);
      }
    } catch (error) {
      console.log(`❌ [SEND] Erro ao enviar mensagem:`, error.message);
      // Não falhar silenciosamente - tentar método alternativo
      try {
        console.log(`🔄 [SEND] Tentando método alternativo...`);
        const { interactiveInterviewService } = await import('./interactiveInterviewService');
        await interactiveInterviewService.sendMessage(to, message);
        console.log(`✅ [SEND] Mensagem enviada via método alternativo`);
      } catch (fallbackError) {
        console.log(`❌ [SEND] Falha total no envio:`, fallbackError.message);
      }
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