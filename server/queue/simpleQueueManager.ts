/**
 * Simple Queue Manager - Sistema de filas simplificado para WhatsApp em massa
 * Utiliza apenas JavaScript nativo + Redis Simulator para processamento em background
 */

import { redisSimulator } from '../redis/redisSimulator';

// Interfaces para os dados dos jobs
export interface WhatsAppDispatchJobData {
  selectionId: number;
  clientId: number;
  candidateIds: number[];
  rateLimitConfig: {
    delayPerMessage: number;
    batchSize: number;
    maxRetries: number;
  };
  template: string;
  whatsappTemplate: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdBy: string;
  estimatedTime: number;
}

export interface MessageJobData {
  candidateId: number;
  candidateName: string;
  phone: string;
  message: string;
  clientId: number;
  selectionId: number;
  slotNumber: number;
  attempt: number;
  jobId: string;
}

export interface JobProgress {
  sent: number;
  total: number;
  failed: number;
  percentage: number;
  errors: string[];
  currentCandidate?: string;
  estimatedTimeRemaining?: number;
  startTime: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

export interface SimpleJob {
  id: string;
  type: 'dispatch' | 'message';
  data: WhatsAppDispatchJobData | MessageJobData;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  processedAt?: number;
  error?: string;
}

export class SimpleQueueManager {
  private isInitialized = false;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private jobProgressStorage = new Map<string, JobProgress>();

  constructor() {
    console.log('🔄 [SIMPLE-QUEUE] Inicializando sistema de filas simplificado...');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ [SIMPLE-QUEUE] Sistema já inicializado');
      return;
    }

    try {
      // 🔥 CORREÇÃO: Verificar se Redis Simulator está funcionando
      await redisSimulator.connect();
      console.log('✅ [SIMPLE-QUEUE] Redis Simulator conectado');

      // 🔥 CORREÇÃO: Verificar filas existentes
      const dispatchQueueLength = await redisSimulator.llen('dispatch-queue');
      const messageQueueLength = await redisSimulator.llen('message-queue');
      
      console.log(`📊 [SIMPLE-QUEUE] Filas encontradas: dispatch=${dispatchQueueLength}, messages=${messageQueueLength}`);

      // Iniciar processamento contínuo
      this.startProcessing();
      
      this.isInitialized = true;
      console.log('🚀 [SIMPLE-QUEUE] Sistema de filas simplificado inicializado com sucesso');
      
    } catch (error) {
      console.error('❌ [SIMPLE-QUEUE] Erro ao inicializar:', error);
      throw error;
    }
  }

  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    // 🔥 CORREÇÃO: Usar intervalo mais frequente e adicionar logs
    this.processingInterval = setInterval(async () => {
      try {
        await this.processJobs();
      } catch (error) {
        console.error('❌ [SIMPLE-QUEUE] Erro no loop de processamento:', error);
      }
    }, 500); // 🔥 CORREÇÃO: Reduzido de 1000ms para 500ms

    console.log('⚡ [SIMPLE-QUEUE] Processamento iniciado com intervalo de 500ms');
  }

  private async processJobs(): Promise<void> {
    try {
      // 🔥 CORREÇÃO: Processar mais jobs por ciclo
      const dispatchProcessed = await this.processMultipleJobs('dispatch-queue', 2);
      const messageProcessed = await this.processMultipleJobs('message-queue', 5);
      
      if (dispatchProcessed > 0 || messageProcessed > 0) {
        console.log(`🔄 [SIMPLE-QUEUE] Ciclo: ${dispatchProcessed} dispatch, ${messageProcessed} mensagens processadas`);
      }
      
    } catch (error) {
      console.error('❌ [SIMPLE-QUEUE] Erro processando jobs:', error);
    }
  }

  // 🔥 NOVO: Processar múltiplos jobs por ciclo
  private async processMultipleJobs(queueName: string, maxJobs: number): Promise<number> {
    let processed = 0;
    
    for (let i = 0; i < maxJobs; i++) {
      const jobData = await redisSimulator.rpop(queueName);
      if (!jobData) break; // Nenhum job na fila
      
      try {
        const job: SimpleJob = JSON.parse(jobData);
        
        if (job.status !== 'pending') continue;
        
        console.log(`🔄 [SIMPLE-QUEUE] Processando job ${job.id} tipo ${job.type}`);
        
        // Marcar como processando
        job.status = 'processing';
        job.processedAt = Date.now();
        await this.updateJobStatus(job);
        
        // Processar baseado no tipo
        if (job.type === 'dispatch') {
          await this.processDispatchJob(job);
        } else if (job.type === 'message') {
          await this.processMessageJob(job);
        }
        
        // Marcar como completado
        job.status = 'completed';
        await this.updateJobStatus(job);
        
        console.log(`✅ [SIMPLE-QUEUE] Job ${job.id} completado`);
        processed++;
        
      } catch (error) {
        console.error(`❌ [SIMPLE-QUEUE] Erro processando job:`, error);
        
        // Marcar como falhou e tentar retry
        try {
          const job: SimpleJob = JSON.parse(jobData);
          job.attempts++;
          job.error = error instanceof Error ? error.message : 'Erro desconhecido';
          
          if (job.attempts < job.maxAttempts) {
            console.log(`🔄 [SIMPLE-QUEUE] Retry ${job.attempts}/${job.maxAttempts} para job ${job.id}`);
            job.status = 'pending';
            await redisSimulator.lpush(queueName, JSON.stringify(job));
          } else {
            job.status = 'failed';
            console.error(`💀 [SIMPLE-QUEUE] Job ${job.id} falhou definitivamente após ${job.attempts} tentativas`);
          }
          
          await this.updateJobStatus(job);
        } catch (updateError) {
          console.error('❌ [SIMPLE-QUEUE] Erro atualizando status do job falhou:', updateError);
        }
      }
    }
    
    return processed;
  }

  private async processJobQueue(queueName: string): Promise<void> {
    // 🔥 CORREÇÃO: Método agora delegado para processMultipleJobs
    await this.processMultipleJobs(queueName, 1);
  }

  private async processDispatchJob(job: SimpleJob): Promise<void> {
    const data = job.data as WhatsAppDispatchJobData;
    const { selectionId, clientId, candidateIds, rateLimitConfig, whatsappTemplate } = data;
    
    console.log(`📋 [DISPATCH] Processando seleção ${selectionId} com ${candidateIds.length} candidatos`);

    // Inicializar progresso
    const progress: JobProgress = {
      sent: 0,
      total: candidateIds.length,
      failed: 0,
      percentage: 0,
      errors: [],
      startTime: Date.now(),
      status: 'processing',
    };
    
    this.setJobProgress(job.id, progress);

    // Importar storage dinamicamente
    const { storage } = await import('../storage');
    
    // Buscar dados dos candidatos
    const candidates = await storage.getCandidatesByClientId(clientId);
    const candidateMap = new Map(candidates.map(c => [c.id, c]));
    
    // Buscar slots ativos WhatsApp - Usar simpleMultiBaileyService dinamicamente
    let activeSlots: any[] = [];
    try {
      const simpleMultiBaileyPath = '../../whatsapp/services/simpleMultiBailey';
      const { simpleMultiBaileyService } = await import(simpleMultiBaileyPath);
      const connectionsStatus = await simpleMultiBaileyService.getClientConnections(clientId.toString());
      
      if (!connectionsStatus || connectionsStatus.activeConnections === 0) {
        throw new Error('Nenhuma conexão WhatsApp ativa encontrada');
      }

      activeSlots = connectionsStatus.connections?.filter((conn: any) => conn.isConnected) || [];
    } catch (error) {
      console.error('⚠️ [DISPATCH] Erro acessando WhatsApp service, usando mock slots:', error);
      // Usar slots mock para desenvolvimento
      activeSlots = [{ slotNumber: 1, isConnected: true }];
    }

    if (activeSlots.length === 0) {
      throw new Error('Nenhum slot WhatsApp ativo disponível');
    }

    let currentSlotIndex = 0;
    const { batchSize, delayPerMessage } = rateLimitConfig;
    
    // Processar candidatos em lotes
    for (let i = 0; i < candidateIds.length; i += batchSize) {
      const batch = candidateIds.slice(i, i + batchSize);
      
      console.log(`📦 [DISPATCH] Processando lote ${Math.floor(i/batchSize) + 1} com ${batch.length} candidatos`);

      // Criar jobs de mensagem para cada candidato do lote
      for (const candidateId of batch) {
        const candidate = candidateMap.get(candidateId);
        
        if (!candidate) {
          console.warn(`⚠️ [DISPATCH] Candidato ${candidateId} não encontrado`);
          progress.failed++;
          continue;
        }

        // Round-robin para slot
        const slot = activeSlots[currentSlotIndex % activeSlots.length];
        currentSlotIndex++;

        // Personalizar mensagem
        const personalizedMessage = whatsappTemplate
          .replace(/\[nome do candidato\]/g, candidate.name)
          .replace(/\[nome do cliente\]/g, `Cliente ${clientId}`);

        // Criar job de mensagem
        const messageJob: SimpleJob = {
          id: `msg_${job.id}_${candidateId}_${Date.now()}`,
          type: 'message',
          data: {
            candidateId,
            candidateName: candidate.name,
            phone: candidate.whatsapp || candidate.email, // Usar WhatsApp se disponível
            message: personalizedMessage,
            clientId,
            selectionId,
            slotNumber: slot.slotNumber,
            attempt: 1,
            jobId: job.id,
          },
          priority: data.priority === 'urgent' ? 10 : 5,
          attempts: 0,
          maxAttempts: 3,
          status: 'pending',
          createdAt: Date.now(),
        };

        // Adicionar à fila de mensagens com delay
        await new Promise(resolve => setTimeout(resolve, delayPerMessage));
        await redisSimulator.lpush('message-queue', JSON.stringify(messageJob));
      }

      // Delay entre lotes
      if (i + batchSize < candidateIds.length) {
        await new Promise(resolve => setTimeout(resolve, delayPerMessage * 2));
      }
    }

    progress.status = 'completed';
    this.setJobProgress(job.id, progress);
    
    // Atualizar status da seleção para 'enviado' após processamento completo
    try {
      const { storage } = await import('../storage');
      await storage.updateSelection(selectionId, { status: 'enviado' });
      console.log(`✅ [DISPATCH] Status da seleção ${selectionId} atualizado para "enviado"`);
    } catch (updateError) {
      console.error(`❌ [DISPATCH] Erro ao atualizar status da seleção ${selectionId}:`, updateError);
    }
    
    console.log(`✅ [DISPATCH] Seleção ${selectionId} dividida em ${candidateIds.length} mensagens`);
  }

  private async processMessageJob(job: SimpleJob): Promise<void> {
    const data = job.data as MessageJobData;
    const { candidateName, phone, message, clientId, slotNumber, jobId } = data;
    
    console.log(`📱 [MESSAGE] Enviando para ${candidateName} (${phone}) via slot ${slotNumber}`);

    try {
      // Simular envio de mensagem (desenvolvimento)
      const success = Math.random() > 0.1; // 90% success rate para teste
      
      // Tentar usar serviço real WhatsApp se disponível
      try {
        const { simpleMultiBaileyService } = await import('../../whatsapp/services/simpleMultiBailey');
        const result = await simpleMultiBaileyService.sendMessage(
          clientId.toString(),
          phone,
          message,
          slotNumber
        );
        
        if (result.success) {
          console.log(`✅ [MESSAGE] Mensagem enviada para ${candidateName}`);
          this.incrementJobProgress(jobId, 'sent');
        } else {
          throw new Error(result.error || 'Falha no envio WhatsApp');
        }
      } catch (whatsappError) {
        console.warn(`⚠️ [MESSAGE] WhatsApp service não disponível, simulando envio:`, whatsappError);
        
        // Simular delay de envio
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        
        if (success) {
          console.log(`✅ [MESSAGE] Mensagem simulada enviada para ${candidateName}`);
          this.incrementJobProgress(jobId, 'sent');
        } else {
          throw new Error('Simulação de falha no envio');
        }
      }
      
    } catch (error) {
      console.error(`❌ [MESSAGE] Erro enviando para ${candidateName}:`, error);
      this.incrementJobProgress(jobId, 'failed');
      throw error;
    }
  }

  // Adicionar job de dispatch
  public async addDispatchJob(data: WhatsAppDispatchJobData): Promise<string> {
    await this.ensureInitialized();
    
    const jobId = `dispatch_${data.selectionId}_${Date.now()}`;
    const priority = this.getPriorityValue(data.priority);
    
    const job: SimpleJob = {
      id: jobId,
      type: 'dispatch',
      data,
      priority,
      attempts: 0,
      maxAttempts: 3,
      status: 'pending',
      createdAt: Date.now(),
    };

    console.log(`📋 [SIMPLE-QUEUE] Adicionando job de dispatch para seleção ${data.selectionId}`);
    
    // Adicionar à fila
    await redisSimulator.lpush('dispatch-queue', JSON.stringify(job));
    
    // Salvar metadata do job
    await redisSimulator.set(`job:${jobId}`, JSON.stringify(job));
    
    console.log(`📋 [SIMPLE-QUEUE] Job ${jobId} criado na fila de dispatch`);
    return jobId;
  }

  // Obter status de um job
  public async getJobStatus(jobId: string): Promise<any> {
    await this.ensureInitialized();
    
    const jobData = await redisSimulator.get(`job:${jobId}`);
    const progress = this.getJobProgress(jobId);
    
    if (!jobData) {
      return { status: 'not_found' };
    }

    const job: SimpleJob = JSON.parse(jobData);

    return {
      id: job.id,
      status: job.status,
      progress: progress || {
        sent: 0,
        total: 0,
        failed: 0,
        percentage: 0,
        errors: [],
        status: job.status,
      },
      createdAt: job.createdAt,
      processedAt: job.processedAt,
      error: job.error,
      data: job.data,
    };
  }

  // Cancelar job
  public async cancelJob(jobId: string): Promise<boolean> {
    try {
      const jobData = await redisSimulator.get(`job:${jobId}`);
      if (jobData) {
        const job: SimpleJob = JSON.parse(jobData);
        job.status = 'failed';
        job.error = 'Cancelado pelo usuário';
        await this.updateJobStatus(job);
        
        console.log(`🗑️ [SIMPLE-QUEUE] Job ${jobId} cancelado`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ [SIMPLE-QUEUE] Erro cancelando job ${jobId}:`, error);
      return false;
    }
  }

  // Estatísticas das filas
  public async getQueueStats(): Promise<any> {
    await this.ensureInitialized();
    
    const dispatchQueueLength = await redisSimulator.llen('dispatch-queue');
    const messageQueueLength = await redisSimulator.llen('message-queue');
    
    return {
      dispatch: {
        waiting: dispatchQueueLength,
        active: this.isProcessing ? 1 : 0,
      },
      messages: {
        waiting: messageQueueLength,
        active: this.isProcessing ? 1 : 0,
      },
      redis: redisSimulator.getStats(),
      system: {
        isProcessing: this.isProcessing,
        uptime: process.uptime(),
      },
    };
  }

  // Métodos para gerenciar progresso dos jobs
  public setJobProgress(jobId: string, progress: JobProgress): void {
    this.jobProgressStorage.set(jobId, progress);
    // Persistir no Redis também
    redisSimulator.set(`progress:${jobId}`, JSON.stringify(progress), { EX: 3600 }); // 1 hora
  }

  public getJobProgress(jobId: string): JobProgress | null {
    return this.jobProgressStorage.get(jobId) || null;
  }

  public incrementJobProgress(jobId: string, field: 'sent' | 'failed'): void {
    const progress = this.getJobProgress(jobId);
    if (progress) {
      progress[field]++;
      progress.percentage = Math.round(((progress.sent + progress.failed) / progress.total) * 100);
      
      // Calcular tempo estimado restante
      if (progress.sent > 0) {
        const elapsedTime = Date.now() - progress.startTime;
        const avgTimePerMessage = elapsedTime / (progress.sent + progress.failed);
        const remainingMessages = progress.total - (progress.sent + progress.failed);
        progress.estimatedTimeRemaining = Math.round(remainingMessages * avgTimePerMessage);
      }
      
      this.setJobProgress(jobId, progress);
    }
  }

  private async updateJobStatus(job: SimpleJob): Promise<void> {
    await redisSimulator.set(`job:${job.id}`, JSON.stringify(job));
  }

  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'urgent': return 20;
      case 'high': return 15;
      case 'normal': return 10;
      case 'low': return 5;
      default: return 10;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // Cleanup
  public async cleanup(): Promise<void> {
    console.log('🧹 [SIMPLE-QUEUE] Iniciando cleanup...');
    
    try {
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }
      
      this.isProcessing = false;
      await redisSimulator.disconnect();
      
      console.log('✅ [SIMPLE-QUEUE] Cleanup concluído');
    } catch (error) {
      console.error('❌ [SIMPLE-QUEUE] Erro no cleanup:', error);
    }
  }
}

// Instância singleton
export const simpleQueueManager = new SimpleQueueManager();