/**
 * Queue Manager - Sistema de filas para WhatsApp em massa
 * Utiliza Redis Simulator simplificado para processamento em background
 */

import { redisSimulator } from '../redis/redisSimulator.js';

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
}

// Configuração de conexão com Redis Simulator
const connection = {
  host: 'localhost',
  port: 6379,
  // Vamos usar o simulador Redis em memória
  maxRetriesPerRequest: null,
};

// Configuração das filas
const defaultJobOptions = {
  removeOnComplete: 50, // Manter apenas os últimos 50 jobs completados
  removeOnFail: 100,    // Manter últimos 100 jobs falhados para debug
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
};

// Filas principais
export const dispatchQueue = new Queue('whatsapp-dispatch', {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    priority: 10, // Prioridade alta para dispatch inicial
  },
});

export const messageQueue = new Queue('whatsapp-messages', {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    priority: 5, // Prioridade normal para mensagens individuais
  },
});

export const statusQueue = new Queue('whatsapp-status', {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    priority: 1, // Prioridade baixa para updates de status
  },
});

// Storage em memória para progresso dos jobs
const jobProgressStorage = new Map<string, JobProgress>();

export class QueueManager {
  private workers: Worker[] = [];
  private isInitialized = false;

  constructor() {
    console.log('🔄 [QUEUE-MANAGER] Inicializando sistema de filas...');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ [QUEUE-MANAGER] Sistema já inicializado');
      return;
    }

    try {
      // Conectar ao Redis Simulator
      await redisSimulator.connect();
      console.log('✅ [QUEUE-MANAGER] Redis Simulator conectado');

      // Inicializar workers
      await this.initializeWorkers();
      
      // Configurar event listeners das filas
      this.setupQueueEventListeners();

      this.isInitialized = true;
      console.log('🚀 [QUEUE-MANAGER] Sistema de filas inicializado com sucesso');
      
      // Log das estatísticas iniciais
      await this.logQueueStats();
      
    } catch (error) {
      console.error('❌ [QUEUE-MANAGER] Erro ao inicializar:', error);
      throw error;
    }
  }

  private async initializeWorkers(): Promise<void> {
    console.log('👷 [QUEUE-MANAGER] Inicializando workers...');

    // Worker para processar dispatches (dividir em lotes)
    const dispatchWorker = new Worker('whatsapp-dispatch', async (job: Job<WhatsAppDispatchJobData>) => {
      return this.processDispatchJob(job);
    }, { 
      connection,
      concurrency: 3, // Máximo 3 dispatches simultâneos
    });

    // Worker para enviar mensagens individuais
    const messageWorker = new Worker('whatsapp-messages', async (job: Job<MessageJobData>) => {
      return this.processMessageJob(job);
    }, { 
      connection,
      concurrency: 10, // Máximo 10 mensagens simultâneas
    });

    // Worker para updates de status
    const statusWorker = new Worker('whatsapp-status', async (job: Job) => {
      return this.processStatusJob(job);
    }, { 
      connection,
      concurrency: 5,
    });

    this.workers = [dispatchWorker, messageWorker, statusWorker];
    
    // Event listeners para workers
    this.workers.forEach(worker => {
      worker.on('completed', (job) => {
        console.log(`✅ [WORKER] Job ${job.id} completado na fila ${worker.name}`);
      });

      worker.on('failed', (job, err) => {
        console.error(`❌ [WORKER] Job ${job?.id} falhou na fila ${worker.name}:`, err.message);
      });

      worker.on('error', (err) => {
        console.error(`🚨 [WORKER] Erro no worker ${worker.name}:`, err);
      });
    });

    console.log(`👷 [QUEUE-MANAGER] ${this.workers.length} workers inicializados`);
  }

  private setupQueueEventListeners(): void {
    // Listeners para fila de dispatch
    dispatchQueue.on('completed', (job) => {
      console.log(`📋 [DISPATCH] Job ${job.id} completado`);
    });

    dispatchQueue.on('failed', (job, err) => {
      console.error(`📋 [DISPATCH] Job ${job?.id} falhou:`, err.message);
    });

    // Listeners para fila de mensagens
    messageQueue.on('progress', (job, progress) => {
      this.updateJobProgress(job.data.jobId, { sent: progress });
    });

    console.log('📡 [QUEUE-MANAGER] Event listeners configurados');
  }

  // Processar job de dispatch (dividir seleção em mensagens)
  private async processDispatchJob(job: Job<WhatsAppDispatchJobData>): Promise<void> {
    const { selectionId, clientId, candidateIds, rateLimitConfig, whatsappTemplate } = job.data;
    
    console.log(`📋 [DISPATCH] Processando seleção ${selectionId} com ${candidateIds.length} candidatos`);

    // Inicializar progresso
    const progress: JobProgress = {
      sent: 0,
      total: candidateIds.length,
      failed: 0,
      percentage: 0,
      errors: [],
      startTime: Date.now(),
    };
    
    this.setJobProgress(job.id!, progress);

    // Importar storage para buscar dados dos candidatos
    const { storage } = await import('../storage.js');
    
    try {
      // Buscar slots ativos WhatsApp para round-robin
      const { simpleMultiBaileyService } = await import('../whatsapp/services/simpleMultiBailey.js');
      const connectionsStatus = await simpleMultiBaileyService.getClientConnections(clientId.toString());
      
      if (!connectionsStatus || connectionsStatus.activeConnections === 0) {
        throw new Error('Nenhuma conexão WhatsApp ativa encontrada');
      }

      const activeSlots = connectionsStatus.connections?.filter(conn => conn.isConnected) || [];
      let currentSlotIndex = 0;

      // Processar candidatos em lotes
      const { batchSize, delayPerMessage } = rateLimitConfig;
      
      for (let i = 0; i < candidateIds.length; i += batchSize) {
        const batch = candidateIds.slice(i, i + batchSize);
        
        console.log(`📦 [DISPATCH] Processando lote ${Math.floor(i/batchSize) + 1} com ${batch.length} candidatos`);

        // Criar jobs de mensagem para cada candidato do lote
        const messageJobs = await Promise.all(batch.map(async (candidateId, index) => {
          // Buscar dados do candidato
          const candidates = await storage.getCandidatesByClientId(clientId);
          const candidate = candidates.find(c => c.id === candidateId);
          
          if (!candidate) {
            console.warn(`⚠️ [DISPATCH] Candidato ${candidateId} não encontrado`);
            return null;
          }

          // Round-robin para slot
          const slot = activeSlots[currentSlotIndex % activeSlots.length];
          currentSlotIndex++;

          // Personalizar mensagem
          const personalizedMessage = whatsappTemplate
            .replace(/\[nome do candidato\]/g, candidate.name)
            .replace(/\[nome do cliente\]/g, `Cliente ${clientId}`);

          return {
            candidateId,
            candidateName: candidate.name,
            phone: candidate.phone,
            message: personalizedMessage,
            clientId,
            selectionId,
            slotNumber: slot.slotNumber,
            attempt: 1,
            jobId: job.id!,
          };
        }));

        // Filtrar jobs válidos
        const validJobs = messageJobs.filter(job => job !== null) as MessageJobData[];
        
        // Adicionar jobs à fila de mensagens com delay
        for (const [index, messageJob] of validJobs.entries()) {
          await messageQueue.add('send-message', messageJob, {
            delay: index * delayPerMessage,
            priority: job.data.priority === 'urgent' ? 10 : 5,
          });
        }

        // Delay entre lotes se não for o último
        if (i + batchSize < candidateIds.length) {
          await new Promise(resolve => setTimeout(resolve, delayPerMessage * 2));
        }
      }

      console.log(`✅ [DISPATCH] Seleção ${selectionId} dividida em ${candidateIds.length} mensagens`);
      
    } catch (error) {
      console.error(`❌ [DISPATCH] Erro processando seleção ${selectionId}:`, error);
      throw error;
    }
  }

  // Processar job de mensagem individual
  private async processMessageJob(job: Job<MessageJobData>): Promise<void> {
    const { candidateName, phone, message, clientId, slotNumber, jobId } = job.data;
    
    console.log(`📱 [MESSAGE] Enviando para ${candidateName} (${phone}) via slot ${slotNumber}`);

    try {
      // Importar serviço WhatsApp
      const { simpleMultiBaileyService } = await import('../whatsapp/services/simpleMultiBailey.js');
      
      // Enviar mensagem
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
        console.error(`❌ [MESSAGE] Falha ao enviar para ${candidateName}:`, result.error);
        this.incrementJobProgress(jobId, 'failed');
        throw new Error(result.error || 'Falha no envio');
      }
      
    } catch (error) {
      console.error(`❌ [MESSAGE] Erro enviando para ${candidateName}:`, error);
      this.incrementJobProgress(jobId, 'failed');
      throw error;
    }
  }

  // Processar job de status
  private async processStatusJob(job: Job): Promise<void> {
    console.log(`📊 [STATUS] Processando update de status:`, job.data);
    // Implementar lógica de update de status conforme necessário
  }

  // Métodos para gerenciar progresso dos jobs
  public setJobProgress(jobId: string, progress: JobProgress): void {
    jobProgressStorage.set(jobId, progress);
  }

  public getJobProgress(jobId: string): JobProgress | null {
    return jobProgressStorage.get(jobId) || null;
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

  public updateJobProgress(jobId: string, updates: Partial<JobProgress>): void {
    const progress = this.getJobProgress(jobId);
    if (progress) {
      Object.assign(progress, updates);
      this.setJobProgress(jobId, progress);
    }
  }

  // Adicionar job de dispatch
  public async addDispatchJob(data: WhatsAppDispatchJobData): Promise<Job<WhatsAppDispatchJobData>> {
    await this.ensureInitialized();
    
    const priority = this.getPriorityValue(data.priority);
    
    console.log(`📋 [QUEUE-MANAGER] Adicionando job de dispatch para seleção ${data.selectionId}`);
    
    const job = await dispatchQueue.add('process-selection', data, {
      priority,
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
    });

    console.log(`📋 [QUEUE-MANAGER] Job ${job.id} criado na fila de dispatch`);
    return job;
  }

  // Obter status de um job
  public async getJobStatus(jobId: string): Promise<any> {
    await this.ensureInitialized();
    
    const job = await dispatchQueue.getJob(jobId);
    const progress = this.getJobProgress(jobId);
    
    if (!job) {
      return { status: 'not_found' };
    }

    return {
      id: job.id,
      status: job.processedOn ? 'completed' : job.failedReason ? 'failed' : 'processing',
      progress: progress || {
        sent: 0,
        total: 0,
        failed: 0,
        percentage: 0,
        errors: [],
      },
      createdAt: job.timestamp,
      processedAt: job.processedOn,
      failedReason: job.failedReason,
      data: job.data,
    };
  }

  // Cancelar job
  public async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await dispatchQueue.getJob(jobId);
      if (job) {
        await job.remove();
        console.log(`🗑️ [QUEUE-MANAGER] Job ${jobId} cancelado`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ [QUEUE-MANAGER] Erro cancelando job ${jobId}:`, error);
      return false;
    }
  }

  // Estatísticas das filas
  public async getQueueStats(): Promise<any> {
    await this.ensureInitialized();
    
    const [dispatchWaiting, dispatchActive, dispatchCompleted, dispatchFailed] = await Promise.all([
      dispatchQueue.getWaiting(),
      dispatchQueue.getActive(),
      dispatchQueue.getCompleted(),
      dispatchQueue.getFailed(),
    ]);

    const [messageWaiting, messageActive, messageCompleted, messageFailed] = await Promise.all([
      messageQueue.getWaiting(),
      messageQueue.getActive(),
      messageQueue.getCompleted(),
      messageQueue.getFailed(),
    ]);

    return {
      dispatch: {
        waiting: dispatchWaiting.length,
        active: dispatchActive.length,
        completed: dispatchCompleted.length,
        failed: dispatchFailed.length,
      },
      messages: {
        waiting: messageWaiting.length,
        active: messageActive.length,
        completed: messageCompleted.length,
        failed: messageFailed.length,
      },
      redis: redisSimulator.getStats(),
    };
  }

  private async logQueueStats(): Promise<void> {
    const stats = await this.getQueueStats();
    console.log('📊 [QUEUE-MANAGER] Estatísticas das filas:', JSON.stringify(stats, null, 2));
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

  // Cleanup ao fechar aplicação
  public async cleanup(): Promise<void> {
    console.log('🧹 [QUEUE-MANAGER] Iniciando cleanup...');
    
    try {
      // Fechar workers
      await Promise.all(this.workers.map(worker => worker.close()));
      
      // Fechar filas
      await Promise.all([
        dispatchQueue.close(),
        messageQueue.close(),
        statusQueue.close(),
      ]);
      
      // Desconectar Redis
      await redisSimulator.disconnect();
      
      console.log('✅ [QUEUE-MANAGER] Cleanup concluído');
    } catch (error) {
      console.error('❌ [QUEUE-MANAGER] Erro no cleanup:', error);
    }
  }
}

// Instância singleton
export const queueManager = new QueueManager();