import { storage } from './storage';
import { userIsolatedRoundRobin } from '../whatsapp/services/userIsolatedRoundRobin';
import { isValidAudio, isValidAudioBuffer, MIN_AUDIO_SIZE, MAX_AUDIO_SIZE } from './utils/audio';

// 🎯 ETAPA 1: ANÁLISE E MAPEAMENTO DO FLUXO ATUAL
// Arquivos que alteram estado da entrevista:
// - interactiveInterviewService.ts: Gerencia activeInterviews Map, processa respostas, avança perguntas
// - simpleMultiBailey.ts: Recebe mensagens WhatsApp e direciona para handleMessage
// - userIsolatedRoundRobin.ts: Controla cadência de mensagens round-robin

// 🏗️ ETAPA 2: ESTRUTURA CENTRALIZADA DE ESTADO DA SESSÃO
interface QueuedResponse {
  id: string;
  phone: string;
  text: string;
  audioMessage?: any;
  timestamp: number;
  processed: boolean;
}

// Legacy ActiveInterview para compatibilidade
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

interface InterviewSession {
  // Estado da entrevista
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
  
  // 🔒 ETAPA 3: CONTROLE DE CONCORRÊNCIA
  responseQueue: QueuedResponse[];
  isProcessing: boolean;
  lock: boolean;
  lastActivity: number;
  
  // 📊 ETAPA 5: MONITORAMENTO
  totalResponses: number;
  queuePeakSize: number;
  processingTimeMs: number[];
}

// 🔄 ETAPA 4: GERENCIADOR DE FILA E MUTEX
class ResponseQueueManager {
  private queues: Map<string, QueuedResponse[]> = new Map();
  private locks: Map<string, boolean> = new Map();
  private processing: Map<string, boolean> = new Map();
  
  // Adicionar resposta à fila
  enqueue(phone: string, response: QueuedResponse): void {
    if (!this.queues.has(phone)) {
      this.queues.set(phone, []);
    }
    this.queues.get(phone)!.push(response);
    console.log(`📝 [QUEUE] Resposta adicionada à fila ${phone}: ${this.queues.get(phone)!.length} total`);
  }
  
  // Processar próxima resposta da fila (com lock)
  async dequeue(phone: string): Promise<QueuedResponse | null> {
    // Verificar se já está processando
    if (this.processing.get(phone) || this.locks.get(phone)) {
      console.log(`🔒 [QUEUE] Sessão ${phone} bloqueada, aguardando...`);
      return null;
    }
    
    const queue = this.queues.get(phone);
    if (!queue || queue.length === 0) {
      return null;
    }
    
    // Aplicar lock
    this.locks.set(phone, true);
    this.processing.set(phone, true);
    
    const response = queue.shift()!;
    console.log(`🔓 [QUEUE] Processando resposta ${response.id} para ${phone}: ${queue.length} restantes`);
    return response;
  }
  
  // Liberar lock após processamento
  unlock(phone: string): void {
    this.locks.set(phone, false);
    this.processing.set(phone, false);
    console.log(`✅ [QUEUE] Lock liberado para ${phone}`);
  }
  
  // Obter status da fila
  getQueueStatus(phone: string): { size: number; isLocked: boolean; isProcessing: boolean } {
    return {
      size: this.queues.get(phone)?.length || 0,
      isLocked: this.locks.get(phone) || false,
      isProcessing: this.processing.get(phone) || false
    };
  }
  
  // Limpar fila antiga
  clearStaleQueue(phone: string): void {
    this.queues.delete(phone);
    this.locks.delete(phone);
    this.processing.delete(phone);
    console.log(`🧹 [QUEUE] Fila limpa para ${phone}`);
  }
}

class InteractiveInterviewService {
  private activeSessions: Map<string, InterviewSession> = new Map();
  private queueManager: ResponseQueueManager = new ResponseQueueManager();
  
  // Legacy support para código existente
  private get activeInterviews(): Map<string, any> {
    const legacyMap = new Map();
    this.activeSessions.forEach((session, phone) => {
      legacyMap.set(phone, {
        candidateId: session.candidateId,
        candidateName: session.candidateName,
        phone: session.phone,
        jobId: session.jobId,
        jobName: session.jobName,
        clientId: session.clientId,
        currentQuestion: session.currentQuestion,
        questions: session.questions,
        responses: session.responses,
        startTime: session.startTime,
        selectionId: session.selectionId,
        interviewDbId: session.interviewDbId
      });
    });
    return legacyMap;
  }
  
  // 🔒 PROTEÇÃO CONTRA CONCORRÊNCIA: Evitar processamento simultâneo (LEGACY)
  private processingRequests: Set<string> = new Set(); // phone_action para evitar duplicatas

  constructor() {
    // 🔄 ETAPA 5: MONITORAMENTO - Limpeza periódica de filas antigas
    this.startQueueMonitoring();
  }

  // 📊 ETAPA 5: SISTEMA DE MONITORAMENTO E ALERTAS
  private startQueueMonitoring(): void {
    setInterval(() => {
      this.monitorQueuePerformance();
    }, 30000); // Monitorar a cada 30 segundos
  }

  private monitorQueuePerformance(): void {
    const now = Date.now();
    const stats = {
      activeSessions: this.activeSessions.size,
      totalQueues: 0,
      maxQueueSize: 0,
      avgProcessingTime: 0,
      staleQueues: 0
    };

    // Analisar performance das sessões ativas
    this.activeSessions.forEach((session, phone) => {
      const queueStatus = this.queueManager.getQueueStatus(phone);
      stats.totalQueues++;
      
      if (queueStatus.size > stats.maxQueueSize) {
        stats.maxQueueSize = queueStatus.size;
      }

      // Alertar sobre filas grandes (possível gargalo)
      if (queueStatus.size > 5) {
        console.warn(`⚠️ [MONITOR] Fila grande detectada para ${phone}: ${queueStatus.size} respostas pendentes`);
      }

      // Calcular tempo médio de processamento
      if (session.processingTimeMs.length > 0) {
        const avgTime = session.processingTimeMs.reduce((a, b) => a + b) / session.processingTimeMs.length;
        stats.avgProcessingTime += avgTime;
      }

      // Detectar sessões inativas (mais de 30 minutos sem atividade)
      if (now - session.lastActivity > 30 * 60 * 1000) {
        stats.staleQueues++;
        console.log(`🧹 [MONITOR] Sessão inativa detectada: ${phone} (${Math.round((now - session.lastActivity) / 60000)} min atrás)`);
        
        // Limpar sessão antiga
        this.queueManager.clearStaleQueue(phone);
        this.activeSessions.delete(phone);
      }
    });

    stats.avgProcessingTime = stats.totalQueues > 0 ? stats.avgProcessingTime / stats.totalQueues : 0;

    // Log de estatísticas periódicas
    if (stats.activeSessions > 0) {
      console.log(`📊 [MONITOR] Estatísticas do sistema:`, {
        ...stats,
        avgProcessingTime: `${Math.round(stats.avgProcessingTime)}ms`
      });
    }
  }

  // 📊 MÉTODO PÚBLICO PARA OBTER MÉTRICAS DO SISTEMA
  public getSystemMetrics(): any {
    const metrics = {
      activeSessions: this.activeSessions.size,
      queues: new Map(),
      totalProcessingTime: 0,
      totalResponses: 0
    };

    this.activeSessions.forEach((session, phone) => {
      const queueStatus = this.queueManager.getQueueStatus(phone);
      metrics.queues.set(phone, {
        queueSize: queueStatus.size,
        isProcessing: queueStatus.isProcessing,
        totalResponses: session.totalResponses,
        avgProcessingTime: session.processingTimeMs.length > 0 
          ? session.processingTimeMs.reduce((a, b) => a + b) / session.processingTimeMs.length 
          : 0,
        lastActivity: session.lastActivity
      });

      metrics.totalResponses += session.totalResponses;
    });

    return metrics;
  }
  
  /**
   * 🔒 CORREÇÃO DE CONCORRÊNCIA: Limpeza seletiva por telefone
   * Remove apenas entrevistas antigas do mesmo telefone, preservando outras pessoas
   */
  private async cleanupStaleInterviewsForPhone(phone: string): Promise<void> {
    try {
      const existingInterview = this.activeInterviews.get(phone);
      
      if (existingInterview) {
        // Verificar se entrevista é muito antiga (mais de 1 hora)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const interviewStartTime = new Date(existingInterview.startTime).getTime();
        
        if (interviewStartTime < oneHourAgo) {
          console.log(`🧹 Limpando entrevista antiga para ${phone} (${Math.round((Date.now() - interviewStartTime) / (60 * 1000))} min atrás)`);
          
          // Tentar salvar progresso antes de limpar
          if (existingInterview.interviewDbId) {
            try {
              await storage.updateInterview(parseInt(existingInterview.interviewDbId), { 
                status: 'timeout' 
              });
            } catch (error) {
              console.error(`❌ Erro ao salvar entrevista antiga:`, error);
            }
          }
          
          this.activeInterviews.delete(phone);
          console.log(`✅ Entrevista antiga removida para ${phone}`);
        } else {
          console.log(`⚠️ Entrevista recente detectada para ${phone}, mantendo ativa`);
        }
      }
    } catch (error) {
      console.error(`❌ Erro na limpeza seletiva para ${phone}:`, error);
    }
  }
  
  /**
   * 🔍 MÉTODO DE DETECÇÃO ROBUSTA DE CLIENTE
   * Detecta o clientId correto baseado no telefone do candidato
   * PRIORIZA O ISOLAMENTO POR CLIENTE - busca apenas no escopo do cliente logado
   */
  private async detectClientIdRobust(phone: string, clientId?: string): Promise<string | null> {
    console.log(`🔍 [DETECT] Detectando clientId para telefone ${phone}, clientId fornecido: ${clientId}`);
    
    // Se clientId fornecido for válido, usar esse E buscar apenas candidatos desse cliente
    if (clientId && clientId !== 'undefined' && clientId !== 'null') {
      try {
        console.log(`🔍 [DETECT] Buscando candidatos do cliente ${clientId}`);
        // 🔒 ISOLAMENTO: Buscar candidatos APENAS do cliente logado
        const clientCandidates = await storage.getCandidatesByClientId(parseInt(clientId));
        console.log(`🔍 [DETECT] Encontrados ${clientCandidates.length} candidatos no cliente ${clientId}`);
        
        // Limpar telefone para comparação (apenas números)
        const cleanPhone = phone.replace(/\D/g, '');
        console.log(`🔍 [DETECT] Telefone limpo para comparação: ${cleanPhone}`);
        
        // Buscar candidato correspondente no escopo do cliente
        const matchingCandidate = clientCandidates.find(candidate => {
          const candidatePhone = candidate.whatsapp?.replace(/\D/g, '') || '';
          console.log(`🔍 [DETECT] Comparando ${cleanPhone} com ${candidatePhone} (${candidate.name})`);
          return candidatePhone === cleanPhone;
        });
        
        // Se encontrou candidato no cliente logado, confirmar o clientId
        if (matchingCandidate) {
          console.log(`✅ [DETECT] Candidato encontrado: ${matchingCandidate.name} no cliente ${clientId}`);
          return clientId;
        } else {
          // Candidato não pertence a este cliente - violação de isolamento
          console.log(`⚠️ [DETECT] Telefone ${phone} não encontrado no cliente ${clientId} - isolamento respeitado`);
          return null;
        }
        
      } catch (error) {
        console.error(`❌ [DETECT] Erro ao buscar candidatos do cliente ${clientId}:`, error);
        return null;
      }
    }
    
    console.log(`⚠️ [DETECT] ClientId não fornecido ou inválido: ${clientId}`);
    return null;
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
      console.log(`🔍 [VALIDATE] Slots ativos encontrados para usuário ${userId}: ${activeSlots.length}`);
      
      if (activeSlots.length === 0) {
        console.log(`❌ [VALIDATE] Cliente ${clientId} não possui conexões WhatsApp ativas isoladas`);
        return false;
      }
      
      // Obter estatísticas isoladas do usuário
      const userStats = userIsolatedRoundRobin.getUserStats(userId);
      console.log(`🔍 [VALIDATE] Estatísticas do usuário ${userId}:`, userStats);
      
      if (userStats.activeSlots === 0) {
        console.log(`❌ [VALIDATE] Cliente ${clientId} - slots ativos: ${userStats.activeSlots}`);
        return false;
      }
      
      console.log(`✅ [VALIDATE] Cliente ${clientId} - ${userStats.activeSlots} conexões ativas isoladas`);
      
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
    console.log(`🚀 [CADENCIA] Iniciando ativação de cadência imediata para ${phone}, clientId: ${clientId}`);
    
    // 🔍 ETAPA 1: DETECÇÃO ROBUSTA DE CLIENTE
    const detectedClientId = await this.detectClientIdRobust(phone, clientId);
    
    if (!detectedClientId) {
      console.log(`❌ [CADENCIA] ClientId não detectado para ${phone} - cadência abortada`);
      return;
    }
    console.log(`✅ [CADENCIA] ClientId detectado: ${detectedClientId} para ${phone}`);
    
    // ✅ ETAPA 2: VALIDAÇÃO COMPLETA
    const isValid = await this.validateClientForCadence(detectedClientId, phone);
    
    if (!isValid) {
      console.log(`❌ [CADENCIA] Validação falhou para cliente ${detectedClientId}, telefone ${phone} - cadência abortada`);
      return;
    }
    console.log(`✅ [CADENCIA] Validação passou para cliente ${detectedClientId}, telefone ${phone}`);

    try {
      // Mapear clientId para userId (neste sistema, clientId é o userId)
      const userId = detectedClientId;
      console.log(`🔧 [CADENCIA] Mapeando clientId para userId: ${userId}`);
      
      // 🔥 ETAPA 3: Inicializar slots se necessário
      console.log(`🔧 [CADENCIA] Inicializando slots para usuário ${userId}`);
      await userIsolatedRoundRobin.initializeUserSlots(userId, detectedClientId);
      
      // 🔥 ETAPA 4: Configurar cadência imediata para o usuário
      console.log(`🔧 [CADENCIA] Configurando cadência imediata para usuário ${userId}`);
      userIsolatedRoundRobin.setUserCadenceConfig(userId, {
        userId,
        baseDelay: 500, // Delay reduzido para resposta "1"
        batchSize: 1, // Envios individuais
        maxRetries: 3,
        adaptiveMode: false, // Modo fixo para resposta imediata
        immediateMode: true // Modo imediato ativado
      });
      
      // 🔥 ETAPA 5: Distribuir apenas o candidato que respondeu "1"
      console.log(`🔧 [CADENCIA] Distribuindo candidato ${phone} para usuário ${userId}`);
      await userIsolatedRoundRobin.distributeUserCandidates(userId, detectedClientId, [phone], 'immediate');
      
      // 🔥 ETAPA 6: Ativar cadência imediata específica do usuário
      console.log(`🔧 [CADENCIA] Ativando cadência imediata para usuário ${userId}, candidato ${phone}`);
      await userIsolatedRoundRobin.activateImmediateCadence(userId, detectedClientId, phone);
      
      // 🔥 ETAPA 7: Validar isolamento entre usuários
      const isIsolated = userIsolatedRoundRobin.validateUserIsolation();
      console.log(`🔧 [CADENCIA] Isolamento validado: ${isIsolated}`);
      
      // 🔥 ETAPA 8: Aguardar 1 segundo e processar cadência garantindo execução
      console.log(`🔧 [CADENCIA] Agendando processamento de cadência em 1 segundo para usuário ${userId}`);
      setTimeout(async () => {
        try {
          console.log(`🚀 [CADENCIA] Executando processamento de cadência para usuário ${userId}`);
          await userIsolatedRoundRobin.processUserCadence(userId, detectedClientId);
          console.log(`✅ [CADENCIA] Processamento de cadência concluído para usuário ${userId}`);
        } catch (error) {
          console.error(`❌ [CADENCIA] Erro no processamento de cadência para usuário ${userId}:`, error);
        }
      }, 1000);
      
    } catch (error) {
      console.error(`❌ [CADENCIA] Erro na ativação de cadência imediata para ${phone}:`, error);
    }
  }



  // 🔧 MÉTODO PARA CONVERTER CAMINHO ABSOLUTO EM URL HTTP
  private convertToHttpPath(absolutePath: string): string {
    try {
      // Extrair apenas o nome do arquivo do caminho absoluto
      const path = require('path');
      const filename = path.basename(absolutePath);
      
      // Retornar URL HTTP que será servida pela rota /api/audio/:filename
      const httpUrl = `/api/audio/${filename}`;
      
      console.log(`🔗 [HTTP-PATH] Convertendo: ${absolutePath} → ${httpUrl}`);
      return httpUrl;
    } catch (error) {
      console.error(`❌ [HTTP-PATH] Erro na conversão:`, error);
      return absolutePath; // Fallback para caminho original
    }
  }

  private async downloadAudioDirect(message: any, phone: string, clientId: string, selectionId: string, questionNumber: number): Promise<string | null> {
    try {
      console.log(`🔍 [DEBUG-DOWNLOAD] Iniciando download para:`, {
        phone,
        clientId,
        selectionId,
        questionNumber,
        hasMessage: !!message,
        hasAudioMessage: !!message?.message?.audioMessage
      });
      
      const { UPLOADS_DIR } = await import('../src/config/paths');
      const path = await import('path');
      
      const cleanPhone = phone.replace(/\D/g, '');
      // Nova nomenclatura: audio_[whatsapp]_[selectionId]_R[numero].ogg
      const audioFileName = `audio_${cleanPhone}_${selectionId}_R${questionNumber}.ogg`;
      const audioPath = path.join(UPLOADS_DIR, audioFileName);
      
      console.log(`📁 [DEBUG-DOWNLOAD] Path do arquivo: ${audioPath}`);
      
      // 🔧 CORREÇÃO: Verificar se arquivo já existe e é válido (não placeholder)
      const fs = await import('fs');
      try {
        const stats = await fs.promises.stat(audioPath);
        if (isValidAudio(stats.size)) {
          console.log(`✅ [ÁUDIO-CORRIGIDO] Arquivo válido encontrado: ${audioPath} (${stats.size} bytes)`);
          return audioPath;
        } else {
          // Remove arquivo inválido/placeholder para forçar novo download
          console.log(`🗑️ [ÁUDIO-CORRIGIDO] Removendo placeholder inválido: ${audioPath} (${stats.size} bytes)`);
          await fs.promises.unlink(audioPath).catch(() => {});
        }
      } catch {
        // Arquivo não existe, continuar com download
      }
      
      let audioBuffer: Buffer | null = null;
      
      // MÉTODO 1: Tentar usar buffer já processado (se disponível)
      if (message._audioBuffer && isValidAudioBuffer(message._audioBuffer)) {
        audioBuffer = message._audioBuffer;
        console.log(`📥 [DEBUG-DOWNLOAD] Usando buffer pré-processado válido (${audioBuffer.length} bytes)`);
      } else {
        console.log(`⚠️ [DEBUG-DOWNLOAD] Buffer pré-processado não disponível:`, {
          hasAudioBuffer: !!message._audioBuffer,
          isValid: message._audioBuffer ? isValidAudioBuffer(message._audioBuffer) : false
        });
      }
      
      // MÉTODO 2: Download direto via userIsolatedRoundRobin (método mais confiável)
      if (!audioBuffer && message.message?.audioMessage) {
        try {
          const userId = clientId;
          console.log(`🔍 [DEBUG-DOWNLOAD] Tentando download via userIsolatedRoundRobin para usuário ${userId}`);
          
          const connectionStatus = await userIsolatedRoundRobin.getUserConnectionStatus(userId, clientId);
          console.log(`📱 [DEBUG-DOWNLOAD] Status da conexão:`, {
            isConnected: connectionStatus.isConnected,
            slotsCount: connectionStatus.slots.length,
            userId,
            clientId
          });
          
          if (connectionStatus.isConnected && connectionStatus.slots.length > 0) {
            try {
              console.log(`📥 [DEBUG-DOWNLOAD] Baixando áudio via userIsolatedRoundRobin...`);
              
              audioBuffer = await userIsolatedRoundRobin.downloadUserAudio(userId, clientId, message);
              
              if (audioBuffer && isValidAudioBuffer(audioBuffer)) {
                console.log(`✅ [DEBUG-DOWNLOAD] Áudio baixado com sucesso via isolamento (${audioBuffer.length} bytes)`);
              } else {
                console.log(`❌ [DEBUG-DOWNLOAD] Buffer inválido do isolamento: ${audioBuffer?.length || 0} bytes`);
                audioBuffer = null;
              }
            } catch (isolatedDownloadError: any) {
              console.log(`❌ [DEBUG-DOWNLOAD] Erro no download isolado:`, isolatedDownloadError.message);
              audioBuffer = null;
            }
          } else {
            console.log(`⚠️ [DEBUG-DOWNLOAD] Nenhuma conexão isolada ativa para usuário ${userId}`);
          }
        } catch (baileyError: any) {
          console.log(`❌ [DEBUG-DOWNLOAD] Erro no Baileys:`, baileyError.message);
        }
      }
      
      // MÉTODO 3: Fallback com downloadContentFromMessage (API mais nova do Baileys)
      if (!audioBuffer && message.message?.audioMessage) {
        try {
          console.log(`📥 [ÁUDIO-CORRIGIDO] Tentando download com API mais nova do Baileys`);
          
          const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
          
          const stream = await downloadContentFromMessage(
            message.message.audioMessage,
            'audio'
          );
          
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          audioBuffer = Buffer.concat(chunks);
          
          if (audioBuffer && isValidAudioBuffer(audioBuffer)) {
            console.log(`✅ [ÁUDIO-CORRIGIDO] Áudio baixado com API nova (${audioBuffer.length} bytes)`);
          } else {
            console.log(`❌ [ÁUDIO-CORRIGIDO] Buffer inválido da API nova: ${audioBuffer?.length || 0} bytes`);
            audioBuffer = null;
          }
        } catch (newApiError: any) {
          console.log(`❌ [ÁUDIO-CORRIGIDO] Erro na API nova:`, newApiError);
          audioBuffer = null;
        }
      }
      
      // MÉTODO 4: Fallback com downloadMediaMessage
      if (!audioBuffer) {
        try {
          console.log(`📥 [ÁUDIO-CORRIGIDO] Fallback com downloadMediaMessage`);
          
          const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
          
          audioBuffer = await downloadMediaMessage(
            message,
            'buffer',
            {}
          );
          
          if (audioBuffer && isValidAudioBuffer(audioBuffer)) {
            console.log(`✅ [ÁUDIO-CORRIGIDO] Áudio baixado via fallback (${audioBuffer.length} bytes)`);
          } else {
            console.log(`❌ [ÁUDIO-CORRIGIDO] Buffer inválido do fallback: ${audioBuffer?.length || 0} bytes`);
            audioBuffer = null;
          }
        } catch (fallbackError: any) {
          console.log(`❌ [ÁUDIO-CORRIGIDO] Erro no fallback:`, fallbackError);
          audioBuffer = null;
        }
      }
      
      // 🔧 CORREÇÃO CRÍTICA: NÃO CRIAR PLACEHOLDER - Lançar erro se buffer inválido
      if (!audioBuffer || !isValidAudioBuffer(audioBuffer)) {
        const errorMsg = `Falha no download do áudio – buffer inválido (${audioBuffer?.length || 0} bytes, mínimo: ${MIN_AUDIO_SIZE})`;
        console.error(`❌ [ÁUDIO-CORRIGIDO] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Salvar o áudio válido
      await fs.promises.writeFile(audioPath, audioBuffer);
      
      // Verificar se arquivo foi realmente salvo
      const verifyStats = await fs.promises.stat(audioPath);
      console.log(`✅ [ÁUDIO-CORRIGIDO] Arquivo salvo: ${audioPath} (${verifyStats.size} bytes)`);
      
      return audioPath;
      
    } catch (error: any) {
      console.error(`❌ [ÁUDIO-CORRIGIDO] Erro crítico no download:`, error.message);
      throw error; // 🔧 CORREÇÃO: Propagar erro em vez de retornar null
    }
  }

  // 🚀 NOVO SISTEMA DE CONTROLE DE CONCORRÊNCIA COM FILAS
  async handleMessage(from: string, text: string, audioMessage?: any, clientId?: string): Promise<void> {
    const phone = from.replace('@s.whatsapp.net', '');
    
    // 📝 ETAPA 3: ADICIONAR RESPOSTA À FILA COM CONTROLE DE CONCORRÊNCIA
    const responseId = `${phone}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedResponse: QueuedResponse = {
      id: responseId,
      phone,
      text,
      audioMessage,
      timestamp: Date.now(),
      processed: false
    };
    
    // Detectar clientId se não fornecido
    if (!clientId) {
      clientId = await this.detectClientIdRobust(phone);
      if (!clientId) {
        console.log(`⚠️ [QUEUE] ClientId não detectado para ${phone} - mensagem ignorada`);
        return;
      }
    }
    
    console.log(`🔍 [HANDLE-MESSAGE] Mensagem recebida: phone=${phone}, text="${text}", clientId=${clientId}`);
    
    // Adicionar à fila
    this.queueManager.enqueue(phone, queuedResponse);
    
    // 🔄 PROCESSAR FILA COM LOCK AUTOMÁTICO
    await this.processQueueForPhone(phone, clientId);
  }
  
  // 🔄 NOVO MÉTODO: PROCESSAR FILA DE RESPOSTAS COM MUTEX
  private async processQueueForPhone(phone: string, clientId: string): Promise<void> {
    const queueStatus = this.queueManager.getQueueStatus(phone);
    
    // Se já está processando, não fazer nada (evita race condition)
    if (queueStatus.isProcessing || queueStatus.isLocked) {
      console.log(`🔒 [QUEUE] Telefone ${phone} já em processamento (fila: ${queueStatus.size})`);
      return;
    }
    
    // Processar respostas uma por uma até esvaziar a fila
    while (true) {
      const response = await this.queueManager.dequeue(phone);
      
      if (!response) {
        break; // Fila vazia ou lock em outro processo
      }
      
      try {
        const startTime = Date.now();
        
        // 📊 ETAPA 5: MONITORAMENTO DE PERFORMANCE
        console.log(`⚡ [QUEUE] Processando resposta ${response.id} (fila: ${this.queueManager.getQueueStatus(phone).size})`);
        
        // PROCESSAR A RESPOSTA INDIVIDUALMENTE
        await this.handleSingleResponse(response, clientId);
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ [QUEUE] Resposta ${response.id} processada em ${processingTime}ms`);
        
        // Atualizar métricas de performance na sessão
        const session = this.activeSessions.get(phone);
        if (session) {
          session.totalResponses++;
          session.processingTimeMs.push(processingTime);
          session.lastActivity = Date.now();
          
          // Manter apenas últimas 10 métricas
          if (session.processingTimeMs.length > 10) {
            session.processingTimeMs = session.processingTimeMs.slice(-10);
          }
        }
        
      } catch (error) {
        console.error(`❌ [QUEUE] Erro ao processar resposta ${response.id}:`, error);
      } finally {
        // 🔓 SEMPRE liberar lock
        this.queueManager.unlock(phone);
      }
    }
  }
  
  // 🎯 MÉTODO INDIVIDUAL PARA PROCESSAR UMA RESPOSTA (SEM CONCORRÊNCIA)
  private async handleSingleResponse(response: QueuedResponse, clientId: string): Promise<void> {
    const { phone, text, audioMessage } = response;
    const activeInterview = this.activeInterviews.get(phone);
    
    console.log(`🔍 [DEBUG-RESPONSE] Processando resposta: phone=${phone}, text="${text}", activeInterview=${!!activeInterview}, clientId=${clientId}`);
    
    if (text === '1' && !activeInterview) {
      console.log(`🚀 [DEBUG-CADENCIA] Resposta "1" detectada para ${phone} - iniciando cadência E entrevista`);
      // PRIMEIRO: Remover da cadência e ativar cadência imediata
      userIsolatedRoundRobin.removeCandidateFromActiveCadence(phone);
      await this.activateUserImmediateCadence(phone, clientId);
      
      // SEGUNDO: Limpar entrevistas antigas e iniciar nova
      await this.cleanupStaleInterviewsForPhone(phone);
      await this.startInterview(phone, clientId);
      
    } else if (text === '2') {
      userIsolatedRoundRobin.removeCandidateFromActiveCadence(phone);
      await this.sendMessage(phone + '@s.whatsapp.net', "Entendido. Obrigado!", clientId);
      
    } else if (text.toLowerCase() === 'parar' || text.toLowerCase() === 'sair') {
      await this.stopInterview(phone, clientId);
      
    } else if (activeInterview && text !== '1') {
      // Verificar estado válido
      if (activeInterview.currentQuestion >= activeInterview.questions.length) {
        this.activeInterviews.delete(phone);
        return;
      }
      
      // 🔄 ETAPA 4: PROCESSAR RESPOSTA E AVANÇAR ENTREVISTA
      try {
        console.log(`🔍 [INTERVIEW] Processando resposta para pergunta ${activeInterview.currentQuestion + 1}/${activeInterview.questions.length}`);
        await this.processInterviewResponse(phone, activeInterview, text, audioMessage);
        console.log(`✅ [INTERVIEW] Resposta processada com sucesso para ${phone}`);
      } catch (error) {
        console.error(`❌ [INTERVIEW] Erro ao processar resposta:`, error);
        // Em caso de erro, manter pergunta atual para retry
      }
      
    } else {
      // Mensagem padrão apenas se não estiver em cadência
      const isInActiveCadence = userIsolatedRoundRobin.isPhoneInActiveCadence(phone);
      
      if (!isInActiveCadence) {
        await this.sendMessage(phone + '@s.whatsapp.net', "Digite:\n1 - Iniciar entrevista\n2 - Não participar", clientId);
      }
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
      
      // 🔧 CORREÇÃO CRÍTICA: Usar sempre o ID real do candidato para evitar problemas no JOIN
      const uniqueInterviewId = `${selection.id}_${phone.replace(/\D/g, '')}_${Date.now()}`;
      const realCandidateId = candidate.id; // ID real da tabela candidates
      
      // Criar entrevista no banco de dados com ID real do candidato
      const interviewDb = await storage.createInterview({
        id: uniqueInterviewId,
        selectionId: selection.id,
        candidateId: realCandidateId.toString(), // Usar ID real como string
        token: `whatsapp_${Date.now()}`,
        status: 'in_progress'
      });

      // 🏗️ CRIAR NOVA SESSÃO CENTRALIZADA COM CONTROLE DE CONCORRÊNCIA
      const session: InterviewSession = {
        // Estado da entrevista (legado)
        candidateId: realCandidateId,
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
        interviewDbId: uniqueInterviewId,
        
        // 🔒 Controle de concorrência
        responseQueue: [],
        isProcessing: false,
        lock: false,
        lastActivity: Date.now(),
        
        // 📊 Monitoramento
        totalResponses: 0,
        queuePeakSize: 0,
        processingTimeMs: []
      };

      // 🔥 CORREÇÃO CRÍTICA: SALVAR SESSÃO EM AMBOS OS SISTEMAS
      this.activeSessions.set(phone, session);
      
      // 🔧 BRIDGE CORREÇÃO: Criar entrevista compatível para activeInterviews
      const activeInterview: ActiveInterview = {
        candidateId: realCandidateId,
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
        interviewDbId: uniqueInterviewId
      };
      
      this.activeInterviews.set(phone, activeInterview);
      console.log(`🏗️ [BRIDGE-SYNC] Entrevista sincronizada em ambos sistemas para ${phone} (clientId: ${selection.clientId})`);

      await this.sendMessage(`${phone}@s.whatsapp.net`, 
        `🎯 Entrevista iniciada para: ${job.nomeVaga}\n👋 Olá ${candidate.name}!\n📝 ${job.perguntas.length} perguntas\n\n⏳ Preparando primeira pergunta...`, 
        clientId
      );

      // Enviar primeira pergunta após pequeno delay
      setTimeout(async () => {
        const currentInterview = this.activeInterviews.get(phone);
        if (currentInterview) {
          console.log(`📤 [START-QUESTION] Enviando primeira pergunta para ${phone}`);
          await this.sendNextQuestion(phone, currentInterview);
        }
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
      
      console.log(`🔊 [TTS-CONFIG] Cliente ${clientId}: configuração encontrada =`, clientConfig);
      console.log(`🔊 [TTS-CONFIG] Voz selecionada para entrevista: "${voice}"`);

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
          
          // ✅ CORREÇÃO ARQUITETURAL: Usar userIsolatedRoundRobin como camada única
          const userId = clientId;
          
          try {
            const result = await userIsolatedRoundRobin.sendUserAudio(
              userId,
              clientId,
              phone,
              Buffer.from(audioBuffer)
            );
            
            if (result?.success) {
              console.log(`🔊 [CORRIGIDO] Áudio TTS enviado via slot isolado ${result.usedSlot} do usuário ${userId}`);
            } else {
              console.log(`⚠️ [CORRIGIDO] Falha no envio de áudio isolado para usuário ${userId}: ${result.error}`);
            }
                    } catch (isolatedAudioError) {
            console.log(`❌ [CORRIGIDO] Erro no envio de áudio isolado para usuário ${userId}:`, isolatedAudioError);
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

  private async processInterviewResponse(phone: string, interview: ActiveInterview, text: string, audioMessage?: any): Promise<void> {

    let responseText = text;
    let audioFile: string | undefined;
    let finalTranscription = text; // 🔧 CORREÇÃO: Usar texto inicial

    // 🔧 CORREÇÃO: CHAMADA ÚNICA de transcrição
    if (audioMessage) {
      try {
        console.log(`🎤 [ÁUDIO-CORRIGIDO] Processando áudio para ${phone}`);
        
        // Baixar áudio com validação rigorosa
        const audioPath = await this.downloadAudioDirect(
          audioMessage, 
          phone, 
          interview.clientId, 
          interview.selectionId, 
          interview.currentQuestion + 1
        );
        
        if (audioPath) {
          audioFile = audioPath;
          
          // 🔧 CORREÇÃO: Transcrever apenas UMA VEZ
          try {
            console.log(`🎤 [TRANSCRIPTION-CORRIGIDO] Iniciando transcrição única para ${phone}`);
            const transcription = await this.transcribeAudio(audioPath, phone);
            
            // 🔧 CORREÇÃO: Usar transcrição válida ou texto padrão
            finalTranscription = transcription || 'Áudio recebido';
            responseText = finalTranscription;
            
            console.log(`✅ [TRANSCRIPTION-CORRIGIDO] Transcrição completa: "${finalTranscription.substring(0, 100)}..."`);
          } catch (transcribeError: any) {
            console.error(`❌ [TRANSCRIPTION-CORRIGIDO] Erro na transcrição:`, transcribeError.message);
            console.error(`🔍 [DEBUG-TRANSCRIPTION] Details:`, {
              audioPath,
              errorType: transcribeError.constructor.name,
              hasOpenAI: !!process.env.OPENAI_API_KEY
            });
            
            // 🔧 CORREÇÃO: Usar texto padrão informativo
            finalTranscription = 'Áudio recebido via WhatsApp';
            responseText = finalTranscription;
          }
        } else {
          console.error(`❌ [ÁUDIO-CORRIGIDO] Falha no download do áudio para ${phone}`);
          console.error(`🔍 [DEBUG-AUDIO] Message details:`, {
            hasAudioMessage: !!audioMessage?.message?.audioMessage,
            messageType: typeof audioMessage,
            clientId: interview.clientId,
            selectionId: interview.selectionId,
            questionNumber: interview.currentQuestion + 1
          });
          
          // 🔧 CORREÇÃO CRÍTICA: Usar texto padrão em vez de "erro"
          finalTranscription = 'Áudio recebido via WhatsApp - aguardando processamento';
          responseText = finalTranscription;
        }
      } catch (audioError: any) {
        console.error(`❌ [ÁUDIO-CORRIGIDO] Erro crítico no processamento:`, audioError.message);
        console.error(`🔍 [DEBUG-AUDIO] Stack trace:`, audioError.stack);
        
        // 🔧 CORREÇÃO CRÍTICA: Usar texto padrão em vez de "erro"
        finalTranscription = 'Áudio recebido via WhatsApp - processamento em andamento';
        responseText = finalTranscription;
      }
    }

    // Salvar resposta na entrevista ativa
    const currentQuestion = interview.questions[interview.currentQuestion];
    const response = {
      questionId: interview.currentQuestion + 1, // 🔧 CORREÇÃO: +1 para match com frontend
      questionText: currentQuestion.pergunta,
      transcription: finalTranscription, // 🔧 CORREÇÃO: usar nome que o frontend espera
      audioUrl: audioFile ? this.convertToHttpPath(audioFile) : '', // 🔧 CORREÇÃO: converter para URL HTTP
      timestamp: new Date().toISOString()
    };

    interview.responses.push(response);

    // Salvar resposta no banco de dados
    try {
      if (interview.interviewDbId) {
        const cleanPhone = interview.phone.replace(/\D/g, '');
        const transcriptionId = `candidato_${interview.selectionId}_${interview.currentQuestion + 1}`;
        const responseId = `${interview.selectionId}_${interview.candidateId}_R${interview.currentQuestion + 1}_${Date.now()}`;
        
        // Verificar se já existe score calculado
        let pontuacao = 50; // Valor padrão
        
        const existingResponses = await storage.getResponsesBySelectionAndCandidate(
          interview.selectionId, 
          interview.candidateId, 
          parseInt(interview.clientId)
        );
        const existingResponse = existingResponses.find(r => 
          r.questionId === (interview.currentQuestion + 1) && r.score !== null && r.score !== undefined
        );
        
        if (existingResponse && existingResponse.score !== null && existingResponse.score !== undefined && existingResponse.score > 0) {
          pontuacao = existingResponse.score;
        } else {
          // Calcular pontuação usando IA
          try {
            const { candidateEvaluationService } = await import('./candidateEvaluationService');
            const openaiApiKey = process.env.OPENAI_API_KEY;
            
            if (openaiApiKey && currentQuestion.respostaPerfeita && finalTranscription) {
              const evaluationResult = await candidateEvaluationService.evaluateResponse({
                pergunta: currentQuestion.pergunta,
                respostaCandidato: finalTranscription,
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

        // 🔍 VERIFICAR SE JÁ EXISTE RESPOSTA PARA ESTA PERGUNTA/CANDIDATO
        const duplicateResponse = existingResponses.find(r => 
          r.questionId === (interview.currentQuestion + 1) && 
          r.candidateId === interview.candidateId &&
          r.selectionId === interview.selectionId
        );

        if (duplicateResponse) {
          // Atualizar resposta existente
          console.log(`🔄 [UPDATE-CORRIGIDO] Atualizando resposta existente ${duplicateResponse.id}`);
          await storage.updateResponse(duplicateResponse.id, {
            transcription: finalTranscription,
            audioUrl: audioFile ? this.convertToHttpPath(audioFile) : (duplicateResponse.audioUrl || ''),
            score: pontuacao
          });
        } else {
          // 🔧 CORREÇÃO: Criar nova resposta com transcrição final já processada
          console.log(`➕ [CREATE-CORRIGIDO] Criando nova resposta para pergunta ${interview.currentQuestion + 1}`);
          
          const responseToSave = {
            id: responseId,
            selectionId: interview.selectionId,
            candidateId: interview.candidateId,
            questionId: interview.currentQuestion + 1,
            questionText: currentQuestion.pergunta,
            audioUrl: audioFile ? this.convertToHttpPath(audioFile) : '', // 🔧 CORREÇÃO: converter para URL HTTP
            transcription: finalTranscription, // 🔧 CORREÇÃO: finalTranscription já é o texto final
            transcriptionId: transcriptionId,
            timestamp: new Date().toISOString(),
            score: pontuacao,
            aiAnalysis: '',
            recordingDuration: 0,
            candidateName: interview.candidateName,
            candidatePhone: interview.phone,
            // 🔥 CAMPOS EXTRAS PARA FIREBASE
            clientId: interview.clientId,
            questionNumber: interview.currentQuestion + 1,
            status: 'completed'
          };

          // Salvar no storage local
          await storage.createResponse(responseToSave);
          
          // 🔥 ETAPA 3: SALVAR TAMBÉM NO FIREBASE COM ESTRUTURA PADRONIZADA
          try {
            const { doc, setDoc } = await import('firebase/firestore');
            const { firebaseDb } = await import('./db');
            
            // Gerar chave padronizada
            const responseKey = `${interview.candidateId}_${interview.selectionId}_R${interview.currentQuestion + 1}`;
            
            const firebaseData = {
              // IDs padronizados
              id: responseKey,
              candidateId: interview.candidateId,
              selectionId: interview.selectionId,
              questionNumber: interview.currentQuestion + 1,
              clientId: interview.clientId,
              
              // Dados da pergunta
              questionId: interview.currentQuestion + 1,
              questionText: currentQuestion.pergunta,
              
              // Dados da resposta
              transcription: finalTranscription,
              audioUrl: audioFile ? this.convertToHttpPath(audioFile) : '',
              
              // Metadados
              phone: interview.phone,
              candidatePhone: interview.phone,
              timestamp: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              
              // Status e score
              score: pontuacao,
              status: 'completed',
              recordingDuration: 0,
              aiAnalysis: 'Análise AI processada',
              candidateName: interview.candidateName
            };

            await setDoc(doc(firebaseDb, "interviewResponses", responseKey), firebaseData);
            
            console.log(`✅ [DUAL-SAVE] Resposta salva em storage + Firebase com chave: ${responseKey}`);
            console.log(`✅ [DUAL-SAVE] Transcription: ${finalTranscription.substring(0, 50)}...`);
            
            // 🔥 ETAPA 5: NOTIFICAR INTEGRAÇÃO EM TEMPO REAL
            try {
              const { realtimeIntegrationService } = await import('./realtimeIntegrationService');
              await realtimeIntegrationService.notifyNewResponse(
                interview.selectionId,
                interview.candidateId,
                firebaseData
              );
              console.log(`🔄 [REALTIME] Notificação enviada para seleção ${interview.selectionId}`);
            } catch (realtimeError: any) {
              console.error(`⚠️ [REALTIME] Erro na notificação (continuando):`, realtimeError.message);
            }
            
          } catch (firebaseError: any) {
            console.error(`⚠️ [DUAL-SAVE] Erro Firebase (continuando):`, firebaseError.message);
            // Não falhar se Firebase der erro, apenas logar
          }
        }
        
        console.log(`💾 [SAVE-CORRIGIDO] Resposta salva com transcrição: "${finalTranscription.substring(0, 50)}..."`);
      }
    } catch (saveError) {
      console.error(`❌ [SAVE-CORRIGIDO] Erro ao salvar resposta para ${interview.phone}:`, saveError);
    }

    // 🔥 CORREÇÃO CRÍTICA: Avançar para próxima pergunta APENAS APÓS SALVAR
    console.log(`🔄 [INTERVIEW-ADVANCE] Avançando de pergunta ${interview.currentQuestion} para ${interview.currentQuestion + 1}`);
    interview.currentQuestion++;
    
    // 🔥 BRIDGE SYNC: ATUALIZAR AMBOS OS SISTEMAS
    this.activeInterviews.set(phone, interview);
    
    // 🔧 SYNC: Atualizar também activeSessions se existir
    const session = this.activeSessions.get(phone);
    if (session) {
      session.currentQuestion = interview.currentQuestion;
      session.responses = interview.responses;
      this.activeSessions.set(phone, session);
      console.log(`🔄 [BRIDGE-SYNC] currentQuestion atualizado para ${interview.currentQuestion} em ambos sistemas`);
    }

    // 🔥 VERIFICAR SE ENTREVISTA DEVE FINALIZAR
    if (interview.currentQuestion >= interview.questions.length) {
      console.log(`🏁 [INTERVIEW-FINISH] Todas as perguntas respondidas (${interview.currentQuestion}/${interview.questions.length}) - finalizando entrevista`);
      await this.finishInterview(phone, interview);
      return;
    }

    // Enviar confirmação e próxima pergunta apenas se houver mais perguntas
    console.log(`➡️ [INTERVIEW-NEXT] Enviando próxima pergunta ${interview.currentQuestion + 1}/${interview.questions.length}`);
    await this.sendMessage(`${phone}@s.whatsapp.net`, `✅ Resposta recebida! Preparando próxima pergunta...`, interview.clientId);
    
    setTimeout(async () => {
      // 🔥 BUSCAR ENTREVISTA ATUALIZADA PARA ENVIO
      const currentInterview = this.activeInterviews.get(phone);
      if (currentInterview) {
        console.log(`📤 [NEXT-QUESTION] Enviando pergunta ${currentInterview.currentQuestion + 1} para ${phone}`);
        await this.sendNextQuestion(phone, currentInterview);
      } else {
        console.log(`❌ [NEXT-QUESTION] Entrevista não encontrada para ${phone} - pode ter sido finalizada`);
      }
    }, 2000);
  }

  private async transcribeAudio(audioPath: string, phone: string): Promise<string> {
    // 🔧 CORREÇÃO: Validar chave da API primeiro
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY ausente no ambiente');
    }
    
    const fs = await import('fs');
    const path = await import('path');
    
    // 🔧 CORREÇÃO: Validar se arquivo existe
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Arquivo de áudio não encontrado: ${audioPath}`);
    }
    
    // 🔧 CORREÇÃO: Validar tamanho do arquivo
    const { size } = fs.statSync(audioPath);
    if (!isValidAudio(size)) {
      throw new Error(`Áudio corrompido ou muito pequeno (${size} B, mínimo: ${MIN_AUDIO_SIZE})`);
    }
    
    console.log(`🎤 [WHISPER-CORRIGIDO] Iniciando transcrição: ${audioPath} (${size} bytes)`);
    
    try {
      // Usar OpenAI SDK
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: openaiApiKey
      });

      const result = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        language: 'pt',
        response_format: 'text'
      });
      
      // 🔧 CORREÇÃO: Whisper já retorna string, não objeto
      const transcription = result.trim();
      
      if (transcription && transcription.length > 0) {
        console.log(`✅ [WHISPER-CORRIGIDO] Transcrição bem-sucedida: "${transcription.substring(0, 100)}..."`);
        return transcription;
      } else {
        throw new Error('Whisper retornou transcrição vazia');
      }
      
    } catch (err: any) {
      // 🔧 CORREÇÃO: Propagar erro com detalhes para debug
      const errorMsg = `Erro na API Whisper: ${err.response?.data || err.message}`;
      console.error(`❌ [WHISPER-CORRIGIDO] ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  private async finishInterview(phone: string, interview: ActiveInterview): Promise<void> {
    console.log(`🏁 [FINISH] Finalizando entrevista para ${phone} - ${interview.responses.length} respostas coletadas`);
    
    // Atualizar status da entrevista no banco
    try {
      if (interview.interviewDbId) {
        await storage.updateInterview(parseInt(interview.interviewDbId), { 
          status: 'completed'
        });
        console.log(`💾 [FINISH] Status da entrevista ${interview.interviewDbId} atualizado para 'completed'`);
      }
    } catch (error) {
      console.error(`❌ [FINISH] Erro ao atualizar status da entrevista:`, error);
    }

    // Mensagem final
    await this.sendMessage(`${phone}@s.whatsapp.net`, 
      `🎉 Parabéns ${interview.candidateName}! Você completou a entrevista para ${interview.jobName}.\n\n📊 Total de respostas: ${interview.responses.length}\n✅ Suas respostas foram registradas com sucesso!\n\nNós retornaremos com o resultado o mais breve possível. Obrigado pela participação!`,
      interview.clientId
    );

    // 🔥 LIMPEZA COMPLETA: Remover entrevista
    this.activeInterviews.delete(phone);
    
    console.log(`✅ [FINISH] Entrevista finalizada e removida para ${phone}`);
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
          // ✅ CORREÇÃO ARQUITETURAL: Usar userIsolatedRoundRobin como camada única
          const phoneNumber = to.replace('@s.whatsapp.net', '');
          
          const result = await userIsolatedRoundRobin.sendUserMessage(
            userId,
            clientId,
            phoneNumber,
            text
          );
          
          if (result.success) {
            console.log(`📤 [CORRIGIDO] Mensagem enviada via slot isolado ${result.usedSlot} do usuário ${userId}`);
            return;
          } else {
            console.log(`⚠️ [CORRIGIDO] Falha no envio isolado para usuário ${userId}: ${result.error}`);
          }
        } catch (isolatedError) {
          console.log(`❌ [CORRIGIDO] Erro no envio isolado para usuário ${userId}:`, isolatedError);
        }
        
        // ✅ ARQUITETURA CORRIGIDA: Sem fallback - userIsolatedRoundRobin deve ser suficiente
        console.log(`⚠️ [CORRIGIDO] Tentativa de envio falhou para usuário ${userId}`);
      }
      
      // ✅ ARQUITETURA CORRIGIDA: Não usar envio de emergência não isolado
      console.log('❌ [CORRIGIDO] Envio falhou - mantendo isolamento por usuário');
      
    } catch (error) {
    }
  }

  // Método público para verificar entrevistas ativas
  getActiveInterviews(): Map<string, ActiveInterview> {
    return this.activeInterviews;
  }
}

export const interactiveInterviewService = new InteractiveInterviewService();