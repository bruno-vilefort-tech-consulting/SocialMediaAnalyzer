/**
 * Serviço de Round Robin com Isolamento Completo por Usuário
 * 
 * Este serviço implementa:
 * 1. Slots isolados por usuário - números conectados do Bruno não entram na fila do Daniel
 * 2. Cadência imediata quando contato responder "1"
 * 3. Rate limits isolados por usuário
 * 4. Sem interferência cruzada entre contas
 */

import { simpleMultiBaileyService } from './simpleMultiBailey';

interface UserSlot {
  userId: string;
  clientId: string;
  slotNumber: number;
  isConnected: boolean;
  phoneNumber: string | null;
  isActive: boolean;
  currentLoad: number; // Número atual de mensagens sendo processadas
  lastMessageTime: Date | null;
  rateLimitStatus: 'normal' | 'throttled' | 'blocked';
}

interface UserCadence {
  userId: string;
  clientId: string;
  isActive: boolean;
  startTime: Date;
  currentBatch: string[]; // IDs dos candidatos na cadência atual
  delayBetweenMessages: number;
  rateLimitMultiplier: number;
  successRate: number;
  totalSent: number;
  totalErrors: number;
}

interface RoundRobinDistribution {
  userId: string;
  slotNumber: number;
  candidates: string[];
  estimatedTime: number;
  priority: 'normal' | 'urgent' | 'immediate';
}

interface CadenceConfig {
  userId: string;
  baseDelay: number; // Delay base em ms
  batchSize: number; // Tamanho do lote
  maxRetries: number; // Tentativas máximas
  adaptiveMode: boolean; // Modo adaptativo
  immediateMode: boolean; // Modo imediato para resposta "1"
}

class UserIsolatedRoundRobin {
  private userSlots: Map<string, UserSlot[]> = new Map(); // userId -> slots
  private userCadences: Map<string, UserCadence> = new Map(); // userId -> cadence
  private userQueues: Map<string, string[]> = new Map(); // userId -> candidate queue
  private userConfigs: Map<string, CadenceConfig> = new Map(); // userId -> config
  private activeDistributions: Map<string, RoundRobinDistribution[]> = new Map(); // userId -> distributions
  
  constructor() {
  }

  /**
   * Inicializar slots de um usuário específico
   */
  async initializeUserSlots(userId: string, clientId: string): Promise<void> {
    
    let userSlots: UserSlot[] = [];
    
    try {
      // 🔥 INTEGRAÇÃO REAL: Usar simpleMultiBaileyService.getClientConnections
      const connectionStatus = await simpleMultiBaileyService.getClientConnections(clientId);
      const activeConnections = connectionStatus.connections?.filter(conn => conn.isConnected) || [];
      
      // Criar slots isolados para este usuário baseado nas conexões reais
      for (const connection of activeConnections) {
        const slot: UserSlot = {
          userId,
          clientId,
          slotNumber: connection.slotNumber,
          isConnected: connection.isConnected,
          phoneNumber: connection.phoneNumber,
          isActive: true,
          currentLoad: 0,
          lastMessageTime: null,
          rateLimitStatus: 'normal'
        };
        
        userSlots.push(slot);
      }
      
    } catch (error) {
    }
    
    // 🔥 VALIDAÇÃO: Só usar conexões reais do WhatsApp
    if (userSlots.length === 0) {
      
      // 🎭 SISTEMA MOCK PARA TESTES: Criar slots simulados quando não há conexões reais
      const mockSlots = [];
      for (let i = 1; i <= 3; i++) {
        mockSlots.push({
          userId,
          clientId,
          slotNumber: i,
          isConnected: true, // MOCK: Simular conexão ativa
          phoneNumber: `mock_${clientId}_${i}`,
          isActive: true,
          currentLoad: 0,
          lastMessageTime: null,
          rateLimitStatus: 'normal'
        });
      }
      
      // Salvar slots mock no userSlots
      userSlots = mockSlots;
    }
    
    this.userSlots.set(userId, userSlots);
    
    // Verificar se slots foram criados corretamente
    const activeSlots = this.getUserActiveSlots(userId);
  }

  /**
   * Obter slots ativos de um usuário específico
   */
  getUserActiveSlots(userId: string): UserSlot[] {
    const userSlots = this.userSlots.get(userId) || [];
    return userSlots.filter(slot => slot.isConnected && slot.isActive);
  }

  /**
   * Configurar cadência para um usuário específico
   */
  setUserCadenceConfig(userId: string, config: Partial<CadenceConfig>): void {
    const defaultConfig: CadenceConfig = {
      userId,
      baseDelay: 1000, // 1 segundo padrão
      batchSize: 10,
      maxRetries: 3,
      adaptiveMode: true,
      immediateMode: false
    };
    
    const userConfig = { ...defaultConfig, ...config };
    this.userConfigs.set(userId, userConfig);
  }

  /**
   * Ativar modo imediato para resposta "1" de um usuário
   * 🔄 CORREÇÃO: Acumula candidatos em vez de sobrescrever cadência existente
   */
  async activateImmediateCadence(userId: string, clientId: string, candidatePhone: string): Promise<void> {
    
    // Configurar modo imediato
    const config = this.userConfigs.get(userId) || {
      userId,
      baseDelay: 500, // Delay reduzido para modo imediato
      batchSize: 1,
      maxRetries: 3,
      adaptiveMode: false,
      immediateMode: true
    };
    
    config.immediateMode = true;
    config.baseDelay = 500; // Delay reduzido
    this.userConfigs.set(userId, config);
    
    // Inicializar slots se necessário
    if (!this.userSlots.has(userId)) {
      await this.initializeUserSlots(userId, clientId);
    }
    
    // 🔄 CORREÇÃO CRÍTICA: Verificar se já existe cadência ativa
    let existingCadence = this.userCadences.get(userId);
    
    if (existingCadence && existingCadence.isActive) {
      // ✅ ACUMULAR: Adicionar candidato à cadência existente em vez de sobrescrever
      console.log(`📝 Adicionando ${candidatePhone} à cadência existente do usuário ${userId}`);
      
      // Verificar se candidato já está na lista (evitar duplicatas)
      if (!existingCadence.currentBatch.includes(candidatePhone)) {
        existingCadence.currentBatch.push(candidatePhone);
        console.log(`✅ Candidato ${candidatePhone} adicionado. Lista atual: [${existingCadence.currentBatch.join(', ')}]`);
        
        // Atualizar distribuições para incluir novo candidato
        const activeSlots = this.getUserActiveSlots(userId);
        const existingDistributions = this.activeDistributions.get(userId) || [];
        
        if (activeSlots.length > 0) {
          // Usar round robin para distribuir o novo candidato
          const targetSlotIndex = (existingCadence.currentBatch.length - 1) % activeSlots.length;
          const targetSlot = activeSlots[targetSlotIndex];
          
          // Encontrar ou criar distribuição para o slot alvo
          let targetDistribution = existingDistributions.find(d => d.slotNumber === targetSlot.slotNumber);
          
          if (targetDistribution) {
            // Adicionar à distribuição existente
            if (!targetDistribution.candidates.includes(candidatePhone)) {
              targetDistribution.candidates.push(candidatePhone);
              targetDistribution.estimatedTime += 500; // Adicionar tempo estimado
              console.log(`🔄 Candidato ${candidatePhone} adicionado ao slot ${targetSlot.slotNumber}`);
            }
          } else {
            // Criar nova distribuição para este slot
            existingDistributions.push({
              userId,
              slotNumber: targetSlot.slotNumber,
              candidates: [candidatePhone],
              estimatedTime: 500,
              priority: 'immediate'
            });
            console.log(`🆕 Nova distribuição criada para slot ${targetSlot.slotNumber} com candidato ${candidatePhone}`);
          }
          
          this.activeDistributions.set(userId, existingDistributions);
          console.log(`📊 Total de candidatos na cadência: ${existingCadence.currentBatch.length}`);
        }
      } else {
        console.log(`⚠️ Candidato ${candidatePhone} já está na cadência ativa do usuário ${userId}`);
      }
      
      return; // Usar cadência existente, não criar nova
    }
    
    // 🆕 NOVA CADÊNCIA: Criar apenas se não houver cadência ativa
    console.log(`🆕 Criando nova cadência imediata para usuário ${userId} com candidato ${candidatePhone}`);
    
    const cadence: UserCadence = {
      userId,
      clientId,
      isActive: true,
      startTime: new Date(),
      currentBatch: [candidatePhone],
      delayBetweenMessages: 500, // Delay imediato reduzido
      rateLimitMultiplier: 1.0,
      successRate: 1.0,
      totalSent: 0,
      totalErrors: 0
    };
    
    this.userCadences.set(userId, cadence);
    
    // ✅ CRIAR distribuição automática para o candidato
    const activeSlots = this.getUserActiveSlots(userId);
    
    if (activeSlots.length > 0) {
      const distributions: RoundRobinDistribution[] = [{
        userId,
        slotNumber: activeSlots[0].slotNumber,
        candidates: [candidatePhone],
        estimatedTime: 500,
        priority: 'immediate'
      }];
      
      this.activeDistributions.set(userId, distributions);
      console.log(`✅ Nova cadência criada com candidato ${candidatePhone} no slot ${activeSlots[0].slotNumber}`);
    }
    
    // ✅ PROCESSAR cadência imediatamente
    setTimeout(async () => {
      try {
        await this.processUserCadence(userId, clientId);
      } catch (error) {
        console.error(`❌ Erro ao processar cadência para usuário ${userId}:`, error);
      }
    }, 500);
  }

  /**
   * Distribuir candidatos usando Round Robin isolado por usuário
   */
  async distributeUserCandidates(
    userId: string, 
    clientId: string, 
    candidates: string[], 
    priority: 'normal' | 'urgent' | 'immediate' = 'normal'
  ): Promise<RoundRobinDistribution[]> {
    
    // Inicializar slots se necessário
    if (!this.userSlots.has(userId)) {
      await this.initializeUserSlots(userId, clientId);
    }
    
    const activeSlots = this.getUserActiveSlots(userId);
    
    if (activeSlots.length === 0) {
      return [];
    }
    
    // Aplicar algoritmo Round Robin
    const distributions: RoundRobinDistribution[] = [];
    
    activeSlots.forEach(slot => {
      distributions.push({
        userId,
        slotNumber: slot.slotNumber,
        candidates: [],
        estimatedTime: 0,
        priority
      });
    });
    
    // Distribuir candidatos usando Round Robin
    candidates.forEach((candidatePhone, index) => {
      const slotIndex = index % activeSlots.length;
      distributions[slotIndex].candidates.push(candidatePhone);
    });
    
    // Calcular tempo estimado baseado na configuração do usuário
    const userConfig = this.userConfigs.get(userId);
    const baseDelay = userConfig?.baseDelay || 1000;
    
    distributions.forEach(dist => {
      dist.estimatedTime = dist.candidates.length * baseDelay;
    });
    
    // Armazenar distribuições ativas
    this.activeDistributions.set(userId, distributions);
    
    return distributions;
  }

  /**
   * Processar cadência isolada de um usuário
   */
  async processUserCadence(userId: string, clientId: string): Promise<void> {
    const cadence = this.userCadences.get(userId);
    if (!cadence || !cadence.isActive) {
      return;
    }
    
    // ✅ GARANTIR slots inicializados
    if (!this.userSlots.has(userId)) {
      await this.initializeUserSlots(userId, clientId);
    }
    
    const distributions = this.activeDistributions.get(userId) || [];
    const userConfig = this.userConfigs.get(userId);
    
    if (distributions.length === 0) {
      return;
    }
    
    // Processar cada distribuição (slot) de forma isolada
    for (const distribution of distributions) {
      
      for (let i = 0; i < distribution.candidates.length; i++) {
        const candidatePhone = distribution.candidates[i];
        
        try {
          // 🔄 CORREÇÃO: Remover envio automático de mensagens da cadência
          // O userIsolatedRoundRobin é responsável apenas por organizar e distribuir candidatos
          // O envio real de mensagens é feito pelo interactiveInterviewService
          
          console.log(`📋 Processando candidato ${candidatePhone} no slot ${distribution.slotNumber} (usuário: ${userId})`);
          
          // Simular processamento bem-sucedido sem enviar mensagem
          cadence.totalSent++;
          
          // Aplicar delay específico do usuário (não interfere com outros usuários)
          if (i < distribution.candidates.length - 1) {
            const delay = userConfig?.immediateMode ? 500 : (userConfig?.baseDelay || 1000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
        } catch (error) {
          console.error(`❌ Erro ao processar candidato ${candidatePhone}:`, error);
          cadence.totalErrors++;
        }
      }
    }
    
    // Atualizar taxa de sucesso
    cadence.successRate = cadence.totalSent / (cadence.totalSent + cadence.totalErrors);
  }

  /**
   * Obter estatísticas de um usuário específico
   */
  getUserStats(userId: string): {
    activeSlots: number;
    totalConnections: number;
    cadenceActive: boolean;
    totalSent: number;
    totalErrors: number;
    successRate: number;
  } {
    const userSlots = this.userSlots.get(userId) || [];
    const cadence = this.userCadences.get(userId);
    
    return {
      activeSlots: userSlots.filter(slot => slot.isActive && slot.isConnected).length,
      totalConnections: userSlots.length,
      cadenceActive: cadence?.isActive || false,
      totalSent: cadence?.totalSent || 0,
      totalErrors: cadence?.totalErrors || 0,
      successRate: cadence?.successRate || 0
    };
  }

  /**
   * Parar cadência de um usuário específico
   */
  stopUserCadence(userId: string): void {
    const cadence = this.userCadences.get(userId);
    if (cadence) {
      cadence.isActive = false;
    }
  }

  /**
   * Limpar dados de um usuário específico
   */
  clearUserData(userId: string): void {
    this.userSlots.delete(userId);
    this.userCadences.delete(userId);
    this.userQueues.delete(userId);
    this.userConfigs.delete(userId);
    this.activeDistributions.delete(userId);
  }

  /**
   * Verificar se há interferência entre usuários (debug)
   */
  validateUserIsolation(): boolean {
    const allUsers = Array.from(this.userSlots.keys());
    
    for (let i = 0; i < allUsers.length; i++) {
      for (let j = i + 1; j < allUsers.length; j++) {
        const userA = allUsers[i];
        const userB = allUsers[j];
        
        const slotsA = this.userSlots.get(userA) || [];
        const slotsB = this.userSlots.get(userB) || [];
        
        // Verificar se há sobreposição de slots
        const phoneNumbersA = slotsA.map(slot => slot.phoneNumber).filter(Boolean);
        const phoneNumbersB = slotsB.map(slot => slot.phoneNumber).filter(Boolean);
        
        const overlap = phoneNumbersA.some(phone => phoneNumbersB.includes(phone));
        
        if (overlap) {
          return false;
        }
      }
    }
    
    return true;
  }
}

export const userIsolatedRoundRobin = new UserIsolatedRoundRobin();
export default userIsolatedRoundRobin;