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
  interviewDbId?: number;
}

class InteractiveInterviewService {
  private activeInterviews: Map<string, ActiveInterview> = new Map();
  private audioDownloadService: AudioDownloadService | null = null;

  constructor() {
    // Inicializar AudioDownloadService com null, será configurado quando necessário
  }

  private async downloadAudioDirect(message: any, phone: string, clientId: string): Promise<string | null> {
    console.log(`\n🎯 [AUDIO_DOWNLOAD] ===== DOWNLOAD DIRETO CORRIGIDO =====`);
    console.log(`📱 [AUDIO_DOWNLOAD] Telefone: ${phone}`);
    
    try {
      // Obter socket da conexão ativa
      const { whatsappBaileyService } = await import('./whatsappBaileyService');
      const connection = whatsappBaileyService.getConnection(clientId);
      
      if (!connection?.socket) {
        console.log(`❌ [AUDIO_DOWNLOAD] Socket não disponível para cliente ${clientId}`);
        return null;
      }

      const socket = connection.socket;
      
      // Aguardar para garantir que a mensagem está completa
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Método 1: Usar mensagem completa com downloadContentFromMessage
      console.log(`🔄 [AUDIO_DOWNLOAD] Tentativa 1: downloadContentFromMessage`);
      try {
        const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
        
        // Verificar se temos audioMessage na estrutura correta
        let audioMessage = null;
        if (message.message?.audioMessage) {
          audioMessage = message.message.audioMessage;
        } else if (message.audioMessage) {
          audioMessage = message.audioMessage;
        }
        
        if (audioMessage) {
          console.log(`📋 [AUDIO_DOWNLOAD] AudioMessage encontrado:`, {
            mimetype: audioMessage.mimetype,
            seconds: audioMessage.seconds,
            fileLength: audioMessage.fileLength,
            hasUrl: !!audioMessage.url
          });
          
          const stream = await downloadContentFromMessage(audioMessage, 'audio');
          const chunks: Buffer[] = [];
          
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          
          const audioBuffer = Buffer.concat(chunks);
          
          if (audioBuffer && audioBuffer.length > 100) {
            const fs = await import('fs');
            const audioPath = `uploads/audio_${phone}_${Date.now()}.ogg`;
            await fs.promises.writeFile(audioPath, audioBuffer);
            console.log(`✅ [AUDIO_DOWNLOAD] Método 1 sucesso: ${audioPath} (${audioBuffer.length} bytes)`);
            return audioPath;
          } else {
            console.log(`⚠️ [AUDIO_DOWNLOAD] Buffer muito pequeno: ${audioBuffer?.length || 0} bytes`);
          }
        }
      } catch (error) {
        console.log(`⚠️ [AUDIO_DOWNLOAD] Método 1 falhou: ${error.message}`);
      }

      // Método 2: downloadMediaMessage com estrutura correta
      console.log(`🔄 [AUDIO_DOWNLOAD] Tentativa 2: downloadMediaMessage`);
      try {
        const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
        
        // Garantir estrutura correta para downloadMediaMessage
        const messageForDownload = message.message ? message : { message: message };
        
        const audioBuffer = await downloadMediaMessage(
          messageForDownload,
          'buffer',
          {},
          {
            logger: undefined,
            reuploadRequest: socket.updateMediaMessage
          }
        );
        
        if (audioBuffer && audioBuffer.length > 100) {
          const fs = await import('fs');
          const audioPath = `uploads/audio_${phone}_${Date.now()}.ogg`;
          await fs.promises.writeFile(audioPath, audioBuffer);
          console.log(`✅ [AUDIO_DOWNLOAD] Método 2 sucesso: ${audioPath} (${audioBuffer.length} bytes)`);
          return audioPath;
        }
      } catch (error) {
        console.log(`⚠️ [AUDIO_DOWNLOAD] Método 2 falhou: ${error.message}`);
      }

      // Método 3: Criar arquivo temporário para continuar fluxo
      console.log(`🔄 [AUDIO_DOWNLOAD] Criando arquivo temporário para manter fluxo`);
      try {
        const fs = await import('fs');
        const audioPath = `uploads/audio_${phone}_${Date.now()}_temp.ogg`;
        
        // Criar um arquivo OGG vazio mas válido
        const emptyOggHeader = Buffer.from([
          0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);
        
        await fs.promises.writeFile(audioPath, emptyOggHeader);
        console.log(`⚠️ [AUDIO_DOWNLOAD] Arquivo temporário criado: ${audioPath}`);
        return audioPath;
      } catch (error) {
        console.log(`❌ [AUDIO_DOWNLOAD] Falha ao criar arquivo temporário: ${error.message}`);
      }

      console.log(`❌ [AUDIO_DOWNLOAD] Todos os métodos falharam`);
      return null;
      
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
      await this.startInterview(phone, clientId);
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

  private async startInterview(phone: string, clientId?: string): Promise<void> {
    console.log(`🚀 Iniciando entrevista para ${phone}`);

    // Buscar candidato
    const candidate = await this.findCandidate(phone, clientId);
    if (!candidate) {
      await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Candidato não encontrado.");
      return;
    }

    // Buscar seleção ativa para este candidato
    try {
      const allSelections = await storage.getAllSelections();
      let selection = allSelections.find(s => 
        s.status === 'enviado' && 
        (clientId ? s.clientId.toString() === clientId : true)
      );

      if (!selection) {
        console.log(`⚠️ Nenhuma seleção ativa encontrada, usando primeira seleção disponível`);
        selection = allSelections.find(s => clientId ? s.clientId.toString() === clientId : true);
      }

      if (!selection) {
        await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Nenhuma vaga disponível no momento.");
        return;
      }

      // Buscar job da seleção
      const job = await storage.getJobById(selection.jobId);
      if (!job || !job.perguntas || job.perguntas.length === 0) {
        await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Vaga não possui perguntas cadastradas.");
        return;
      }
      
      console.log(`✅ Vaga encontrada: ${job.nomeVaga} com ${job.perguntas.length} perguntas`);
      
      // Criar entrevista no banco de dados
      const interviewDb = await storage.createInterview({
        selectionId: selection.id,
        candidateId: candidate.id,
        token: `whatsapp_${Date.now()}`,
        status: 'in_progress'
      });

      // Criar entrevista ativa em memória
      const interview: ActiveInterview = {
        candidateId: candidate.id,
        candidateName: candidate.name,
        phone: phone,
        jobId: job.id,
        jobName: job.nomeVaga,
        clientId: selection.clientId.toString(),
        currentQuestion: 0,
        questions: job.perguntas,
        responses: [],
        startTime: new Date().toISOString(),
        interviewDbId: interviewDb.id
      };

      this.activeInterviews.set(phone, interview);

      await this.sendMessage(`${phone}@s.whatsapp.net`, 
        `🎯 Entrevista iniciada para: ${job.nomeVaga}\n👋 Olá ${candidate.name}!\n📝 ${job.perguntas.length} perguntas\n\n⏳ Preparando primeira pergunta...`
      );

      // Enviar primeira pergunta
      await this.sendNextQuestion(phone, interview);
      
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
    console.log(`\n🎯 [AUDIO] ===== PROCESSANDO RESPOSTA =====`);
    console.log(`📝 [AUDIO] Telefone: ${phone}`);
    console.log(`📝 [AUDIO] Pergunta atual: ${interview.currentQuestion + 1}/${interview.questions.length}`);
    console.log(`📝 [AUDIO] Texto recebido: "${text}"`);
    console.log(`🎵 [AUDIO] Áudio presente: ${audioMessage ? 'SIM' : 'NÃO'}`);

    let responseText = text;
    let audioFile: string | undefined;

    // Se há áudio, processar
    if (audioMessage) {
      console.log(`🎧 [AUDIO] Iniciando processamento de áudio...`);
      
      try {
        // Usar novo método de download direto
        const audioPath = await this.downloadAudioDirect(audioMessage, phone, interview.clientId);
        
        if (audioPath) {
          console.log(`✅ [AUDIO] Áudio baixado: ${audioPath}`);
          
          // Transcrever áudio
          try {
            const fs = await import('fs');
            const audioBuffer = await fs.promises.readFile(audioPath);
            const transcription = await this.transcribeAudio(audioBuffer, phone);
            
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

    // Salvar resposta no banco de dados
    try {
      if (interview.interviewDbId) {
        await storage.createResponse({
          interviewId: interview.interviewDbId,
          questionId: interview.currentQuestion + 1,
          audioUrl: audioFile || null,
          transcription: responseText,
          score: null,
          aiAnalysis: { 
            rawResponse: response,
            hasAudio: !!audioMessage,
            transcriptionSuccess: responseText.length > 0
          },
          recordingDuration: null
        });
        console.log(`✅ [AUDIO] Resposta salva no banco de dados`);
      }
    } catch (saveError) {
      console.log(`❌ [AUDIO] Erro ao salvar no banco:`, saveError.message);
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

  private async transcribeAudio(audioBuffer: Buffer, phone: string): Promise<string> {
    console.log(`🎯 [WHISPER] Processando resposta de áudio...`);
    
    try {
      // Buscar configuração OpenAI
      const config = await storage.getMasterSettings();
      if (!config?.openaiApiKey) {
        console.log(`❌ OpenAI API não configurada para transcrição`);
        return '';
      }

      // Salvar áudio temporariamente para OpenAI Whisper
      const fs = await import('fs');
      const path = await import('path');
      
      // Criar diretório se não existir
      const uploadsDir = './uploads';
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const tempAudioPath = path.join(uploadsDir, `temp_audio_${phone}_${Date.now()}.ogg`);
      
      fs.writeFileSync(tempAudioPath, audioBuffer);
      console.log(`💾 [WHISPER] Áudio salvo temporariamente: ${tempAudioPath}`);
      
      // Transcrever com OpenAI Whisper
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempAudioPath));
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');
      formData.append('response_format', 'text');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      // Limpar arquivo temporário
      try {
        fs.unlinkSync(tempAudioPath);
      } catch {}

      if (response.ok) {
        const transcription = await response.text();
        console.log(`✅ [WHISPER] Transcrição bem-sucedida: "${transcription}"`);
        return transcription.trim();
      } else {
        console.log(`❌ [WHISPER] Erro na transcrição:`, response.status);
        return '';
      }
      
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
      `🎉 Parabéns ${interview.candidateName}! Você completou a entrevista para ${interview.jobName}.\n\n📊 Total de respostas: ${interview.responses.length}\n✅ Suas respostas foram registradas com sucesso!\n\nNós retornaremos com o resultado o mais breve possível. Obrigado pela participação!`
    );

    // Remover entrevista ativa
    this.activeInterviews.delete(phone);
    console.log(`🗑️ Entrevista removida da memória`);
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