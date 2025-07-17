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
    console.log('🔧 [USER-ISOLATED-RR] Serviço inicializado com isolamento completo por usuário');
  }

  /**
   * Inicializar slots de um usuário específico
   */
  async initializeUserSlots(userId: string, clientId: string): Promise<void> {
    console.log(`🔧 [USER-ISOLATED-RR] Inicializando slots para usuário ${userId} (cliente ${clientId})`);
    
    try {
      // Buscar conexões ativas do usuário via simpleMultiBaileyService
      const connectionsStatus = await simpleMultiBaileyService.getClientConnections(clientId);
      const activeConnections = connectionsStatus.connections?.filter(conn => conn.isConnected) || [];
      
      const userSlots: UserSlot[] = [];
      
      // Criar slots isolados para este usuário
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
      
      this.userSlots.set(userId, userSlots);
      
      console.log(`✅ [USER-ISOLATED-RR] ${userSlots.length} slots inicializados para usuário ${userId}`);
      console.log(`📱 [USER-ISOLATED-RR] Slots ativos: [${userSlots.map(s => s.slotNumber).join(', ')}]`);
      
    } catch (error) {
      console.error(`❌ [USER-ISOLATED-RR] Erro ao inicializar slots do usuário ${userId}:`, error);
      this.userSlots.set(userId, []);
    }
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
    
    console.log(`⚙️ [USER-ISOLATED-RR] Configuração de cadência definida para usuário ${userId}:`, userConfig);
  }

  /**
   * Ativar modo imediato para resposta "1" de um usuário
   */
  async activateImmediateCadence(userId: string, clientId: string, candidatePhone: string): Promise<void> {
    console.log(`🚀 [USER-ISOLATED-RR] Ativando cadência IMEDIATA para usuário ${userId} - contato ${candidatePhone}`);
    
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
    
    // Criar cadência imediata
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
    
    console.log(`✅ [USER-ISOLATED-RR] Cadência imediata ativada para usuário ${userId}`);
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
    
    console.log(`🔄 [USER-ISOLATED-RR] Distribuindo ${candidates.length} candidatos para usuário ${userId}`);
    
    // Inicializar slots se necessário
    if (!this.userSlots.has(userId)) {
      await this.initializeUserSlots(userId, clientId);
    }
    
    const activeSlots = this.getUserActiveSlots(userId);
    
    if (activeSlots.length === 0) {
      console.log(`❌ [USER-ISOLATED-RR] Nenhum slot ativo para usuário ${userId}`);
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
    
    console.log(`✅ [USER-ISOLATED-RR] Distribuição concluída para usuário ${userId}:`);
    distributions.forEach(dist => {
      console.log(`📱 [USER-ISOLATED-RR] Slot ${dist.slotNumber}: ${dist.candidates.length} candidatos (${dist.estimatedTime}ms)`);
    });
    
    return distributions;
  }

  /**
   * Processar cadência isolada de um usuário
   */
  async processUserCadence(userId: string, clientId: string): Promise<void> {
    const cadence = this.userCadences.get(userId);
    if (!cadence || !cadence.isActive) {
      console.log(`⚠️ [USER-ISOLATED-RR] Nenhuma cadência ativa para usuário ${userId}`);
      return;
    }
    
    const distributions = this.activeDistributions.get(userId) || [];
    const userConfig = this.userConfigs.get(userId);
    
    console.log(`🚀 [USER-ISOLATED-RR] Iniciando processamento de cadência para usuário ${userId}`);
    
    // Processar cada distribuição (slot) de forma isolada
    for (const distribution of distributions) {
      console.log(`📱 [USER-ISOLATED-RR] Processando slot ${distribution.slotNumber} do usuário ${userId}`);
      
      for (let i = 0; i < distribution.candidates.length; i++) {
        const candidatePhone = distribution.candidates[i];
        
        try {
          // Enviar mensagem usando slot específico do usuário
          const result = await simpleMultiBaileyService.sendMessage(
            clientId, 
            candidatePhone, 
            `Mensagem para ${candidatePhone}`, // Aqui você colocaria a mensagem real
            distribution.slotNumber
          );
          
          if (result?.success) {
            cadence.totalSent++;
            console.log(`✅ [USER-ISOLATED-RR] Mensagem enviada para ${candidatePhone} via slot ${distribution.slotNumber}`);
          } else {
            cadence.totalErrors++;
            console.log(`❌ [USER-ISOLATED-RR] Erro ao enviar para ${candidatePhone}:`, result?.error);
          }
          
          // Aplicar delay específico do usuário (não interfere com outros usuários)
          if (i < distribution.candidates.length - 1) {
            const delay = userConfig?.immediateMode ? 500 : (userConfig?.baseDelay || 1000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
        } catch (error) {
          cadence.totalErrors++;
          console.error(`❌ [USER-ISOLATED-RR] Erro ao processar candidato ${candidatePhone}:`, error);
        }
      }
    }
    
    // Atualizar taxa de sucesso
    cadence.successRate = cadence.totalSent / (cadence.totalSent + cadence.totalErrors);
    
    console.log(`✅ [USER-ISOLATED-RR] Cadência concluída para usuário ${userId}:`);
    console.log(`📊 [USER-ISOLATED-RR] Total enviado: ${cadence.totalSent}, Erros: ${cadence.totalErrors}, Taxa: ${(cadence.successRate * 100).toFixed(1)}%`);
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
      console.log(`🛑 [USER-ISOLATED-RR] Cadência parada para usuário ${userId}`);
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
    
    console.log(`🧹 [USER-ISOLATED-RR] Dados limpos para usuário ${userId}`);
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
          console.error(`❌ [USER-ISOLATED-RR] VIOLAÇÃO DE ISOLAMENTO: Usuários ${userA} e ${userB} compartilham números!`);
          return false;
        }
      }
    }
    
    console.log(`✅ [USER-ISOLATED-RR] Isolamento validado - nenhuma interferência entre usuários`);
    return true;
  }
}

export const userIsolatedRoundRobin = new UserIsolatedRoundRobin();
export default userIsolatedRoundRobin;