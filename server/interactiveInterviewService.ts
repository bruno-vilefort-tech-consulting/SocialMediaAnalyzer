import { storage } from './storage';
import { userIsolatedRoundRobin } from '../whatsapp/services/userIsolatedRoundRobin';

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

  constructor() {}
  
  /**
   * 🔍 MÉTODO DE DETECÇÃO ROBUSTA DE CLIENTE
   * Detecta o clientId correto baseado no telefone do candidato
   * PRIORIZA O ISOLAMENTO POR CLIENTE - busca apenas no escopo do cliente logado
   */
  private async detectClientIdRobust(phone: string, clientId?: string): Promise<string | null> {
    // Se clientId fornecido for válido, usar esse E buscar apenas candidatos desse cliente
    if (clientId && clientId !== 'undefined' && clientId !== 'null') {
      try {
        // 🔒 ISOLAMENTO: Buscar candidatos APENAS do cliente logado
        const clientCandidates = await storage.getCandidatesByClientId(parseInt(clientId));
        
        // Limpar telefone para comparação (apenas números)
        const cleanPhone = phone.replace(/\D/g, '');
        
        // Buscar candidato correspondente no escopo do cliente
        const matchingCandidate = clientCandidates.find(candidate => {
          const candidatePhone = candidate.whatsapp?.replace(/\D/g, '') || '';
          return candidatePhone === cleanPhone;
        });
        
        // Se encontrou candidato no cliente logado, confirmar o clientId
        if (matchingCandidate) {
          return clientId;
        } else {
          // Candidato não pertence a este cliente - violação de isolamento
          console.log(`⚠️ Telefone ${phone} não encontrado no cliente ${clientId} - isolamento respeitado`);
          return null;
        }
        
      } catch (error) {
        console.error(`❌ Erro ao buscar candidatos do cliente ${clientId}:`, error);
        return null;
      }
    }
  }

  /**
   * ✅ MÉTODO DE VALIDAÇÃO COMPLETA COM ISOLAMENTO POR USUÁRIO
   * Valida se o cliente está apto para receber cadência usando conexões isoladas
   */
  private async validateClientForCadence(clientId: string, phone: string): Promise<boolean> {
    try {
      // VALIDAÇÃO 1: Verificar conexões WhatsApp ativas ISOLADAS por usuário
      // 🔒 ISOLAMENTO: Usar userIsolatedRoundRobin para garantir que apenas 
      //    conexões do usuário logado sejam verificadas
      
      // Mapear clientId para userId (neste sistema, clientId é o userId)
      const userId = clientId;
      
      // Inicializar slots do usuário se necessário
      await userIsolatedRoundRobin.initializeUserSlots(userId, clientId);
      
      // Verificar se usuário tem slots ativos (conexões WhatsApp funcionais)
      const activeSlots = userIsolatedRoundRobin.getUserActiveSlots(userId);
      
      if (activeSlots.length === 0) {
        console.log(`❌ Cliente ${clientId} não possui conexões WhatsApp ativas isoladas`);
        return false;
      }
      
      // Obter estatísticas isoladas do usuário
      const userStats = userIsolatedRoundRobin.getUserStats(userId);
      
      if (userStats.activeSlots === 0) {
        console.log(`❌ Cliente ${clientId} - slots ativos: ${userStats.activeSlots}`);
        return false;
      }
      
      console.log(`✅ Cliente ${clientId} - ${userStats.activeSlots} conexões ativas isoladas`);
      
      // VALIDAÇÃO 2: Verificar se candidato existe na base do cliente (isolamento por cliente)
      const candidatesByClient = await storage.getCandidatesByClientId(parseInt(clientId));
      
      const cleanPhone = phone.replace(/\D/g, '');
      const candidateExists = candidatesByClient.some(candidate => {
        const candidatePhone = candidate.whatsapp?.replace(/\D/g, '') || '';
        return candidatePhone === cleanPhone;
      });
      
      if (!candidateExists) {
        console.log(`❌ Candidato ${phone} não encontrado na base do cliente ${clientId}`);
        return false;
      }
      
      // VALIDAÇÃO 3: Verificar se telefone confere exatamente
      const matchingCandidate = candidatesByClient.find(candidate => {
        const candidatePhone = candidate.whatsapp?.replace(/\D/g, '') || '';
        return candidatePhone === cleanPhone;
      });
      
      if (!matchingCandidate) {
        console.log(`❌ Telefone ${phone} não confere exatamente no cliente ${clientId}`);
        return false;
      }
      
      // VALIDAÇÃO 4: Verificar isolamento entre usuários
      const isIsolated = userIsolatedRoundRobin.validateUserIsolation();
      
      if (!isIsolated) {
        console.log(`⚠️ Violação de isolamento detectada - cadência suspensa por segurança`);
        return false;
      }
      
      console.log(`✅ Todas as validações passaram para cliente ${clientId}, telefone ${phone}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erro na validação de cadência para cliente ${clientId}:`, error);
      return false;
    }
  }

  /**
   * 🔥 CRÍTICO: Ativar cadência imediata com isolamento por usuário
   * Esta função é chamada quando um contato responde "1"
   */
  private async activateUserImmediateCadence(phone: string, clientId?: string): Promise<void> {
    // 🔍 ETAPA 1: DETECÇÃO ROBUSTA DE CLIENTE
    const detectedClientId = await this.detectClientIdRobust(phone, clientId);
    
    if (!detectedClientId) {
      return;
    }
    
    // ✅ ETAPA 2: VALIDAÇÃO COMPLETA
    const isValid = await this.validateClientForCadence(detectedClientId, phone);
    
    if (!isValid) {
      return;
    }

    try {
      // Mapear clientId para userId (neste sistema, clientId é o userId)
      const userId = detectedClientId;
      
      // 🔥 ETAPA 3: Inicializar slots se necessário
      await userIsolatedRoundRobin.initializeUserSlots(userId, detectedClientId);
      
      // 🔥 ETAPA 4: Configurar cadência imediata para o usuário
      userIsolatedRoundRobin.setUserCadenceConfig(userId, {
        userId,
        baseDelay: 500, // Delay reduzido para resposta "1"
        batchSize: 1, // Envios individuais
        maxRetries: 3,
        adaptiveMode: false, // Modo fixo para resposta imediata
        immediateMode: true // Modo imediato ativado
      });
      
      // 🔥 ETAPA 5: Distribuir apenas o candidato que respondeu "1"
      await userIsolatedRoundRobin.distributeUserCandidates(userId, detectedClientId, [phone], 'immediate');
      
      // 🔥 ETAPA 6: Ativar cadência imediata específica do usuário
      await userIsolatedRoundRobin.activateImmediateCadence(userId, detectedClientId, phone);
      
      // 🔥 ETAPA 7: Validar isolamento entre usuários
      const isIsolated = userIsolatedRoundRobin.validateUserIsolation();
      
      // 🔥 ETAPA 8: Aguardar 1 segundo e processar cadência garantindo execução
      setTimeout(async () => {
        try {
          await userIsolatedRoundRobin.processUserCadence(userId, detectedClientId);
        } catch (error) {
        }
      }, 1000);
      
    } catch (error) {
    }
  }



  private async downloadAudioDirect(message: any, phone: string, clientId: string, selectionId: string, questionNumber: number): Promise<string | null> {
    try {
      const { UPLOADS_DIR } = await import('../src/config/paths');
      const path = await import('path');
      
      const cleanPhone = phone.replace(/\D/g, '');
      // Nova nomenclatura: audio_[whatsapp]_[selectionId]_R[numero].ogg
      const audioFileName = `audio_${cleanPhone}_${selectionId}_R${questionNumber}.ogg`;
      const audioPath = path.join(UPLOADS_DIR, audioFileName);
      
      // Verificar se arquivo já existe e tem tamanho válido (> 1KB)
      const fs = await import('fs');
      try {
        const stats = await fs.promises.stat(audioPath);
        if (stats.size > 1024) {
          return audioPath;
        } else {
          // Remove arquivo pequeno para forçar novo download
          await fs.promises.unlink(audioPath).catch(() => {});
        }
      } catch {
        // Arquivo não existe, continuar com download
      }
      
      let audioBuffer: Buffer | null = null;
      
      // MÉTODO 1: Tentar usar buffer já processado (se disponível)
      if (message._audioBuffer && message._audioBuffer.length > 1024) {
        audioBuffer = message._audioBuffer;
      }
      
      // MÉTODO 2: Download direto via Baileys (método mais confiável)
      if (!audioBuffer && message.message?.audioMessage) {
        try {
          // 🔒 ISOLAMENTO: Buscar conexão ativa usando slots isolados do usuário
          const userId = clientId; // Mapear clientId para userId
          
          // Inicializar slots isolados do usuário
          await userIsolatedRoundRobin.initializeUserSlots(userId, clientId);
          const activeSlots = userIsolatedRoundRobin.getUserActiveSlots(userId);
          
          let activeSocket = null;
          
          if (activeSlots.length > 0) {
            // Usar slots isolados do usuário em vez de busca genérica
            const { simpleMultiBaileyService } = await import('../whatsapp/services/simpleMultiBailey');
            
            for (const userSlot of activeSlots) {
              try {
                const connectionStatus = await simpleMultiBaileyService.getConnectionStatus(clientId, userSlot.slotNumber);
                if (connectionStatus.isConnected) {
                  const connectionId = `${clientId}_slot_${userSlot.slotNumber}`;
                  const connections = (simpleMultiBaileyService as any).connections;
                  const connection = connections.get(connectionId);
                  if (connection?.socket) {
                    activeSocket = connection.socket;
                    console.log(`🔒 Usando socket isolado slot ${userSlot.slotNumber} do usuário ${userId}`);
                    break;
                  }
                }
              } catch (slotError: any) {
                continue; // Tentar próximo slot isolado
              }
            }
          } else {
            console.log(`⚠️ Nenhum slot isolado ativo para usuário ${userId}, tentando fallback`);
            
            // Fallback: busca tradicional apenas para este cliente específico
            const { simpleMultiBaileyService } = await import('../whatsapp/services/simpleMultiBailey');
            
            for (let slot = 1; slot <= 3; slot++) {
              try {
                const connectionStatus = await simpleMultiBaileyService.getConnectionStatus(clientId, slot);
                if (connectionStatus.isConnected) {
                  const connectionId = `${clientId}_slot_${slot}`;
                  const connections = (simpleMultiBaileyService as any).connections;
                  const connection = connections.get(connectionId);
                  if (connection?.socket) {
                    activeSocket = connection.socket;
                    break;
                  }
                }
              } catch (slotError: any) {
                continue;
              }
            }
          }
          
          if (activeSocket) {
            const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
            
            const stream = await downloadContentFromMessage(message.message.audioMessage, 'audio');
            
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
            
            audioBuffer = Buffer.concat(chunks);
            
            if (audioBuffer && audioBuffer.length <= 1024) {
              audioBuffer = null;
            }
          }
        } catch (baileyError: any) {
        }
      }
      
      // MÉTODO 3: Tentar via outros serviços WhatsApp disponíveis
      if (!audioBuffer) {
        try {
          const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
          
          audioBuffer = await downloadMediaMessage(
            message,
            'buffer',
            {}
          );
          
          if (audioBuffer && audioBuffer.length <= 1024) {
            audioBuffer = null;
          }
        } catch (qrError: any) {
        }
      }
      
      // Salvar o áudio se foi baixado com sucesso
      if (audioBuffer && audioBuffer.length > 1024) {
        
        await fs.promises.writeFile(audioPath, audioBuffer);
        
        // Verificar se arquivo foi realmente salvo
        const verifyStats = await fs.promises.stat(audioPath);
        
        return audioPath;
      } else {
        // Como último recurso, criar um arquivo de placeholder válido OGG 
        // mas marcar claramente que precisa ser re-processado
        const oggHeader = Buffer.from([
          0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);
        
        // Criar comentário indicando que é placeholder
        const placeholderComment = Buffer.from(`PLACEHOLDER_AUDIO_NEEDS_REDOWNLOAD_${Date.now()}`, 'utf8');
        const placeholderBuffer = Buffer.concat([oggHeader, placeholderComment]);
        
        await fs.promises.writeFile(audioPath, placeholderBuffer);
        
        // Retornar caminho mesmo para placeholder para não quebrar o fluxo
        return audioPath;
      }
      
    } catch (error: any) {
      return null;
    }
  }

  async handleMessage(from: string, text: string, audioMessage?: any, clientId?: string): Promise<void> {
    const phone = from.replace('@s.whatsapp.net', '');
    
    // 🔒 ISOLAMENTO CORRIGIDO: Usar o método detectClientIdRobust para determinar cliente
    // Se clientId não fornecido, detectar automaticamente respeitando isolamento
    if (!clientId) {
      clientId = await this.detectClientIdRobust(phone);
      
      if (!clientId) {
        console.log(`⚠️ ClientId não detectado para telefone ${phone} - mensagem ignorada para manter isolamento`);
        return; // Não processar mensagens sem contexto de cliente válido
      }
    } else {
      // Se clientId foi fornecido, validar se o telefone pertence a esse cliente
      const validatedClientId = await this.detectClientIdRobust(phone, clientId);
      
      if (!validatedClientId) {
        console.log(`⚠️ Telefone ${phone} não pertence ao cliente ${clientId} - isolamento respeitado`);
        return; // Não processar violações de isolamento
      }
      
      clientId = validatedClientId;
    }
    
    if (audioMessage) {
      // Verificar se é mensagem completa do Baileys ou apenas audioMessage
      // const audioData = audioMessage.message?.audioMessage || audioMessage;
    }

    const activeInterview = this.activeInterviews.get(phone);
    
    if (text === '1' && !activeInterview) {
      // 🔥 CRÍTICO: Ativar cadência imediata com isolamento por usuário
      await this.activateUserImmediateCadence(phone, clientId);
      
      // CORREÇÃO CRÍTICA: Limpar TODAS as entrevistas ativas para garantir uso da seleção mais recente
      this.activeInterviews.clear();
      await this.startInterview(phone, clientId);
    } else if (text === '2') {
      await this.sendMessage(from, "Entendido. Obrigado!", clientId);
    } else if (text.toLowerCase() === 'parar' || text.toLowerCase() === 'sair') {
      await this.stopInterview(phone, clientId);
    } else if (activeInterview && text !== '1') {
      
      // 🔥 CORREÇÃO CRÍTICA: Verificar se entrevista está em estado válido
      if (activeInterview.currentQuestion >= activeInterview.questions.length) {
        this.activeInterviews.delete(phone);
        return;
      }
      
      // VERIFICAÇÃO CRÍTICA: Se a entrevista ativa usa IDs antigos, reiniciar com seleção mais recente
      try {
        const { storage } = await import('./storage.js');
        const allSelections = await storage.getAllSelections();
        const latestSelection = allSelections
          .filter(s => clientId ? s.clientId.toString() === clientId : true)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          
        // 🔥 CORREÇÃO CRÍTICA: Tornar mais restritiva - apenas se entrevista for de mais de 1 hora atrás
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const interviewStartTime = new Date(activeInterview.startTime).getTime();
        
        if (latestSelection && parseInt(activeInterview.selectionId) !== parseInt(latestSelection.id.toString()) && interviewStartTime < oneHourAgo) {
          this.activeInterviews.delete(phone);
          await this.startInterview(phone, clientId);
          return;
        }
      } catch (error) {
      }
      
      await this.processResponse(from, activeInterview, text, audioMessage);
    } else {
      await this.sendMessage(from, "Digite:\n1 - Iniciar entrevista\n2 - Não participar", clientId);
    }
  }

  private async startInterview(phone: string, clientId?: string): Promise<void> {
    // Buscar candidato
    const candidate = await this.findCandidate(phone, clientId);
    if (!candidate) {
      await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Candidato não encontrado.", clientId);
      return;
    }

    // CORREÇÃO CRÍTICA: Limpar entrevista ativa antiga antes de iniciar nova
    if (this.activeInterviews.has(phone)) {
      this.activeInterviews.delete(phone);
    }

    // CORREÇÃO: Buscar sempre a seleção mais recente independente do status (para suportar duplicação)
    try {
      const allSelections = await storage.getAllSelections();
      
      // Filtrar por cliente e ordenar por ID (mais recente primeiro - IDs são timestamps)
      const clientSelections = allSelections
        .filter(s => clientId ? s.clientId.toString() === clientId : true)
        .sort((a, b) => parseInt(b.id.toString()) - parseInt(a.id.toString()));
      
      // Pegar a mais recente independente do status
      const selection = clientSelections[0];

      if (!selection) {
        await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Nenhuma vaga disponível no momento.", clientId);
        return;
      }

      // Buscar job da seleção
      const job = await storage.getJobById(selection.jobId);
      if (!job || !job.perguntas || job.perguntas.length === 0) {
        await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Vaga não possui perguntas cadastradas.", clientId);
        return;
      }
      
      // NOVA ARQUITETURA: Criar IDs únicos para cada entrevista/seleção
      const uniqueInterviewId = `${selection.id}_${phone.replace(/\D/g, '')}_${Date.now()}`;
      const uniqueCandidateId = `candidate_${selection.id}_${phone.replace(/\D/g, '')}`;
      
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
        candidateId: candidate.id, // Usar ID real do candidato
        candidateName: candidate.name,
        phone: phone,
        jobId: parseInt(job.id.toString()),
        jobName: job.nomeVaga,
        clientId: selection.clientId.toString(),
        currentQuestion: 0,
        questions: job.perguntas,
        responses: [],
        startTime: new Date().toISOString(),
        selectionId: selection.id.toString(),
        interviewDbId: uniqueInterviewId // ID único de entrevista
      };

      this.activeInterviews.set(phone, interview);

      await this.sendMessage(`${phone}@s.whatsapp.net`, 
        `🎯 Entrevista iniciada para: ${job.nomeVaga}\n👋 Olá ${candidate.name}!\n📝 ${job.perguntas.length} perguntas\n\n⏳ Preparando primeira pergunta...`
      );

      // Enviar primeira pergunta após pequeno delay
      setTimeout(async () => {
        await this.sendNextQuestion(phone, interview);
      }, 2000);
      
    } catch (error) {
      await this.sendMessage(`${phone}@s.whatsapp.net`, "❌ Erro ao carregar entrevista. Tente novamente.", clientId);
    }
  }

  private async sendNextQuestion(phone: string, interview: ActiveInterview): Promise<void> {
    // 🔥 CORREÇÃO CRÍTICA: Verificar se já respondeu todas as perguntas
    if (interview.currentQuestion >= interview.questions.length) {
      await this.finishInterview(phone, interview);
      return;
    }
    
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
    }
  }

  private async sendQuestionAudio(phone: string, questionText: string, clientId: string): Promise<void> {
    try {
      // Buscar configuração OpenAI
      const config = await storage.getMasterSettings();
      
      if (!config) {
        return;
      }
      
      if (!config.openaiApiKey) {
        // Verificar se existe na variável de ambiente
        const envKey = process.env.OPENAI_API_KEY;
        if (envKey) {
          config.openaiApiKey = envKey;
        } else {
          return;
        }
      }

      // Buscar configuração de voz do cliente
      const clientConfig = await storage.getApiConfig('client', clientId);
      const voice = clientConfig?.openaiVoice || 'nova';

      const ttsRequest = {
        model: "tts-1",
        input: questionText,
        voice: voice,
        response_format: "opus",
        speed: 1.0
      };

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ttsRequest)
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        
        // 🔒 ISOLAMENTO: Tentar enviar áudio via slots isolados do usuário
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
          
          // 1️⃣ PRIMEIRA TENTATIVA: Usar slots isolados do usuário
          const userId = clientId;
          await userIsolatedRoundRobin.initializeUserSlots(userId, clientId);
          const activeSlots = userIsolatedRoundRobin.getUserActiveSlots(userId);
          
          let audioSent = false;
          
          if (activeSlots.length > 0) {
            // Usar primeiro slot ativo isolado do usuário
            const userSlot = activeSlots[0];
            
            try {
              const { simpleMultiBaileyService } = await import('../whatsapp/services/simpleMultiBailey');
              const result = await simpleMultiBaileyService.sendAudioMessage(
                clientId, 
                userSlot.slotNumber, 
                phone, 
                Buffer.from(audioBuffer)
              );
              
              if (result?.success) {
                console.log(`🔊 Áudio TTS enviado via slot isolado ${userSlot.slotNumber} do usuário ${userId}`);
                audioSent = true;
              }
            } catch (isolatedAudioError) {
              console.log(`⚠️ Falha no envio de áudio isolado para usuário ${userId}`);
            }
          }
          
          // 2️⃣ FALLBACK: Usar método tradicional apenas se isolado falhou
          if (!audioSent) {
            const { simpleMultiBaileyService } = await import('../whatsapp/services/simpleMultiBailey');
            const clientConnections = await simpleMultiBaileyService.getClientConnections(clientId);
            
            if (clientConnections && clientConnections.activeConnections > 0) {
              // Usar primeiro slot ativo
              const activeSlot = clientConnections.connections.find((conn: any) => conn.isConnected);
              
              if (activeSlot) {
                const result = await simpleMultiBaileyService.sendAudioMessage(
                  clientId, 
                  activeSlot.slotNumber, 
                  phone, 
                  Buffer.from(audioBuffer)
                );
                
                if (result?.success) {
                  console.log(`🔊 Áudio TTS enviado via fallback para cliente ${clientId}`);
                }
              }
            }
          }
          
          // Limpar arquivo temporário
          setTimeout(() => {
            try {
              if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
              }
            } catch (cleanupError) {
            }
          }, 10000); // Remover após 10 segundos
          
        } catch (audioError: any) {
        }
      } else {
        const errorText = await response.text();
      }
    } catch (error: any) {
    }
  }

  private async processResponse(from: string, interview: ActiveInterview, text: string, audioMessage?: any): Promise<void> {
    const phone = from.replace('@s.whatsapp.net', '');

    let responseText = text;
    let audioFile: string | undefined;

    // Se há áudio, processar
    if (audioMessage) {
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
          // Transcrever áudio usando arquivo direto
          try {
            const transcription = await this.transcribeAudio(audioPath, phone);
            
            if (transcription && transcription.trim().length > 0) {
              responseText = transcription;
              audioFile = audioPath;
            } else {
              responseText = "Resposta de áudio processada";
              audioFile = audioPath;
            }
          } catch (transcribeError) {
            responseText = "Resposta de áudio recebida";
            audioFile = audioPath;
          }
        } else {
          responseText = "Resposta de áudio recebida";
        }
      } catch (error) {
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
          parseInt(interview.clientId)
        );
        const existingResponse = existingResponses.find(r => 
          r.questionId === (interview.currentQuestion + 1) && r.score !== null && r.score !== undefined
        );
        
        if (existingResponse && existingResponse.score !== null && existingResponse.score !== undefined && existingResponse.score > 0) {
          // Usar score já calculado para evitar gasto desnecessário de API
          pontuacao = existingResponse.score;
        } else {
          // Calcular pontuação usando IA apenas se não existe - PRIMEIRA VEZ APENAS
          try {
            const { candidateEvaluationService } = await import('./candidateEvaluationService');
            
            // Usar a OPENAI_API_KEY do ambiente (configurada pelo usuário)
            const openaiApiKey = process.env.OPENAI_API_KEY;
            
            if (openaiApiKey && currentQuestion.respostaPerfeita && responseText) {
              // Usar o sistema de avaliação completo com prompt detalhado
              const evaluationResult = await candidateEvaluationService.evaluateResponse({
                pergunta: currentQuestion.pergunta,
                respostaCandidato: responseText,
                respostaPerfeita: currentQuestion.respostaPerfeita
              });
              
              pontuacao = evaluationResult.pontuacaoGeral;
            } else {
              pontuacao = 0;
            }
          } catch (evaluationError) {
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
          }
        }
      }
    } catch (saveError) {
    }

    // Avançar para próxima pergunta
    interview.currentQuestion++;
    this.activeInterviews.set(phone, interview);

    // 🔥 CORREÇÃO CRÍTICA: Verificar se ainda há perguntas antes de enviar confirmação
    if (interview.currentQuestion >= interview.questions.length) {
      await this.finishInterview(phone, interview);
      return;
    }

    // Enviar confirmação apenas se houver mais perguntas
    await this.sendMessage(from, `✅ Resposta recebida! Preparando próxima pergunta...`, interview.clientId);
    
    setTimeout(async () => {
      await this.sendNextQuestion(phone, interview);
    }, 2000);
  }

  private async transcribeAudio(audioPath: string, phone: string): Promise<string> {
    try {
      // Usar chave do ambiente que está funcionando
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (!openaiApiKey) {
        return '';
      }
      
      const fs = await import('fs');
      const path = await import('path');
      
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Arquivo de áudio não encontrado: ${audioPath}`);
      }
      
      const stats = fs.statSync(audioPath);
      
      if (stats.size < 1000) {
        return '';
      }
      
      // Usar OpenAI SDK como no simpleInterviewService que funciona
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: openaiApiKey
      });

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        language: 'pt',
        response_format: 'text'
      });
      
      if (transcription && transcription.trim().length > 0) {
        return transcription.trim();
      }
      
      return '';
      
    } catch (error) {
      return '';
    }
  }

  private async finishInterview(phone: string, interview: ActiveInterview): Promise<void> {
    // Atualizar status da entrevista no banco
    try {
      if (interview.interviewDbId) {
        await storage.updateInterview(parseInt(interview.interviewDbId), { 
          status: 'completed'
        });
      }
    } catch (error) {
    }

    // Mensagem final
    await this.sendMessage(`${phone}@s.whatsapp.net`, 
      `🎉 Parabéns ${interview.candidateName}! Você completou a entrevista para ${interview.jobName}.\n\n📊 Total de respostas: ${interview.responses.length}\n✅ Suas respostas foram registradas com sucesso!\n\nNós retornaremos com o resultado o mais breve possível. Obrigado pela participação!`,
      interview.clientId
    );

    // Remover entrevista ativa
    this.activeInterviews.delete(phone);
  }

  private async stopInterview(phone: string, clientId?: string): Promise<void> {
    const interview = this.activeInterviews.get(phone);
    if (interview) {
      // Atualizar status para cancelada
      try {
        if (interview.interviewDbId) {
          await storage.updateInterview(parseInt(interview.interviewDbId), { 
            status: 'cancelled'
          });
        }
      } catch (error: any) {
      }

      await this.sendMessage(`${phone}@s.whatsapp.net`, 
        `⏹️ Entrevista interrompida. Obrigado pela participação até aqui!`,
        interview.clientId
      );
      
      this.activeInterviews.delete(phone);
    } else {
      await this.sendMessage(`${phone}@s.whatsapp.net`, "Nenhuma entrevista ativa encontrada.", clientId);
    }
  }

  private async findCandidate(phone: string, clientId?: string) {
    let candidates;

    if (clientId) {
      candidates = await storage.getCandidatesByClientId(parseInt(clientId));
    }
    
    // 🔥 CORREÇÃO CRÍTICA: Priorizar candidatos do cliente especificado quando há duplicatas
    const matchingCandidates = candidates.filter(c => {
      if (!c.whatsapp) return false;
      const candidatePhone = c.whatsapp.replace(/\D/g, '');
      const searchPhone = phone.replace(/\D/g, '');
      return candidatePhone.includes(searchPhone) || searchPhone.includes(candidatePhone);
    });
    
    if (matchingCandidates.length === 0) {
      return null;
    }
    
    // Se temos clientId específico, retornar apenas candidatos desse cliente
    if (clientId) {
      const clientCandidates = matchingCandidates.filter(c => c.clientId.toString() === clientId);
      
      if (clientCandidates.length > 0) {
        const candidate = clientCandidates[0];
        return candidate;
      } else {
        return null;
      }
    }
    
    // Fallback: retornar primeiro candidato encontrado
    const candidate = matchingCandidates[0];
    return candidate;
  }

  private async sendMessage(to: string, text: string, clientId?: string): Promise<void> {
    try {
      // 🔒 ISOLAMENTO CORRIGIDO: Priorizar userIsolatedRoundRobin para envio de mensagens
      if (clientId) {
        // Mapear clientId para userId (neste sistema, clientId é o userId)
        const userId = clientId;
        
        try {
          // 1️⃣ PRIMEIRA TENTATIVA: Usar userIsolatedRoundRobin (isolamento garantido)
          await userIsolatedRoundRobin.initializeUserSlots(userId, clientId);
          const activeSlots = userIsolatedRoundRobin.getUserActiveSlots(userId);
          
          if (activeSlots.length > 0) {
            // Usar primeiro slot ativo do usuário isolado
            const userSlot = activeSlots[0];
            
            const phoneNumber = to.replace('@s.whatsapp.net', '');
            
            // Usar método de envio via userIsolatedRoundRobin
            // (que internamente usa simpleMultiBailey de forma isolada)
            const { simpleMultiBaileyService } = await import('../whatsapp/services/simpleMultiBailey');
            
            const result = await simpleMultiBaileyService.sendTestMessage(
              clientId, 
              userSlot.slotNumber, 
              phoneNumber, 
              text
            );
            
            if (result.success) {
              console.log(`📤 Mensagem enviada via slot isolado ${userSlot.slotNumber} do usuário ${userId}`);
              return;
            }
          }
        } catch (isolatedError) {
          console.log(`⚠️ Falha no envio isolado para usuário ${userId}, tentando fallback`);
        }
        
        // 2️⃣ FALLBACK: Usar simpleMultiBailey diretamente apenas como emergência
        try {
          const { simpleMultiBaileyService } = await import('../whatsapp/services/simpleMultiBailey');
          const allConnections = await simpleMultiBaileyService.getClientConnections(clientId);
          const activeConnections = allConnections.connections.filter((conn: any) => conn.isConnected);
          
          if (activeConnections.length > 0) {
            const connection = activeConnections[0];
            const phoneNumber = to.replace('@s.whatsapp.net', '');
            
            const result = await simpleMultiBaileyService.sendTestMessage(
              clientId, 
              connection.slotNumber, 
              phoneNumber, 
              text
            );
            
            if (result.success) {
              console.log(`📤 Mensagem enviada via fallback para cliente ${clientId}`);
              return;
            }
          }
        } catch (fallbackError) {
          console.log(`❌ Falha no fallback para cliente ${clientId}`);
        }
      }
      
      // 3️⃣ EMERGÊNCIA FINAL: Buscar qualquer conexão ativa como último recurso
      // (usado apenas quando métodos isolados falharam completamente)
      try {
        console.log('⚠️ Tentando envio de emergência (não isolado)');
        
        const allClients = await storage.getClients();
        
        for (const client of allClients) {
          try {
            const { simpleMultiBaileyService } = await import('../whatsapp/services/simpleMultiBailey');
            const clientConnections = await simpleMultiBaileyService.getClientConnections(client.id.toString());
            const activeConnections = clientConnections.connections.filter((conn: any) => conn.isConnected);
            
            if (activeConnections.length > 0) {
              const connection = activeConnections[0];
              const phoneNumber = to.replace('@s.whatsapp.net', '');
              
              const result = await simpleMultiBaileyService.sendTestMessage(
                client.id.toString(),
                connection.slotNumber,
                phoneNumber,
                text
              );
              
              if (result.success) {
                console.log(`📤 Mensagem enviada via emergência usando cliente ${client.id}`);
                return;
              }
            }
          } catch (emergencyError: any) {
            continue; // Tentar próximo cliente
          }
        }
        
        console.log('❌ Nenhuma conexão ativa encontrada em todos os clientes');
        
      } catch (emergencySearchError) {
        console.error('❌ Erro no envio de emergência:', emergencySearchError);
      }
      
    } catch (error) {
    }
  }

  // Método público para verificar entrevistas ativas
  getActiveInterviews(): Map<string, ActiveInterview> {
    return this.activeInterviews;
  }
}

export const interactiveInterviewService = new InteractiveInterviewService();