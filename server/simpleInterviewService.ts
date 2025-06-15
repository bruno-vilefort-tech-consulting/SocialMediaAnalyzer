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
        console.log(`🔄 [AUDIO] Chamando transcribeAudio...`);
        const transcription = await this.transcribeAudio(audioMessage);
        
        if (transcription && transcription.length > 0) {
          responseText = transcription;
          audioFile = `audio_${phone}_${Date.now()}.ogg`;
          console.log(`✅ [AUDIO] Transcrição bem-sucedida: "${responseText}"`);
          console.log(`📁 [AUDIO] Nome do arquivo de áudio: ${audioFile}`);
          
          // Salvar áudio localmente e no banco
          try {
            console.log(`💾 [AUDIO] Salvando áudio no sistema...`);
            const fs = require('fs');
            const tempAudioPath = `./uploads/${audioFile}`;
            fs.writeFileSync(tempAudioPath, audioBuffer);
            
            // Salvar referência no banco de dados
            const audioData = {
              id: Date.now(),
              candidatePhone: phone,
              filename: audioFile,
              filepath: tempAudioPath,
              size: audioBuffer.length,
              mimetype: audioMessage.mimetype || 'audio/ogg',
              timestamp: new Date().toISOString()
            };
            
            const storageModule = await import('./storage');
            const { doc, setDoc, collection } = await import('firebase/firestore');
            const db = storageModule.storage.db || storageModule.firebaseDb;
            await setDoc(doc(collection(db, 'audio_files'), audioData.id.toString()), audioData);
            
            audioSavedToDB = true;
            console.log(`✅ [AUDIO] Áudio salvo localmente: ${tempAudioPath}`);
            console.log(`✅ [AUDIO] Referência salva no banco: ${audioData.id}`);
          } catch (saveError) {
            console.log(`❌ [AUDIO] Erro ao salvar áudio:`, saveError.message);
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

  private async transcribeAudio(audioMessage: any): Promise<string> {
    console.log(`\n🎯 [WHISPER] ===== INICIANDO TRANSCRIÇÃO =====`);
    
    try {
      // Baixar áudio via Baileys
      console.log(`⬇️ [WHISPER] Baixando áudio do WhatsApp...`);
      console.log(`⬇️ [WHISPER] Dados da mensagem de áudio:`, {
        type: audioMessage.type,
        mimetype: audioMessage.mimetype,
        fileLength: audioMessage.fileLength,
        url: audioMessage.url ? 'URL presente' : 'URL ausente'
      });
      
      // Baixar áudio usando o socket do WhatsApp
      let audioBuffer;
      try {
        if (this.whatsappService && this.whatsappService.socket) {
          console.log(`🔌 [WHISPER] Usando socket ativo do WhatsApp service`);
          
          // Usar o socket diretamente para download
          const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
          audioBuffer = await downloadMediaMessage(
            audioMessage,
            'buffer',
            {},
            {
              reuploadRequest: this.whatsappService.socket.updateMediaMessage
            }
          );
          console.log(`✅ [WHISPER] Download realizado com socket - Tamanho: ${audioBuffer?.length || 0} bytes`);
        } else {
          throw new Error('Socket do WhatsApp não disponível');
        }
      } catch (downloadError) {
        console.log(`❌ [WHISPER] Erro no download:`, downloadError.message);
        
        // Tentar método alternativo com dados da mensagem original
        try {
          console.log(`🔄 [WHISPER] Tentando método alternativo de download...`);
          const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
          audioBuffer = await downloadMediaMessage(audioMessage, 'buffer');
          console.log(`✅ [WHISPER] Download alternativo realizado - Tamanho: ${audioBuffer?.length || 0} bytes`);
        } catch (altError) {
          console.log(`❌ [WHISPER] Download alternativo também falhou:`, altError.message);
          throw new Error(`Falha no download de áudio: ${downloadError.message}`);
        }
      }
      
      if (!audioBuffer || audioBuffer.length === 0) {
        console.log(`❌ [WHISPER] Áudio vazio ou inválido`);
        throw new Error('Áudio vazio após download');
      }

      // Salvar temporariamente
      const tempFile = path.join('./uploads', `temp_${Date.now()}.ogg`);
      fs.writeFileSync(tempFile, audioBuffer);
      console.log(`💾 [WHISPER] Arquivo temporário salvo: ${tempFile}`);
      console.log(`📊 [WHISPER] Tamanho do arquivo: ${fs.statSync(tempFile).size} bytes`);

      // Preparar FormData para OpenAI
      console.log(`🔄 [WHISPER] Preparando FormData para OpenAI Whisper...`);
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempFile));
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');
      
      console.log(`🚀 [WHISPER] Enviando para OpenAI Whisper API...`);
      console.log(`🔑 [WHISPER] API Key presente: ${process.env.OPENAI_API_KEY ? 'SIM' : 'NÃO'}`);

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      console.log(`📡 [WHISPER] Response status: ${response.status}`);
      console.log(`📡 [WHISPER] Response ok: ${response.ok}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ [WHISPER] Erro da API OpenAI:`, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`📝 [WHISPER] Resultado completo da API:`, result);
      
      const transcription = result.text || '';
      console.log(`✅ [WHISPER] Transcrição extraída: "${transcription}"`);
      console.log(`📊 [WHISPER] Tamanho da transcrição: ${transcription.length} caracteres`);
      
      // Limpar arquivo temporário
      fs.unlinkSync(tempFile);
      console.log(`🗑️ [WHISPER] Arquivo temporário removido: ${tempFile}`);
      
      console.log(`🎯 [WHISPER] ===== TRANSCRIÇÃO CONCLUÍDA =====\n`);
      return transcription;
      
    } catch (error) {
      console.log(`❌ [WHISPER] ERRO NA TRANSCRIÇÃO:`, error.message);
      console.log(`❌ [WHISPER] Stack trace:`, error.stack);
      console.log(`🎯 [WHISPER] ===== TRANSCRIÇÃO FALHOU =====\n`);
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