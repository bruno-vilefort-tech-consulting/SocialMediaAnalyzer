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
      
      const { whatsappBaileyService } = await import('./whatsappBaileyService');
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
        hasKey: !!audioMessage.key,
        isFixed: !!audioMessage._audioFixed
      });
    }

    const activeInterview = this.activeInterviews.get(phone);
    console.log(`📋 [INTERVIEW] Entrevista ativa: ${activeInterview ? 'SIM' : 'NÃO'}`);
    
    if (activeInterview) {
      console.log(`📊 [INTERVIEW] Status da entrevista: pergunta ${activeInterview.currentQuestion + 1}/${activeInterview.questions.length}`);
    }

    // Comando 1: Iniciar entrevista
    if (text === '1' && !activeInterview) {
      console.log(`🚀 [INTERVIEW] Comando "1" detectado - iniciando entrevista`);
      this.activeInterviews.clear();
      console.log(`🧹 [INTERVIEW] Cache de entrevistas ativas completamente limpo`);
      await this.startInterview(phone, clientId);
      return;
    } 
    
    // Comando 2: Recusar entrevista
    if (text === '2') {
      console.log(`❌ [INTERVIEW] Comando "2" detectado - recusando entrevista`);
      await this.sendMessage(from, "Entendido. Obrigado!");
      return;
    } 
    
    // Comandos de parada
    if (text.toLowerCase() === 'parar' || text.toLowerCase() === 'sair') {
      console.log(`⏹️ [INTERVIEW] Comando "parar/sair" detectado`);
      await this.stopInterview(phone);
      return;
    }
    
    // Processamento de resposta durante entrevista ativa
    if (activeInterview) {
      console.log(`📝 [INTERVIEW] Processando resposta para pergunta ${activeInterview.currentQuestion + 1}`);
      console.log(`🔍 [INTERVIEW] Entrevista ativa - seleção: ${activeInterview.selectionId}, candidato: ${activeInterview.candidateId}`);
      
      // VALIDAÇÃO CRÍTICA: Apenas respostas de áudio são aceitas durante entrevista
      if (!audioMessage) {
        console.log(`❌ [INTERVIEW] Resposta apenas texto rejeitada - exigindo áudio`);
        await this.sendMessage(from, "Por gentileza, responda por áudio 🎤\n\nMantendo microfone pressionado enquanto fala.");
        return;
      }
      
      // Verificar se entrevista usa seleção mais recente
      try {
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
      // Instruções quando não há entrevista ativa
      console.log(`❓ [INTERVIEW] Comando não reconhecido - enviando instruções`);
      await this.sendMessage(from, "Para participar da entrevista:\n\n1 - Sim, quero participar\n2 - Não, obrigado");
    }
    
    console.log(`🎯 [INTERVIEW] ===== FIM DO PROCESSAMENTO =====\n`);
  }

  private async startInterview(phone: string, clientId?: string): Promise<void> {
    console.log(`🚀 [DEBUG_NOVA_SELEÇÃO] INICIANDO ENTREVISTA para ${phone}`);

    // Buscar candidato
    const candidate = await this.findCandidate(phone, clientId);
    if (!candidate) {
      await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Candidato não encontrado.");
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
        await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Nenhuma vaga disponível no momento.");
        return;
      }

      console.log(`🎯 [SELECTION_MAPPING] Seleção mais recente: ${selection.name} (ID: ${selection.id}) - Status: ${selection.status}`);
      console.log(`🎯 [SELECTION_MAPPING] Data criação: ${new Date(selection.createdAt).toLocaleString()}`);
      console.log(`🎯 [SELECTION_MAPPING] ClientId da seleção: ${selection.clientId}, ClientId do candidato: ${candidate.clientId}`);

      // Buscar job da seleção
      const job = await storage.getJobById(selection.jobId);
      if (!job || !job.perguntas || job.perguntas.length === 0) {
        await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Vaga não possui perguntas cadastradas.");
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

    await this.sendMessage(`${phone}@s.whatsapp.net`, message);

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
        const { whatsappBaileyService } = await import('./whatsappBaileyService');
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
    console.log(`\n🎯 [RESPONSE] ===== PROCESSANDO RESPOSTA =====`);
    console.log(`📝 [RESPONSE] Telefone: ${phone}`);
    console.log(`📝 [RESPONSE] Pergunta atual: ${interview.currentQuestion + 1}/${interview.questions.length}`);
    console.log(`📝 [RESPONSE] Texto recebido: "${text}"`);
    console.log(`🎵 [RESPONSE] Áudio presente: ${audioMessage ? 'SIM' : 'NÃO'}`);
    console.log(`🏢 [RESPONSE] ClientId: ${interview.clientId}`);
    console.log(`📋 [RESPONSE] SeleçãoId: ${interview.selectionId || 'NÃO_DEFINIDO'}`);
    console.log(`👤 [RESPONSE] CandidatoId: ${interview.candidateId}`);

    let responseText = text || "Resposta de áudio";
    let audioFile: string | undefined;
    let transcriptionSuccess = false;

    // Processar áudio se presente
    if (audioMessage) {
      console.log(`🎧 [AUDIO] Iniciando processamento de áudio...`);
      
      // Verificar se o áudio já foi processado pelo Baileys
      if (audioMessage._audioFixed && audioMessage._audioPath) {
        console.log(`✅ [AUDIO] Usando áudio já processado: ${audioMessage._audioPath}`);
        audioFile = audioMessage._audioPath;
        
        // Transcrever usando arquivo já salvo
        try {
          const transcription = await this.transcribeAudio(audioMessage._audioPath, phone);
          if (transcription && transcription.trim().length > 0) {
            responseText = transcription;
            transcriptionSuccess = true;
            console.log(`✅ [AUDIO] Transcrição bem-sucedida: "${responseText.substring(0, 100)}..."`);
          }
        } catch (transcribeError) {
          console.log(`❌ [AUDIO] Erro na transcrição:`, transcribeError.message);
        }
      } else {
        // Usar método de download direto
        try {
          const audioPath = await this.downloadAudioDirect(
            audioMessage, 
            phone, 
            interview.clientId, 
            interview.selectionId, 
            interview.currentQuestion + 1
          );
          
          if (audioPath) {
            console.log(`✅ [AUDIO] Áudio baixado: ${audioPath}`);
            audioFile = audioPath;
            
            // Transcrever áudio
            try {
              const transcription = await this.transcribeAudio(audioPath, phone);
              if (transcription && transcription.trim().length > 0) {
                responseText = transcription;
                transcriptionSuccess = true;
                console.log(`✅ [AUDIO] Transcrição: "${responseText.substring(0, 100)}..."`);
              }
            } catch (transcribeError) {
              console.log(`❌ [AUDIO] Erro na transcrição:`, transcribeError.message);
            }
          }
        } catch (error) {
          console.log(`❌ [AUDIO] Erro no processamento:`, error.message);
        }
      }
      
      // Garantir que sempre temos um arquivo de áudio salvo
      if (!audioFile) {
        console.log(`⚠️ [AUDIO] Áudio não foi salvo, criando resposta padrão`);
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
    console.log(`🎯 [WHISPER] Processando transcrição de áudio...`);
    
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (!openaiApiKey) {
        console.log(`❌ [WHISPER] OpenAI API Key não configurada`);
        return '';
      }
      
      const fs = await import('fs');
      
      if (!fs.existsSync(audioPath)) {
        console.log(`❌ [WHISPER] Arquivo não encontrado: ${audioPath}`);
        return '';
      }
      
      const stats = fs.statSync(audioPath);
      console.log(`📊 [WHISPER] Arquivo: ${audioPath} (${stats.size} bytes)`);
      
      if (stats.size < 500) {
        console.log(`❌ [WHISPER] Arquivo muito pequeno para transcrição`);
        return '';
      }
      
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: openaiApiKey });

      console.log(`🚀 [WHISPER] Iniciando transcrição...`);

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        language: 'pt',
        response_format: 'text'
      });

      if (transcription && transcription.trim().length > 0) {
        const cleanTranscription = transcription.trim();
        console.log(`✅ [WHISPER] Transcrição concluída: "${cleanTranscription.substring(0, 100)}..."`);
        return cleanTranscription;
      }
      
      console.log(`⚠️ [WHISPER] Transcrição vazia retornada`);
      return '';
      
    } catch (error: any) {
      console.log(`❌ [WHISPER] Erro na transcrição: ${error?.message || error}`);
      return '';
    }
  }

  private async finishInterview(phone: string, interview: ActiveInterview): Promise<void> {
    console.log(`🎉 [FINISH] Finalizando entrevista de ${interview.candidateName} para cliente ${interview.clientId}`);

    // Salvar todas as respostas com isolamento por cliente
    try {
      console.log(`💾 [FINISH] Salvando ${interview.responses.length} respostas com clientId ${interview.clientId}`);
      
      // Salvar respostas da entrevista com isolamento por cliente
      await storage.saveInterviewResults(interview.selectionId, interview.candidateId, interview.responses);
      
      // Atualizar status da entrevista no banco se existir ID
      if (interview.interviewDbId) {
        await storage.updateInterview(interview.interviewDbId, { 
          status: 'completed',
          completedAt: new Date(),
          totalScore: null // Será calculado pela IA posteriormente
        });
        console.log(`✅ [FINISH] Entrevista ${interview.interviewDbId} marcada como concluída`);
      }
      
      // Criar relatório automático para preservar dados
      try {
        const reportId = `report_${interview.selectionId}_${Date.now()}`;
        const reportData = {
          id: reportId,
          selectionId: interview.selectionId,
          clientId: interview.clientId,
          createdAt: new Date(),
          jobData: { 
            id: interview.jobId, 
            name: interview.jobName 
          },
          candidatesData: [{
            id: interview.candidateId,
            name: interview.candidateName,
            phone: interview.phone,
            responses: interview.responses,
            completedAt: new Date().toISOString()
          }],
          responseData: interview.responses
        };
        
        await storage.createReport(reportData);
        console.log(`📊 [FINISH] Relatório automático criado: ${reportId} para cliente ${interview.clientId}`);
      } catch (reportError: any) {
        console.log(`⚠️ [FINISH] Aviso: Erro ao criar relatório automático: ${reportError?.message}`);
      }
      
    } catch (error: any) {
      console.log(`❌ [FINISH] Erro crítico ao salvar entrevista: ${error?.message || error}`);
    }

    // Mensagem final com isolamento por cliente
    await this.sendMessage(`${phone}@s.whatsapp.net`, 
      `🎉 Parabéns ${interview.candidateName}!\n\nVocê completou a entrevista para: ${interview.jobName}\n\n📊 Total de respostas: ${interview.responses.length}\n✅ Suas respostas foram registradas com sucesso!\n\nRetornaremos com o resultado em breve. Obrigado pela participação!`
    );

    // Remover entrevista ativa
    this.activeInterviews.delete(phone);
    console.log(`🗑️ [FINISH] Entrevista ${interview.candidateName} removida da memória - cliente ${interview.clientId}`);
  }

  private async stopInterview(phone: string): Promise<void> {
    const interview = this.activeInterviews.get(phone);
    if (interview) {
      // Atualizar status para cancelada
      try {
        if (interview.interviewDbId) {
          await storage.updateInterview(interview.interviewDbId, { 
            status: 'cancelled'
          });
        }
      } catch (error) {
        console.log(`❌ Erro ao cancelar entrevista:`, error.message);
      }

      await this.sendMessage(`${phone}@s.whatsapp.net`, 
        `⏹️ Entrevista interrompida. Obrigado pela participação até aqui!`
      );
      
      this.activeInterviews.delete(phone);
      console.log(`🗑️ Entrevista ${interview.candidateName} cancelada e removida`);
    } else {
      await this.sendMessage(`${phone}@s.whatsapp.net`, "Nenhuma entrevista ativa encontrada.");
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

  private async sendMessage(to: string, text: string): Promise<void> {
    console.log(`📤 Enviando mensagem para ${to}: "${text.substring(0, 50)}..."`);
    
    // Buscar conexão ativa para qualquer cliente que possa enviar a mensagem - importação dinâmica
    const { whatsappBaileyService } = await import('./whatsappBaileyService');
    const connections = whatsappBaileyService.getAllConnections();
    
    for (const [clientId, connection] of connections) {
      if (connection.isConnected && connection.socket) {
        try {
          await connection.socket.sendMessage(to, { text });
          console.log(`✅ Mensagem enviada via cliente ${clientId}`);
          return;
        } catch (error) {
          console.log(`❌ Erro ao enviar via cliente ${clientId}:`, error.message);
        }
      }
    }
    
    console.log(`❌ Nenhuma conexão WhatsApp ativa encontrada para enviar mensagem`);
  }

  // Método público para verificar entrevistas ativas
  getActiveInterviews(): Map<string, ActiveInterview> {
    return this.activeInterviews;
  }
}

export const interactiveInterviewService = new InteractiveInterviewService();