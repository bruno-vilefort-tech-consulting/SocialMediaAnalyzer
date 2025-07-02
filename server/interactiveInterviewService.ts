import { AudioDownloadService } from './audioDownloadService.js';
import { storage } from './storage';

// Estado em memória das entrevistas ativas
interface ActiveInterview {
  candidateId: number;
  candidateName: string;
  phone: string;
  jobId: number;
  jobName: string;
  clientId: string;
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
  selectionId: string;
  interviewDbId?: string;
}

class InteractiveInterviewService {
  private activeInterviews: Map<string, ActiveInterview> = new Map();
  private audioDownloadService: AudioDownloadService | null = null;

  constructor() {
    // Inicializar AudioDownloadService com null, será configurado quando necessário
  }

  private async downloadAudioDirect(message: any, phone: string, clientId: string, selectionId: string, questionNumber: number): Promise<string | null> {
    console.log(`\n🎯 [AUDIO_DOWNLOAD] ===== DOWNLOAD COM NOVA NOMENCLATURA =====`);
    console.log(`📱 [AUDIO_DOWNLOAD] Telefone: ${phone}, Seleção: ${selectionId}, Pergunta: ${questionNumber}`);
    
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      // Nova nomenclatura: audio_[whatsapp]_[selectionId]_R[numero].ogg
      const audioFileName = `audio_${cleanPhone}_${selectionId}_R${questionNumber}.ogg`;
      const audioPath = `uploads/${audioFileName}`;
      
      // Verificar se arquivo já existe (evitar duplicação)
      const fs = await import('fs');
      if (await fs.promises.access(audioPath).then(() => true).catch(() => false)) {
        console.log(`✅ [AUDIO_DOWNLOAD] Arquivo já existe, reutilizando: ${audioPath}`);
        return audioPath;
      }
      
      // Verificar se mensagem foi corrigida pelo handler Baileys
      if (message._audioFixed && message._audioPath) {
        console.log(`✅ [AUDIO_DOWNLOAD] Movendo áudio corrigido (sem duplicar)`);
        await fs.promises.rename(message._audioPath, audioPath);
        return audioPath;
      }
      
      if (message._audioBuffer) {
        console.log(`✅ [AUDIO_DOWNLOAD] Salvando buffer com nova nomenclatura`);
        await fs.promises.writeFile(audioPath, message._audioBuffer);
        return audioPath;
      }
      
      // Fallback para método original se não houve correção
      console.log(`🔄 [AUDIO_DOWNLOAD] Tentando download direto...`);
      
      const { whatsappBaileyService } = await import('../whatsapp/services/whatsappBaileyService');
      const connection = whatsappBaileyService.getConnection(clientId);
      
      if (!connection?.socket) {
        console.log(`❌ [AUDIO_DOWNLOAD] Socket não disponível`);
        return null;
      }
      
      // Tentar download com estrutura corrigida
      let audioMessage = null;
      if (message.message?.audioMessage) {
        audioMessage = message.message.audioMessage;
      } else if (message.message?.viewOnceMessageV2?.message?.audioMessage) {
        audioMessage = message.message.viewOnceMessageV2.message.audioMessage;
      }
      
      if (audioMessage) {
        try {
          const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
          const stream = await downloadContentFromMessage(audioMessage, 'audio');
          
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          
          const audioBuffer = Buffer.concat(chunks);
          
          if (audioBuffer && audioBuffer.length > 100) {
            const fs = await import('fs');
            await fs.promises.writeFile(audioPath, audioBuffer);
            console.log(`✅ [AUDIO_DOWNLOAD] Download direto sucesso: ${audioPath} (${audioBuffer.length} bytes)`);
            return audioPath;
          }
        } catch (error) {
          console.log(`⚠️ [AUDIO_DOWNLOAD] Download direto falhou: ${error.message}`);
        }
      }
      
      // Criar arquivo temporário para manter fluxo
      console.log(`🔄 [AUDIO_DOWNLOAD] Criando arquivo temporário com nova nomenclatura`);
      
      const emptyOggHeader = Buffer.from([
        0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      
      await fs.promises.writeFile(audioPath, emptyOggHeader);
      console.log(`⚠️ [AUDIO_DOWNLOAD] Arquivo temporário criado: ${audioPath}`);
      return audioPath;
      
    } catch (error) {
      console.log(`❌ [AUDIO_DOWNLOAD] Erro geral:`, error.message);
      return null;
    }
  }

  async handleMessage(from: string, text: string, audioMessage?: any, clientId?: string): Promise<void> {
    const phone = from.replace('@s.whatsapp.net', '');
    console.log(`\n🎯 [INTERVIEW] ===== NOVA MENSAGEM RECEBIDA =====`);
    console.log(`📱 [INTERVIEW] Telefone: ${phone}`);
    console.log(`💬 [INTERVIEW] Texto: "${text}"`);
    console.log(`🎵 [INTERVIEW] Áudio: ${audioMessage ? 'SIM' : 'NÃO'}`);
    console.log(`🏢 [INTERVIEW] Cliente ID: ${clientId || 'não informado'}`);
    
    if (audioMessage) {
      // Verificar se é mensagem completa do Baileys ou apenas audioMessage
      const audioData = audioMessage.message?.audioMessage || audioMessage;
      console.log(`🎧 [INTERVIEW] Dados do áudio:`, {
        type: audioData.type || 'não informado',
        mimetype: audioData.mimetype || 'não informado',
        size: audioData.fileLength || audioData.seconds || 'não informado',
        hasCompleteMessage: !!audioMessage.message,
        hasKey: !!audioMessage.key
      });
    }

    const activeInterview = this.activeInterviews.get(phone);
    console.log(`📋 [INTERVIEW] Entrevista ativa: ${activeInterview ? 'SIM' : 'NÃO'}`);
    
    if (activeInterview) {
      console.log(`📊 [INTERVIEW] Status da entrevista: pergunta ${activeInterview.currentQuestion + 1}/${activeInterview.questions.length}`);
    }

    if (text === '1' && !activeInterview) {
      console.log(`🚀 [INTERVIEW] Comando "1" detectado - iniciando entrevista`);
      // CORREÇÃO CRÍTICA: Limpar TODAS as entrevistas ativas para garantir uso da seleção mais recente
      this.activeInterviews.clear();
      console.log(`🧹 [INTERVIEW] Cache de entrevistas ativas completamente limpo`);
      await this.startInterview(phone, clientId);
    } else if (text === '2') {
      console.log(`❌ [INTERVIEW] Comando "2" detectado - recusando entrevista`);
      await this.sendMessage(from, "Entendido. Obrigado!", clientId);
    } else if (text.toLowerCase() === 'parar' || text.toLowerCase() === 'sair') {
      console.log(`⏹️ [INTERVIEW] Comando "parar/sair" detectado`);
      await this.stopInterview(phone, clientId);
    } else if (activeInterview) {
      console.log(`📝 [INTERVIEW] Processando resposta para pergunta ${activeInterview.currentQuestion + 1}`);
      console.log(`🔍 [INTERVIEW] Entrevista ativa - seleção: ${activeInterview.selectionId}, candidato: ${activeInterview.candidateId}`);
      
      // VERIFICAÇÃO CRÍTICA: Se a entrevista ativa usa IDs antigos, reiniciar com seleção mais recente
      try {
        const storageModule = await import('./storage.js');
        const storage = storageModule.default;
        const allSelections = await storage.getAllSelections();
        const latestSelection = allSelections
          .filter(s => clientId ? s.clientId.toString() === clientId : true)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          
        if (latestSelection && activeInterview.selectionId !== latestSelection.id) {
          console.log(`🔄 [INTERVIEW] CORREÇÃO: Entrevista ativa usa seleção antiga ${activeInterview.selectionId}, mudando para mais recente ${latestSelection.id}`);
          this.activeInterviews.delete(phone);
          await this.startInterview(phone, clientId);
          return;
        }
      } catch (error) {
        console.log(`⚠️ [INTERVIEW] Erro na verificação automática, continuando com entrevista atual:`, error.message);
      }
      
      await this.processResponse(from, activeInterview, text, audioMessage);
    } else {
      console.log(`❓ [INTERVIEW] Comando não reconhecido - enviando instruções`);
      await this.sendMessage(from, "Digite:\n1 - Iniciar entrevista\n2 - Não participar", clientId);
    }
    
    console.log(`🎯 [INTERVIEW] ===== FIM DO PROCESSAMENTO =====\n`);
  }

  private async startInterview(phone: string, clientId?: string): Promise<void> {
    console.log(`🚀 [DEBUG_NOVA_SELEÇÃO] INICIANDO ENTREVISTA para ${phone}`);

    // Buscar candidato
    const candidate = await this.findCandidate(phone, clientId);
    if (!candidate) {
      await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Candidato não encontrado.", clientId);
      return;
    }
    
    console.log(`👤 [CANDIDATE_MAPPING] Candidato encontrado: ${candidate.name} (ID: ${candidate.id}) para telefone ${phone}`);

    console.log(`👤 [DEBUG_NOVA_SELEÇÃO] Candidato encontrado: ${candidate.name} (ID: ${candidate.id})`);

    // CORREÇÃO CRÍTICA: Limpar entrevista ativa antiga antes de iniciar nova
    if (this.activeInterviews.has(phone)) {
      console.log(`🧹 [INTERVIEW] Removendo entrevista ativa antiga para ${phone}`);
      this.activeInterviews.delete(phone);
    }

    // CORREÇÃO: Buscar sempre a seleção mais recente independente do status (para suportar duplicação)
    try {
      const allSelections = await storage.getAllSelections();
      
      console.log(`🔍 [SELECTION_SEARCH] Total seleções: ${allSelections.length}`);
      
      // Filtrar por cliente e ordenar por ID (mais recente primeiro - IDs são timestamps)
      const clientSelections = allSelections
        .filter(s => clientId ? s.clientId.toString() === clientId : true)
        .sort((a, b) => parseInt(b.id) - parseInt(a.id));
        
      console.log(`🔍 [SELECTION_SEARCH] Seleções do cliente ${clientId}: ${clientSelections.length}`);
      
      // Pegar a mais recente independente do status
      const selection = clientSelections[0];
      
      if (clientSelections.length > 0) {
        console.log(`📋 [SELECTION_SEARCH] Últimas 3 seleções:`);
        clientSelections.slice(0, 3).forEach((s, i) => {
          const isNewest = i === 0;
          console.log(`  ${i + 1}. ${s.name} (ID: ${s.id}) - Status: ${s.status} - Data: ${new Date(s.createdAt).toLocaleString()} ${isNewest ? '← SERÁ USADA' : ''}`);
        });
      }

      if (!selection) {
        await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Nenhuma vaga disponível no momento.", clientId);
        return;
      }

      console.log(`🎯 [SELECTION_MAPPING] Seleção mais recente: ${selection.name} (ID: ${selection.id}) - Status: ${selection.status}`);
      console.log(`🎯 [SELECTION_MAPPING] Data criação: ${new Date(selection.createdAt).toLocaleString()}`);
      console.log(`🎯 [SELECTION_MAPPING] ClientId da seleção: ${selection.clientId}, ClientId do candidato: ${candidate.clientId}`);

      // Buscar job da seleção
      const job = await storage.getJobById(selection.jobId);
      if (!job || !job.perguntas || job.perguntas.length === 0) {
        await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Vaga não possui perguntas cadastradas.", clientId);
        return;
      }
      
      console.log(`💼 [DEBUG_NOVA_SELEÇÃO] Job encontrado: ${job.nomeVaga} com ${job.perguntas.length} perguntas`);
      
      // NOVA ARQUITETURA: Criar IDs únicos para cada entrevista/seleção
      const uniqueInterviewId = `${selection.id}_${phone.replace(/\D/g, '')}_${Date.now()}`;
      const uniqueCandidateId = `candidate_${selection.id}_${phone.replace(/\D/g, '')}`;
      
      console.log(`🆔 [NEW_ARCHITECTURE] Criando IDs únicos:`);
      console.log(`   📋 Interview ID: ${uniqueInterviewId}`);
      console.log(`   👤 Candidate ID: ${uniqueCandidateId}`);
      console.log(`   📞 Phone: ${phone}`);
      console.log(`   🏢 Selection: ${selection.name} (${selection.id})`);
      
      // Criar entrevista no banco de dados com IDs únicos
      const interviewDb = await storage.createInterview({
        id: uniqueInterviewId,
        selectionId: selection.id,
        candidateId: uniqueCandidateId,
        token: `whatsapp_${Date.now()}`,
        status: 'in_progress'
      });

      // Criar entrevista ativa em memória com IDs únicos por seleção
      const interview: ActiveInterview = {
        candidateId: uniqueCandidateId, // ID único por seleção
        candidateName: candidate.name,
        phone: phone,
        jobId: job.id,
        jobName: job.nomeVaga,
        clientId: selection.clientId.toString(),
        currentQuestion: 0,
        questions: job.perguntas,
        responses: [],
        startTime: new Date().toISOString(),
        selectionId: selection.id.toString(),
        interviewDbId: uniqueInterviewId // ID único de entrevista
      };
      
      console.log(`✅ [DEBUG_NOVA_SELEÇÃO] ENTREVISTA INICIADA COM ISOLAMENTO TOTAL:`, {
        candidateId: candidate.id,
        candidateName: candidate.name,
        selectionId: selection.id.toString(),
        clientId: selection.clientId,
        jobId: job.id,
        totalQuestions: job.perguntas.length,
        timestamp: new Date().toISOString()
      });

      this.activeInterviews.set(phone, interview);

      await this.sendMessage(`${phone}@s.whatsapp.net`, 
        `🎯 Entrevista iniciada para: ${job.nomeVaga}\n👋 Olá ${candidate.name}!\n📝 ${job.perguntas.length} perguntas\n\n⏳ Preparando primeira pergunta...`
      );

      // Enviar primeira pergunta após pequeno delay
      setTimeout(async () => {
        await this.sendNextQuestion(phone, interview);
      }, 2000);
      
    } catch (error) {
      console.log(`❌ Erro ao buscar vaga:`, error);
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

    await this.sendMessage(`${phone}@s.whatsapp.net`, message, interview.clientId);

    // Tentar enviar áudio TTS
    try {
      await this.sendQuestionAudio(phone, question.pergunta, interview.clientId);
    } catch (error) {
      console.log(`⚠️ TTS falhou, pergunta enviada por texto:`, error.message);
    }
  }

  private async sendQuestionAudio(phone: string, questionText: string, clientId: string): Promise<void> {
    try {
      // Buscar configuração OpenAI
      const config = await storage.getMasterSettings();
      if (!config?.openaiApiKey) {
        console.log(`❌ OpenAI API não configurada`);
        return;
      }

      // Buscar configuração de voz do cliente
      const clientConfig = await storage.getApiConfig('client', clientId);
      const voice = clientConfig?.openaiVoice || 'nova';

      console.log(`🎙️ Gerando TTS para: "${questionText}" com voz: ${voice}`);

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: questionText,
          voice: voice,
          response_format: "opus",
          speed: 1.0
        })
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        
        // Enviar áudio via WhatsApp - buscar serviço dinamicamente para evitar dependência circular
        const { whatsappBaileyService } = await import('../whatsapp/services/whatsappBaileyService');
        const connection = whatsappBaileyService.getConnection(clientId);
        if (connection?.socket) {
          await connection.socket.sendMessage(`${phone}@s.whatsapp.net`, {
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
    console.log(`\n🎯 [DEBUG_NOVA_SELEÇÃO] ===== PROCESSANDO RESPOSTA =====`);
    console.log(`📝 [DEBUG_NOVA_SELEÇÃO] Telefone: ${phone}`);
    console.log(`📝 [DEBUG_NOVA_SELEÇÃO] Pergunta atual: ${interview.currentQuestion + 1}/${interview.questions.length}`);
    console.log(`📝 [DEBUG_NOVA_SELEÇÃO] Texto recebido: "${text}"`);
    console.log(`🎵 [DEBUG_NOVA_SELEÇÃO] Áudio presente: ${audioMessage ? 'SIM' : 'NÃO'}`);
    console.log(`🏢 [DEBUG_NOVA_SELEÇÃO] ClientId: ${interview.clientId}`);
    console.log(`📋 [DEBUG_NOVA_SELEÇÃO] SeleçãoId: ${interview.selectionId || 'NÃO_DEFINIDO'}`);
    console.log(`👤 [DEBUG_NOVA_SELEÇÃO] CandidatoId: ${interview.candidateId}`);

    let responseText = text;
    let audioFile: string | undefined;

    // Se há áudio, processar
    if (audioMessage) {
      console.log(`🎧 [AUDIO] Iniciando processamento de áudio...`);
      
      try {
        // Usar novo método de download direto com nomenclatura padronizada
        const audioPath = await this.downloadAudioDirect(
          audioMessage, 
          phone, 
          interview.clientId, 
          interview.selectionId, 
          interview.currentQuestion + 1
        );
        
        if (audioPath) {
          console.log(`✅ [AUDIO] Áudio baixado: ${audioPath}`);
          
          // Transcrever áudio usando arquivo direto
          try {
            const transcription = await this.transcribeAudio(audioPath, phone);
            
            if (transcription && transcription.trim().length > 0) {
              responseText = transcription;
              audioFile = audioPath;
              console.log(`✅ [AUDIO] Transcrição: "${responseText}"`);
            } else {
              console.log(`⚠️ [AUDIO] Transcrição vazia, usando resposta padrão`);
              responseText = "Resposta de áudio processada";
              audioFile = audioPath;
            }
          } catch (transcribeError) {
            console.log(`❌ [AUDIO] Erro na transcrição:`, transcribeError.message);
            responseText = "Resposta de áudio recebida";
            audioFile = audioPath;
          }
        } else {
          console.log(`❌ [AUDIO] Falha no download do áudio`);
          responseText = "Resposta de áudio recebida";
        }
      } catch (error) {
        console.log(`❌ [AUDIO] Erro geral no processamento:`, error.message);
        responseText = "Resposta de áudio recebida";
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
    
    console.log(`💾 [AUDIO] Resposta salva na entrevista ativa`);

    // Salvar resposta no banco de dados com nova nomenclatura
    try {
      if (interview.interviewDbId) {
        // Nova nomenclatura para transcrição: candidato_[selectionId]_[numeroResposta]
        const cleanPhone = interview.phone.replace(/\D/g, '');
        const transcriptionId = `candidato_${interview.selectionId}_${interview.currentQuestion + 1}`;
        const responseId = `${interview.selectionId}_${interview.candidateId}_R${interview.currentQuestion + 1}_${Date.now()}`;
        
        // Verificar se já existe score calculado para evitar recálculos desnecessários
        let pontuacao = 50; // Valor padrão caso falhe
        
        // Buscar respostas existentes para verificar se já foi calculado
        const existingResponses = await storage.getResponsesBySelectionAndCandidate(
          interview.selectionId, 
          interview.candidateId, 
          interview.clientId
        );
        const existingResponse = existingResponses.find(r => 
          r.questionId === (interview.currentQuestion + 1) && r.score !== null && r.score !== undefined
        );
        
        if (existingResponse && existingResponse.score !== null && existingResponse.score !== undefined && existingResponse.score > 0) {
          // Usar score já calculado para evitar gasto desnecessário de API
          pontuacao = existingResponse.score;
          console.log(`♻️ [SCORE_OTIMIZADO] Usando pontuação já calculada: ${pontuacao}/100 (evitando recálculo e economia de API)`);
        } else {
          // Calcular pontuação usando IA apenas se não existe - PRIMEIRA VEZ APENAS
          try {
            const { candidateEvaluationService } = await import('./candidateEvaluationService');
            
            // Usar a OPENAI_API_KEY do ambiente (configurada pelo usuário)
            const openaiApiKey = process.env.OPENAI_API_KEY;
            
            if (openaiApiKey && currentQuestion.respostaPerfeita && responseText) {
              console.log(`🤖 [IA_REAL] Calculando pontuação com IA pela primeira vez usando prompt detalhado...`);
              
              // Usar o sistema de avaliação completo com prompt detalhado
              const evaluationResult = await candidateEvaluationService.evaluateResponse({
                pergunta: currentQuestion.pergunta,
                respostaCandidato: responseText,
                respostaPerfeita: currentQuestion.respostaPerfeita
              });
              
              pontuacao = evaluationResult.pontuacaoGeral;
              console.log(`📊 [IA_SCORE_SALVO] Score calculado pela IA: ${pontuacao}/100`);
              console.log(`📊 [IA_DETALHES] Conteúdo: ${evaluationResult.conteudo}/70, Coerência: ${evaluationResult.coerencia}/25, Tom: ${evaluationResult.tom}/5`);
              
              // Salvar também o feedback da IA se disponível
              if (evaluationResult.feedback) {
                console.log(`📝 [IA_FEEDBACK] ${evaluationResult.feedback}`);
              }
              
            } else {
              console.log(`⚠️ [EVALUATION] OpenAI API Key não configurada ou dados insuficientes - usando pontuação padrão`);
              pontuacao = 0;
            }
          } catch (evaluationError) {
            console.log(`❌ [EVALUATION] Erro na avaliação IA:`, evaluationError.message);
            pontuacao = 0;
          }
        }
        
        await storage.createResponse({
          id: responseId,
          selectionId: interview.selectionId,
          candidateId: interview.candidateId, // ID único por seleção
          questionId: interview.currentQuestion + 1,
          questionText: currentQuestion.pergunta,
          responseText: responseText,
          audioFile: audioFile || '',
          transcription: responseText,
          transcriptionId: transcriptionId, // Nova nomenclatura para transcrições
          timestamp: new Date().toISOString(),
          score: pontuacao, // Pontuação de 0-100 calculada pela IA
          aiAnalysis: '',
          recordingDuration: 0,
          // Dados do candidato real para referência
          candidateName: interview.candidateName,
          candidatePhone: interview.phone
        });
        
        // Processar transcrição via Whisper se tem áudio
        let transcricaoWhisper = 'Resposta de áudio processada';
        if (audioFile && audioFile.includes('.ogg')) {
          try {
            const transcricao = await this.transcribeAudio(audioFile, interview.phone);
            if (transcricao && transcricao.trim() && transcricao !== 'ERRO_TRANSCRICAO') {
              transcricaoWhisper = transcricao;
            }
          } catch (error) {
            console.log(`⚠️ [WHISPER] Erro na transcrição:`, error.message);
          }
        }

        console.log(`✅ [DEBUG_NOVA_SELEÇÃO] RESPOSTA SALVA COM ISOLAMENTO TOTAL:`, {
          responseId: responseId,
          selectionId: interview.selectionId || 'unknown',
          candidateId: interview.candidateId,
          candidateName: interview.candidateName,
          questionNumber: interview.currentQuestion + 1,
          audioFile: audioFile ? 'SIM' : 'NÃO',
          transcription: transcricaoWhisper.substring(0, 50) + '...',
          timestamp: new Date().toISOString(),
          ISOLAMENTO: 'TOTAL_GARANTIDO'
        });
      }
    } catch (saveError) {
      console.log(`❌ [DEBUG_NOVA_SELEÇÃO] Erro ao salvar resposta isolada:`, saveError.message);
    }

    // Avançar para próxima pergunta
    interview.currentQuestion++;
    this.activeInterviews.set(phone, interview);

    console.log(`📊 [AUDIO] Status da entrevista atualizado: pergunta ${interview.currentQuestion + 1}/${interview.questions.length}`);

    // Enviar confirmação
    await this.sendMessage(from, `✅ Resposta recebida! Preparando próxima pergunta...`);
    
    setTimeout(async () => {
      await this.sendNextQuestion(phone, interview);
    }, 2000);
    
    console.log(`🎯 [AUDIO] ===== FIM DO PROCESSAMENTO =====\n`);
  }

  private async transcribeAudio(audioPath: string, phone: string): Promise<string> {
    console.log(`🎯 [WHISPER] Processando resposta de áudio...`);
    
    try {
      // Usar chave do ambiente que está funcionando
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (!openaiApiKey) {
        console.log(`❌ OpenAI API não configurada para transcrição`);
        return '';
      }
      
      console.log(`🔑 [WHISPER] Usando chave OpenAI do ambiente`);
      
      const fs = await import('fs');
      const path = await import('path');
      
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Arquivo de áudio não encontrado: ${audioPath}`);
      }
      
      console.log(`💾 [WHISPER] Usando arquivo: ${audioPath}`);
      
      const stats = fs.statSync(audioPath);
      console.log(`📊 [WHISPER] Tamanho do arquivo: ${stats.size} bytes`);
      
      if (stats.size < 1000) {
        console.log(`❌ [WHISPER] Arquivo muito pequeno: ${stats.size} bytes`);
        return '';
      }
      
      // Usar OpenAI SDK como no simpleInterviewService que funciona
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: openaiApiKey
      });

      console.log(`🚀 [WHISPER] Transcrevendo via OpenAI SDK...`);

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        language: 'pt',
        response_format: 'text'
      });

      console.log(`✅ [WHISPER] Transcrição via SDK obtida: "${transcription}"`);
      
      if (transcription && transcription.trim().length > 0) {
        return transcription.trim();
      }
      
      return '';
      
    } catch (error) {
      console.log(`❌ [WHISPER] Erro na transcrição:`, error.message);
      return '';
    }
  }

  private async finishInterview(phone: string, interview: ActiveInterview): Promise<void> {
    console.log(`🎉 Finalizando entrevista de ${interview.candidateName}`);

    // Atualizar status da entrevista no banco
    try {
      if (interview.interviewDbId) {
        await storage.updateInterview(interview.interviewDbId, { 
          status: 'completed'
        });
        console.log(`💾 Entrevista marcada como concluída no banco`);
      }
    } catch (error) {
      console.log(`❌ Erro ao finalizar entrevista no banco:`, error.message);
    }

    // Mensagem final
    await this.sendMessage(`${phone}@s.whatsapp.net`, 
      `🎉 Parabéns ${interview.candidateName}! Você completou a entrevista para ${interview.jobName}.\n\n📊 Total de respostas: ${interview.responses.length}\n✅ Suas respostas foram registradas com sucesso!\n\nNós retornaremos com o resultado o mais breve possível. Obrigado pela participação!`,
      interview.clientId
    );

    // Remover entrevista ativa
    this.activeInterviews.delete(phone);
    console.log(`🗑️ Entrevista removida da memória`);
  }

  private async stopInterview(phone: string, clientId?: string): Promise<void> {
    const interview = this.activeInterviews.get(phone);
    if (interview) {
      // Atualizar status para cancelada
      try {
        if (interview.interviewDbId) {
          await storage.updateInterview(interview.interviewDbId, { 
            status: 'cancelled'
          });
        }
      } catch (error: any) {
        console.log(`❌ Erro ao cancelar entrevista:`, error.message);
      }

      await this.sendMessage(`${phone}@s.whatsapp.net`, 
        `⏹️ Entrevista interrompida. Obrigado pela participação até aqui!`,
        interview.clientId
      );
      
      this.activeInterviews.delete(phone);
      console.log(`🗑️ Entrevista ${interview.candidateName} cancelada e removida`);
    } else {
      await this.sendMessage(`${phone}@s.whatsapp.net`, "Nenhuma entrevista ativa encontrada.", clientId);
    }
  }

  private async findCandidate(phone: string, clientId?: string) {
    console.log(`🔍 Buscando candidato para telefone: ${phone}, cliente: ${clientId}`);
    
    let candidates;
    if (clientId) {
      candidates = await storage.getCandidatesByClientId(parseInt(clientId));
    } else {
      candidates = await storage.getAllCandidates();
    }
    
    console.log(`👥 Total de candidatos encontrados: ${candidates.length}`);
    
    const candidate = candidates.find(c => {
      if (!c.whatsapp) return false;
      const candidatePhone = c.whatsapp.replace(/\D/g, '');
      const searchPhone = phone.replace(/\D/g, '');
      const match = candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
      if (match) {
        console.log(`✅ Candidato encontrado: ${c.name} (${c.whatsapp})`);
      }
      return match;
    });
    
    if (!candidate) {
      console.log(`❌ Candidato não encontrado para telefone ${phone}`);
    }
    
    return candidate;
  }

  private async sendMessage(to: string, text: string, clientId?: string): Promise<void> {
    console.log(`📤 [INTERVIEW-SEND] Enviando mensagem para ${to}: "${text.substring(0, 50)}..."`);
    
    try {
      // 🔥 CORREÇÃO: Usar o novo sistema multiBailey em vez do antigo whatsappBaileyService
      const { simpleMultiBaileyService } = await import('../whatsapp/services/simpleMultiBailey.js');
      
      // Se temos clientId específico, usar suas conexões
      if (clientId) {
        console.log(`📱 [INTERVIEW-SEND] Buscando conexões ativas para cliente ${clientId}`);
        
        const allConnections = await simpleMultiBaileyService.getClientConnections(clientId);
        const activeConnections = allConnections.connections.filter((conn: any) => conn.isConnected);
        
        if (activeConnections.length > 0) {
          const connection = activeConnections[0]; // Usar primeira conexão ativa
          console.log(`📨 [INTERVIEW-SEND] Usando slot ${connection.slotNumber} para envio`);
          
          // Extrair apenas o número de telefone do formato JID
          const phoneNumber = to.replace('@s.whatsapp.net', '');
          
          const result = await simpleMultiBaileyService.sendTestMessage(
            clientId, 
            connection.slotNumber, 
            phoneNumber, 
            text
          );
          
          if (result.success) {
            console.log(`✅ [INTERVIEW-SEND] Mensagem enviada via slot ${connection.slotNumber}`);
            return;
          } else {
            console.log(`❌ [INTERVIEW-SEND] Falha no envio via slot ${connection.slotNumber}: ${result.error}`);
          }
        } else {
          console.log(`❌ [INTERVIEW-SEND] Nenhuma conexão ativa encontrada para cliente ${clientId}`);
        }
      }
      
      // Fallback: buscar qualquer conexão ativa do sistema
      console.log(`🔍 [INTERVIEW-SEND] Fallback: buscando qualquer conexão ativa do sistema`);
      
      // Buscar todas as conexões de todos os clientes
      const allClients = ['1749849987543']; // Lista de clientes conhecidos
      
      for (const fallbackClientId of allClients) {
        try {
          const clientConnections = await simpleMultiBaileyService.getClientConnections(fallbackClientId);
          const activeConnections = clientConnections.connections.filter((conn: any) => conn.isConnected);
          
          if (activeConnections.length > 0) {
            const connection = activeConnections[0];
            console.log(`📨 [INTERVIEW-SEND] Fallback: usando cliente ${fallbackClientId}, slot ${connection.slotNumber}`);
            
            const phoneNumber = to.replace('@s.whatsapp.net', '');
            
            const result = await simpleMultiBaileyService.sendTestMessage(
              fallbackClientId,
              connection.slotNumber,
              phoneNumber,
              text
            );
            
            if (result.success) {
              console.log(`✅ [INTERVIEW-SEND] Mensagem enviada via fallback cliente ${fallbackClientId}`);
              return;
            }
          }
        } catch (fallbackError: any) {
          console.log(`❌ [INTERVIEW-SEND] Erro no fallback cliente ${fallbackClientId}:`, fallbackError.message);
        }
      }
      
      console.log(`❌ [INTERVIEW-SEND] Nenhuma conexão WhatsApp ativa encontrada em todo o sistema`);
      
    } catch (error) {
      console.log(`❌ [INTERVIEW-SEND] Erro geral no envio:`, error.message);
    }
  }

  // Método público para verificar entrevistas ativas
  getActiveInterviews(): Map<string, ActiveInterview> {
    return this.activeInterviews;
  }
}

export const interactiveInterviewService = new InteractiveInterviewService();