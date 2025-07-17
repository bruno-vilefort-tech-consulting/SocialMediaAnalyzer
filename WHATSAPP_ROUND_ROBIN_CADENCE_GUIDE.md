# Guia Completo: Estratégia Round Robin para Cadência de Mensagens WhatsApp

## Índice
1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Algoritmo Round Robin](#algoritmo-round-robin)
4. [Sistema de Slots](#sistema-de-slots)
5. [Cadência e Rate Limiting](#cadência-e-rate-limiting)
6. [Sistema de Filas](#sistema-de-filas)
7. [Distribuição de Carga](#distribuição-de-carga)
8. [Delay Adaptativo](#delay-adaptativo)
9. [Configurações Anti-Spam](#configurações-anti-spam)
10. [Monitoramento e Métricas](#monitoramento-e-métricas)
11. [Casos de Uso Práticos](#casos-de-uso-práticos)
12. [Troubleshooting](#troubleshooting)

## Visão Geral

O sistema de cadência Round Robin para WhatsApp é uma arquitetura avançada projetada para distribuir mensagens de forma equilibrada entre múltiplas conexões WhatsApp, evitando rate limits e garantindo alta taxa de entrega.

### Conceitos Fundamentais

- **Round Robin**: Algoritmo de distribuição circular que alterna entre slots disponíveis
- **Cadência**: Controle temporal entre envios para evitar detecção como spam
- **Rate Limiting**: Sistema de proteção contra limites de taxa do WhatsApp
- **Slots**: Conexões WhatsApp independentes (máximo 3 por cliente)
- **Batch Processing**: Processamento em lotes para otimizar performance

### Benefícios do Sistema

1. **Alta Disponibilidade**: Múltiplas conexões garantem continuidade
2. **Evita Rate Limits**: Distribuição inteligente previne bloqueios
3. **Escalabilidade**: Suporta grandes volumes de mensagens
4. **Adaptabilidade**: Ajusta automaticamente baseado na resposta do sistema
5. **Resiliência**: Recuperação automática de falhas

## Arquitetura do Sistema

### Fluxo Completo

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Seleção de    │    │   Distribuição  │    │   Slots de      │
│   Candidatos    │────▶│   Round Robin   │────▶│   WhatsApp      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Lista de 1000   │    │ Algoritmo de    │    │ Slot 1: 334     │
│ Candidatos      │    │ Distribuição    │    │ Slot 2: 333     │
│                 │    │ Equitativa      │    │ Slot 3: 333     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Rate Limiting   │    │ Sistema de      │    │ Envio com       │
│ Configurado     │    │ Filas (Queue)   │    │ Delay Adaptativo│
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Componentes Principais

#### 1. Distribuidor Round Robin
```typescript
function distributeToSlots<T>(items: T[], slots: any[]): { slotNumber: number; items: T[] }[] {
  console.log(`🔧 [distributeToSlots] items: ${items.length}, slots: ${slots.length}`);
  
  if (!slots || slots.length === 0) {
    console.log(`❌ [distributeToSlots] Nenhum slot disponível`);
    return [];
  }
  
  const distribution: { slotNumber: number; items: T[] }[] = slots.map(slot => ({
    slotNumber: slot.slotNumber,
    items: []
  }));
  
  items.forEach((item, index) => {
    const slotIndex = index % slots.length;
    distribution[slotIndex].items.push(item);
  });
  
  return distribution;
}
```

#### 2. Configuração de Rate Limiting
```typescript
interface RateLimitConfig {
  delayPerMessage: number;     // Delay base entre mensagens (ms)
  batchSize: number;           // Tamanho do lote
  maxRetries: number;          // Máximo de tentativas
  estimatedTime: number;       // Tempo estimado total
}

// Configuração padrão
const defaultRateLimitConfig = {
  delayPerMessage: 1000,       // 1 segundo
  batchSize: 10,               // 10 mensagens por lote
  maxRetries: 3,               // 3 tentativas
  estimatedTime: 60            // 1 minuto estimado
};
```

## Algoritmo Round Robin

### Implementação Detalhada

#### Passo 1: Identificação de Slots Ativos
```typescript
// Buscar conexões ativas para o cliente
const connectionsStatus = await simpleMultiBaileyService.getClientConnections(clientId);
const activeConnections = connectionsStatus.connections?.filter(conn => conn.isConnected) || [];

console.log(`📱 [ROUND-ROBIN] Slots ativos: [${activeConnections.map(c => c.slotNumber).join(', ')}]`);
console.log(`📊 [ROUND-ROBIN] Distribuição entre ${activeConnections.length} slots`);
```

#### Passo 2: Distribuição Equitativa
```typescript
// Exemplo: 1000 candidatos, 3 slots ativos
const candidates = [...]; // 1000 candidatos
const activeSlots = [
  { slotNumber: 1, isConnected: true },
  { slotNumber: 2, isConnected: true },
  { slotNumber: 3, isConnected: true }
];

const distribution = distributeToSlots(candidates, activeSlots);
/*
Resultado:
- Slot 1: candidatos[0, 3, 6, 9, ...] = 334 candidatos
- Slot 2: candidatos[1, 4, 7, 10, ...] = 333 candidatos  
- Slot 3: candidatos[2, 5, 8, 11, ...] = 333 candidatos
*/
```

#### Passo 3: Processamento Sequencial por Slot
```typescript
for (const { slotNumber, items: slotCandidates } of slotsDistribution) {
  console.log(`🚀 [SLOT-${slotNumber}] Processando ${slotCandidates.length} candidatos`);
  
  for (let candidateIndex = 0; candidateIndex < slotCandidates.length; candidateIndex++) {
    const candidate = slotCandidates[candidateIndex];
    
    // Enviar mensagem via slot específico
    const sendResult = await simpleMultiBaileyService.sendMessage(
      clientId,
      candidate.whatsapp,
      personalizedMessage,
      slotNumber
    );
    
    // Aplicar delay entre mensagens
    if (candidateIndex < slotCandidates.length - 1) {
      const adaptiveDelay = Math.ceil(rateLimitConfig.delayPerMessage * adaptiveDelayMultiplier);
      await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
    }
  }
}
```

### Vantagens da Distribuição Round Robin

1. **Distribuição Equitativa**: Cada slot recebe aproximadamente a mesma quantidade
2. **Previsibilidade**: Comportamento determinístico
3. **Balanceamento de Carga**: Evita sobrecarregar um único slot
4. **Fault Tolerance**: Se um slot falha, outros continuam
5. **Escalabilidade Linear**: Performance melhora com mais slots

## Sistema de Slots

### Configuração de Slots por Cliente

```typescript
interface WhatsAppConnection {
  connectionId: string;     // client_id_slot_number (ex: 1749849987543_1)
  clientId: string;         // ID do cliente
  slotNumber: number;       // 1, 2, ou 3
  isConnected: boolean;     // Status da conexão
  qrCode: string | null;    // QR Code para conexão
  phoneNumber: string | null; // Número conectado
  lastConnection: Date | null; // Última conexão
  service: 'baileys' | 'wppconnect' | 'evolution'; // Serviço usado
}
```

### Gerenciamento de Slots
```typescript
class SlotManager {
  private readonly MAX_CONNECTIONS_PER_CLIENT = 3;
  private connections = new Map<string, WhatsAppConnection>();
  
  generateConnectionId(clientId: string, slotNumber: number): string {
    return `${clientId}_${slotNumber}`;
  }
  
  async getActiveSlots(clientId: string): Promise<WhatsAppConnection[]> {
    const connections = await this.getClientConnections(clientId);
    return connections.connections.filter(conn => conn.isConnected);
  }
  
  async connectSlot(clientId: string, slotNumber: number): Promise<ConnectionResult> {
    if (slotNumber < 1 || slotNumber > this.MAX_CONNECTIONS_PER_CLIENT) {
      return {
        success: false,
        message: `Slot inválido. Use valores entre 1 e ${this.MAX_CONNECTIONS_PER_CLIENT}`
      };
    }
    
    // Implementar conexão específica do slot
    const result = await this.establishConnection(clientId, slotNumber);
    return result;
  }
}
```

### Estados de Slot

1. **Disconnected**: Slot não conectado, requer QR Code
2. **Connecting**: Processo de conexão em andamento
3. **Connected**: Slot ativo e pronto para envio
4. **Error**: Falha na conexão, requer reconexão
5. **Rate Limited**: Temporariamente limitado

### Distribuição Dinâmica

```typescript
// Adaptação automática baseada em slots disponíveis
function adaptiveDistribution(candidates: Candidate[], activeSlots: Slot[]): Distribution[] {
  if (activeSlots.length === 0) {
    throw new Error('Nenhum slot ativo disponível');
  }
  
  // Calcular capacidade por slot baseada em performance histórica
  const slotCapacities = activeSlots.map(slot => ({
    slot,
    capacity: calculateSlotCapacity(slot),
    weight: calculateSlotWeight(slot)
  }));
  
  // Distribuir baseado em peso e capacidade
  const distribution = weightedDistribution(candidates, slotCapacities);
  
  return distribution;
}
```

## Cadência e Rate Limiting

### Configurações de Delay

#### Delay Base por Mensagem
```typescript
const rateLimitConfig = {
  delayPerMessage: 1000,    // 1 segundo entre mensagens
  batchSize: 10,            // 10 mensagens por lote
  maxRetries: 3,            // 3 tentativas em caso de falha
  estimatedTime: 60         // Tempo estimado em segundos
};
```

#### Delay Adaptativo
```typescript
let adaptiveDelayMultiplier = 1.0; // Multiplicador adaptativo

// Detectar rate limit e ajustar delay
if (sendResult?.error?.includes('rate') || 
    sendResult?.error?.includes('limit') ||
    sendResult?.error?.includes('spam')) {
  
  rateLimitDetected++;
  
  // Aumentar delay progressivamente
  if (rateLimitDetected > 2) {
    adaptiveDelayMultiplier = Math.min(adaptiveDelayMultiplier * 1.5, 3.0);
    console.log(`🧠 [ADAPTIVE] Delay aumentado para ${adaptiveDelayMultiplier.toFixed(1)}x`);
  }
}

// Aplicar delay adaptativo
const adaptiveDelay = Math.ceil(rateLimitConfig.delayPerMessage * adaptiveDelayMultiplier);
await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
```

### Backoff Exponencial

```typescript
// Retry com backoff exponencial em caso de rate limit
while (attempt <= maxAttempts) {
  const sendResult = await simpleMultiBaileyService.sendMessage(/*...*/);
  
  if (sendResult?.success || !isRateLimitError(sendResult?.error)) {
    break; // Sucesso ou erro não relacionado a rate limit
  }
  
  if (attempt < maxAttempts) {
    const backoffDelay = rateLimitConfig.delayPerMessage * Math.pow(2, attempt - 1);
    console.log(`🚫 [RATE-LIMIT] Backoff ${attempt}: ${backoffDelay}ms`);
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
  }
  
  attempt++;
}
```

### Rate Limiting Inteligente

#### Detecção de Padrões
```typescript
interface RateLimitDetector {
  consecutiveErrors: number;
  errorPattern: string[];
  lastErrorTime: number;
  
  detectRateLimit(error: string): boolean {
    const rateLimitKeywords = ['rate', 'limit', 'spam', 'blocked', 'too many'];
    return rateLimitKeywords.some(keyword => error.toLowerCase().includes(keyword));
  }
  
  shouldIncreaseDelay(): boolean {
    return this.consecutiveErrors >= 3 || 
           (Date.now() - this.lastErrorTime) < 60000; // Menos de 1 minuto
  }
  
  calculateOptimalDelay(baseDelay: number): number {
    const multiplier = Math.min(1 + (this.consecutiveErrors * 0.5), 5);
    return Math.ceil(baseDelay * multiplier);
  }
}
```

#### Aprendizado Adaptativo
```typescript
class AdaptiveCadenceManager {
  private successRate: number = 1.0;
  private averageResponseTime: number = 1000;
  private rateLimitHistory: number[] = [];
  
  updateMetrics(success: boolean, responseTime: number, isRateLimit: boolean): void {
    // Atualizar taxa de sucesso
    this.successRate = (this.successRate * 0.9) + (success ? 0.1 : 0);
    
    // Atualizar tempo de resposta médio
    this.averageResponseTime = (this.averageResponseTime * 0.9) + (responseTime * 0.1);
    
    // Registrar rate limits
    if (isRateLimit) {
      this.rateLimitHistory.push(Date.now());
      // Manter apenas últimos 10 registros
      this.rateLimitHistory = this.rateLimitHistory.slice(-10);
    }
  }
  
  getOptimalDelay(baseDelay: number): number {
    // Ajustar baseado na taxa de sucesso
    let delay = baseDelay;
    
    if (this.successRate < 0.8) {
      delay *= 2; // Dobrar delay se taxa de sucesso baixa
    }
    
    // Ajustar baseado em rate limits recentes
    const recentRateLimits = this.rateLimitHistory.filter(
      time => Date.now() - time < 300000 // Últimos 5 minutos
    ).length;
    
    if (recentRateLimits > 3) {
      delay *= 3; // Triplicar delay se muitos rate limits
    }
    
    return Math.ceil(delay);
  }
}
```

## Sistema de Filas

### Arquitetura de Filas

#### Tipos de Filas
1. **Dispatch Queue**: Para divisão inicial de seleções
2. **Message Queue**: Para mensagens individuais
3. **Status Queue**: Para atualizações de status
4. **Priority Queue**: Para mensagens urgentes

#### Configuração das Filas
```typescript
// Configuração das filas principais
export const dispatchQueue = new Queue('whatsapp-dispatch', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50,     // Manter 50 jobs completados
    removeOnFail: 100,        // Manter 100 jobs falhados
    attempts: 3,              // 3 tentativas
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    priority: 10,             // Prioridade alta para dispatch
  },
});

export const messageQueue = new Queue('whatsapp-messages', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    priority: 5,              // Prioridade normal para mensagens
  },
});
```

#### Workers e Concorrência
```typescript
// Worker para dispatches (dividir seleções)
const dispatchWorker = new Worker('whatsapp-dispatch', async (job) => {
  return processDispatchJob(job);
}, { 
  connection: redisConnection,
  concurrency: 3,            // Máximo 3 dispatches simultâneos
});

// Worker para mensagens individuais
const messageWorker = new Worker('whatsapp-messages', async (job) => {
  return processMessageJob(job);
}, { 
  connection: redisConnection,
  concurrency: 10,           // Máximo 10 mensagens simultâneas
});
```

### Processamento em Background

#### Job de Dispatch
```typescript
async function processDispatchJob(job: Job<WhatsAppDispatchJobData>): Promise<void> {
  const { selectionId, clientId, candidateIds, rateLimitConfig, whatsappTemplate } = job.data;
  
  // Buscar slots ativos para round-robin
  const connectionsStatus = await simpleMultiBaileyService.getClientConnections(clientId.toString());
  const activeSlots = connectionsStatus.connections?.filter(conn => conn.isConnected) || [];
  
  let currentSlotIndex = 0;
  const { batchSize, delayPerMessage } = rateLimitConfig;
  
  // Processar candidatos em lotes
  for (let i = 0; i < candidateIds.length; i += batchSize) {
    const batch = candidateIds.slice(i, i + batchSize);
    
    // Criar jobs de mensagem para cada candidato
    const messageJobs = await Promise.all(batch.map(async (candidateId, index) => {
      // Round-robin para slot
      const slot = activeSlots[currentSlotIndex % activeSlots.length];
      currentSlotIndex++;
      
      return {
        candidateId,
        slotNumber: slot.slotNumber,
        message: personalizedMessage,
        // ... outros dados
      };
    }));
    
    // Adicionar jobs à fila de mensagens com delay
    for (const [index, messageJob] of messageJobs.entries()) {
      await messageQueue.add('send-message', messageJob, {
        delay: index * delayPerMessage,
        priority: job.data.priority === 'urgent' ? 10 : 5,
      });
    }
  }
}
```

#### Job de Mensagem Individual
```typescript
async function processMessageJob(job: Job<MessageJobData>): Promise<void> {
  const { candidateName, phone, message, clientId, slotNumber } = job.data;
  
  console.log(`📱 [MESSAGE] Enviando para ${candidateName} via slot ${slotNumber}`);
  
  try {
    const result = await simpleMultiBaileyService.sendMessage(
      clientId,
      phone,
      message,
      slotNumber
    );
    
    if (result.success) {
      console.log(`✅ [MESSAGE] Enviado para ${candidateName}`);
      incrementJobProgress(job.data.jobId, 'sent');
    } else {
      throw new Error(result.error || 'Falha no envio');
    }
    
  } catch (error) {
    console.error(`❌ [MESSAGE] Erro para ${candidateName}:`, error);
    incrementJobProgress(job.data.jobId, 'failed');
    throw error;
  }
}
```

### Monitoramento de Filas

#### Métricas em Tempo Real
```typescript
interface QueueMetrics {
  pending: number;           // Jobs pendentes
  active: number;            // Jobs em processamento
  completed: number;         // Jobs completados
  failed: number;            // Jobs falhados
  delayed: number;           // Jobs com delay
  throughput: number;        // Jobs/minuto
  averageProcessingTime: number; // Tempo médio de processamento
}

async function getQueueMetrics(): Promise<QueueMetrics> {
  const waiting = await dispatchQueue.getWaiting();
  const active = await dispatchQueue.getActive();
  const completed = await dispatchQueue.getCompleted();
  const failed = await dispatchQueue.getFailed();
  const delayed = await dispatchQueue.getDelayed();
  
  return {
    pending: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
    throughput: calculateThroughput(),
    averageProcessingTime: calculateAverageTime()
  };
}
```

## Distribuição de Carga

### Load Balancing entre Slots

#### Distribuição Baseada em Performance
```typescript
interface SlotPerformance {
  slotNumber: number;
  successRate: number;
  averageResponseTime: number;
  messagesPerMinute: number;
  lastRateLimit: number;
  healthScore: number;
}

function calculateSlotWeights(slots: SlotPerformance[]): SlotWeight[] {
  return slots.map(slot => ({
    slotNumber: slot.slotNumber,
    weight: calculateWeight(slot),
    capacity: calculateCapacity(slot)
  }));
}

function calculateWeight(slot: SlotPerformance): number {
  let weight = 1.0;
  
  // Penalizar slots com baixa taxa de sucesso
  weight *= slot.successRate;
  
  // Penalizar slots lentos
  weight *= Math.max(0.1, 1 - (slot.averageResponseTime - 1000) / 10000);
  
  // Penalizar slots com rate limit recente
  const timeSinceRateLimit = Date.now() - slot.lastRateLimit;
  if (timeSinceRateLimit < 300000) { // 5 minutos
    weight *= 0.5;
  }
  
  return Math.max(0.1, weight);
}
```

#### Distribuição Ponderada
```typescript
function weightedDistribution(candidates: Candidate[], slotWeights: SlotWeight[]): Distribution[] {
  const totalWeight = slotWeights.reduce((sum, slot) => sum + slot.weight, 0);
  
  const distribution = slotWeights.map(slot => ({
    slotNumber: slot.slotNumber,
    items: [],
    targetCount: Math.floor((candidates.length * slot.weight) / totalWeight)
  }));
  
  // Distribuir candidatos baseado no peso
  let candidateIndex = 0;
  for (const dist of distribution) {
    for (let i = 0; i < dist.targetCount && candidateIndex < candidates.length; i++) {
      dist.items.push(candidates[candidateIndex++]);
    }
  }
  
  // Distribuir candidatos restantes
  let slotIndex = 0;
  while (candidateIndex < candidates.length) {
    distribution[slotIndex % distribution.length].items.push(candidates[candidateIndex++]);
    slotIndex++;
  }
  
  return distribution;
}
```

### Circuit Breaker Pattern

```typescript
class SlotCircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  private readonly failureThreshold = 5;
  private readonly recoveryTimeout = 60000; // 1 minuto
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

## Delay Adaptativo

### Sistema de Aprendizado

#### Coleta de Métricas
```typescript
interface MessageMetrics {
  timestamp: number;
  slotNumber: number;
  success: boolean;
  responseTime: number;
  errorType?: string;
  isRateLimit: boolean;
}

class AdaptiveDelayManager {
  private metrics: MessageMetrics[] = [];
  private currentDelay: number = 1000;
  private maxMetrics: number = 1000;
  
  recordMetric(metric: MessageMetrics): void {
    this.metrics.push(metric);
    
    // Manter apenas métricas recentes
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    this.updateDelay();
  }
  
  private updateDelay(): void {
    const recentMetrics = this.getRecentMetrics(300000); // Últimos 5 minutos
    
    if (recentMetrics.length < 10) return; // Dados insuficientes
    
    const successRate = recentMetrics.filter(m => m.success).length / recentMetrics.length;
    const rateLimitRate = recentMetrics.filter(m => m.isRateLimit).length / recentMetrics.length;
    
    // Ajustar delay baseado nas métricas
    if (rateLimitRate > 0.1) { // Mais de 10% rate limit
      this.currentDelay = Math.min(this.currentDelay * 1.5, 10000);
    } else if (successRate > 0.95 && rateLimitRate < 0.05) { // Alta taxa de sucesso
      this.currentDelay = Math.max(this.currentDelay * 0.9, 500);
    }
  }
  
  getOptimalDelay(): number {
    return this.currentDelay;
  }
}
```

#### Algoritmo de Ajuste Automático
```typescript
function calculateDynamicDelay(
  baseDelay: number,
  recentSuccessRate: number,
  rateLimitHistory: number[],
  slotPerformance: SlotPerformance
): number {
  let adjustedDelay = baseDelay;
  
  // Fator 1: Taxa de sucesso
  if (recentSuccessRate < 0.8) {
    adjustedDelay *= 2; // Dobrar se baixa taxa de sucesso
  } else if (recentSuccessRate > 0.95) {
    adjustedDelay *= 0.8; // Reduzir se alta taxa de sucesso
  }
  
  // Fator 2: Rate limits recentes
  const recentRateLimits = rateLimitHistory.filter(
    time => Date.now() - time < 600000 // Últimos 10 minutos
  ).length;
  
  if (recentRateLimits > 0) {
    adjustedDelay *= (1 + recentRateLimits * 0.5);
  }
  
  // Fator 3: Performance do slot
  if (slotPerformance.averageResponseTime > 3000) {
    adjustedDelay *= 1.3; // Aumentar para slots lentos
  }
  
  // Fator 4: Hora do dia (opcional)
  const hour = new Date().getHours();
  if (hour >= 9 && hour <= 18) { // Horário comercial
    adjustedDelay *= 1.2; // Aumentar durante horário comercial
  }
  
  // Limites mínimo e máximo
  return Math.max(300, Math.min(adjustedDelay, 15000));
}
```

### Estratégias de Delay

#### Delay Progressivo
```typescript
class ProgressiveDelayStrategy {
  private baseDelay: number = 1000;
  private currentMultiplier: number = 1.0;
  private maxMultiplier: number = 5.0;
  
  getNextDelay(isSuccess: boolean, isRateLimit: boolean): number {
    if (isRateLimit) {
      this.currentMultiplier = Math.min(this.currentMultiplier * 1.5, this.maxMultiplier);
    } else if (isSuccess) {
      this.currentMultiplier = Math.max(this.currentMultiplier * 0.95, 1.0);
    }
    
    return Math.ceil(this.baseDelay * this.currentMultiplier);
  }
  
  reset(): void {
    this.currentMultiplier = 1.0;
  }
}
```

#### Delay Baseado em Horário
```typescript
function getTimeBasedDelay(baseDelay: number): number {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  
  // Fatores de ajuste por horário
  const hourFactors = {
    0: 0.7,   // Madrugada - menor delay
    1: 0.7,
    2: 0.7,
    3: 0.7,
    4: 0.7,
    5: 0.8,
    6: 0.9,
    7: 1.0,
    8: 1.2,   // Horário comercial - maior delay
    9: 1.3,
    10: 1.3,
    11: 1.3,
    12: 1.2,
    13: 1.2,
    14: 1.3,
    15: 1.3,
    16: 1.3,
    17: 1.2,
    18: 1.1,
    19: 1.0,
    20: 0.9,
    21: 0.8,
    22: 0.8,
    23: 0.7
  };
  
  // Fator adicional para fins de semana
  const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.8 : 1.0;
  
  const hourFactor = hourFactors[hour] || 1.0;
  
  return Math.ceil(baseDelay * hourFactor * weekendFactor);
}
```

## Configurações Anti-Spam

### Detecção de Padrões de Spam

#### Características de Spam
```typescript
interface SpamIndicators {
  messagesSentLastHour: number;
  messagesSentLastDay: number;
  consecutiveFailures: number;
  rateLimitHits: number;
  identicalMessageCount: number;
  rapidSendingPattern: boolean;
}

function analyzeSpamRisk(indicators: SpamIndicators): SpamRiskLevel {
  let riskScore = 0;
  
  // Fator 1: Volume de mensagens
  if (indicators.messagesSentLastHour > 100) riskScore += 3;
  if (indicators.messagesSentLastDay > 1000) riskScore += 5;
  
  // Fator 2: Falhas consecutivas
  if (indicators.consecutiveFailures > 5) riskScore += 4;
  
  // Fator 3: Rate limits
  if (indicators.rateLimitHits > 3) riskScore += 6;
  
  // Fator 4: Mensagens idênticas
  if (indicators.identicalMessageCount > 50) riskScore += 4;
  
  // Fator 5: Padrão de envio rápido
  if (indicators.rapidSendingPattern) riskScore += 3;
  
  if (riskScore >= 15) return 'HIGH';
  if (riskScore >= 10) return 'MEDIUM';
  if (riskScore >= 5) return 'LOW';
  return 'MINIMAL';
}
```

#### Medidas Preventivas
```typescript
class AntiSpamManager {
  private messageHistory: Map<string, number[]> = new Map();
  private dailyLimits = {
    messagesPerHour: 200,
    messagesPerDay: 2000,
    identicalMessages: 100
  };
  
  async validateSendPermission(
    clientId: string, 
    message: string, 
    recipientCount: number
  ): Promise<ValidationResult> {
    const now = Date.now();
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;
    
    // Verificar histórico do cliente
    const history = this.messageHistory.get(clientId) || [];
    const messagesLastHour = history.filter(time => time > hourAgo).length;
    const messagesLastDay = history.filter(time => time > dayAgo).length;
    
    // Verificar limites
    if (messagesLastHour + recipientCount > this.dailyLimits.messagesPerHour) {
      return {
        allowed: false,
        reason: 'Limite de mensagens por hora excedido',
        waitTime: 3600000 - (now - Math.max(...history.filter(time => time > hourAgo)))
      };
    }
    
    if (messagesLastDay + recipientCount > this.dailyLimits.messagesPerDay) {
      return {
        allowed: false,
        reason: 'Limite de mensagens diárias excedido',
        waitTime: 86400000 - (now - Math.max(...history.filter(time => time > dayAgo)))
      };
    }
    
    return { allowed: true };
  }
  
  recordMessageSent(clientId: string): void {
    const history = this.messageHistory.get(clientId) || [];
    history.push(Date.now());
    
    // Manter apenas últimas 24h
    const dayAgo = Date.now() - 86400000;
    const recentHistory = history.filter(time => time > dayAgo);
    
    this.messageHistory.set(clientId, recentHistory);
  }
}
```

### Randomização Inteligente

#### Variação de Delay
```typescript
function addRandomizedDelay(baseDelay: number): number {
  // Adicionar variação de ±20% ao delay
  const variation = 0.2;
  const randomFactor = 1 + (Math.random() - 0.5) * 2 * variation;
  
  return Math.ceil(baseDelay * randomFactor);
}
```

#### Personalização de Mensagens
```typescript
function addMessageVariation(template: string, candidate: Candidate): string {
  const variations = {
    greeting: ['Olá', 'Oi', 'Bom dia', 'Boa tarde'],
    closing: ['Atenciosamente', 'Cordialmente', 'Aguardamos seu retorno', 'Obrigado']
  };
  
  let message = template;
  
  // Adicionar saudação aleatória
  const randomGreeting = variations.greeting[Math.floor(Math.random() * variations.greeting.length)];
  message = message.replace('[saudacao]', randomGreeting);
  
  // Adicionar fechamento aleatório
  const randomClosing = variations.closing[Math.floor(Math.random() * variations.closing.length)];
  message = message.replace('[fechamento]', randomClosing);
  
  return message;
}
```

## Monitoramento e Métricas

### Dashboard em Tempo Real

#### Métricas Principais
```typescript
interface CadenceMetrics {
  totalMessages: number;
  messagesSent: number;
  messagesQueued: number;
  messagesFailed: number;
  
  slotsActive: number;
  slotsTotal: number;
  
  averageDelay: number;
  currentThroughput: number; // mensagens/minuto
  
  rateLimitDetections: number;
  adaptiveDelayActive: boolean;
  
  estimatedCompletion: Date;
  elapsedTime: number;
}
```

#### Coleta de Métricas
```typescript
class MetricsCollector {
  private metrics: CadenceMetrics;
  private startTime: number;
  
  constructor() {
    this.startTime = Date.now();
    this.initializeMetrics();
  }
  
  updateMessageSent(slotNumber: number, responseTime: number): void {
    this.metrics.messagesSent++;
    this.updateThroughput();
    this.updateAverageDelay(responseTime);
    
    // Atualizar métricas por slot
    this.updateSlotMetrics(slotNumber, true, responseTime);
  }
  
  updateMessageFailed(slotNumber: number, error: string): void {
    this.metrics.messagesFailed++;
    
    if (this.isRateLimitError(error)) {
      this.metrics.rateLimitDetections++;
    }
    
    this.updateSlotMetrics(slotNumber, false, 0);
  }
  
  getSnapshot(): CadenceMetrics {
    this.metrics.elapsedTime = Date.now() - this.startTime;
    return { ...this.metrics };
  }
}
```

### Alertas e Notificações

#### Sistema de Alertas
```typescript
interface Alert {
  type: 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  timestamp: number;
  data?: any;
}

class AlertManager {
  private alerts: Alert[] = [];
  
  checkAlerts(metrics: CadenceMetrics): Alert[] {
    const newAlerts: Alert[] = [];
    
    // Alerta: Taxa de falha alta
    const failureRate = metrics.messagesFailed / (metrics.messagesSent + metrics.messagesFailed);
    if (failureRate > 0.1) {
      newAlerts.push({
        type: 'WARNING',
        message: `Alta taxa de falha detectada: ${(failureRate * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        data: { failureRate, totalFailed: metrics.messagesFailed }
      });
    }
    
    // Alerta: Muitos rate limits
    if (metrics.rateLimitDetections > 10) {
      newAlerts.push({
        type: 'ERROR',
        message: `Múltiplos rate limits detectados: ${metrics.rateLimitDetections}`,
        timestamp: Date.now(),
        data: { rateLimitCount: metrics.rateLimitDetections }
      });
    }
    
    // Alerta: Slots offline
    if (metrics.slotsActive < metrics.slotsTotal / 2) {
      newAlerts.push({
        type: 'CRITICAL',
        message: `Muitos slots offline: ${metrics.slotsActive}/${metrics.slotsTotal}`,
        timestamp: Date.now(),
        data: { activeSlots: metrics.slotsActive, totalSlots: metrics.slotsTotal }
      });
    }
    
    this.alerts.push(...newAlerts);
    return newAlerts;
  }
}
```

### Relatórios de Performance

#### Relatório de Campanha
```typescript
interface CampaignReport {
  campaignId: string;
  startTime: Date;
  endTime: Date;
  
  summary: {
    totalCandidates: number;
    messagesSent: number;
    messagesDelivered: number;
    messagesFailed: number;
    deliveryRate: number;
  };
  
  performance: {
    averageDelay: number;
    peakThroughput: number;
    totalDuration: number;
    slotsUsed: number;
  };
  
  rateLimiting: {
    detectionsCount: number;
    adaptiveDelayTriggered: boolean;
    maxDelayApplied: number;
  };
  
  slotPerformance: SlotReport[];
}

function generateCampaignReport(campaignId: string): CampaignReport {
  // Implementar geração de relatório baseado nos dados coletados
  return {
    // ... dados do relatório
  };
}
```

## Casos de Uso Práticos

### Cenário 1: Campanha de 1000 Candidatos

#### Configuração Inicial
```typescript
const campaignConfig = {
  candidates: 1000,
  activeSlots: 3,
  rateLimitConfig: {
    delayPerMessage: 1000,    // 1 segundo
    batchSize: 10,
    maxRetries: 3
  }
};

// Distribuição esperada
const distribution = distributeToSlots(candidates, activeSlots);
/*
Resultado:
- Slot 1: 334 candidatos
- Slot 2: 333 candidatos  
- Slot 3: 333 candidatos
*/
```

#### Tempo Estimado
```typescript
// Cálculo de tempo estimado
const timePerSlot = Math.max(...distribution.map(slot => slot.items.length)) * 1000; // ms
const estimatedTime = timePerSlot / 1000; // segundos
const estimatedMinutes = Math.ceil(estimatedTime / 60);

console.log(`Tempo estimado: ${estimatedMinutes} minutos`);
// Resultado: ~6 minutos (334 mensagens × 1s)
```

### Cenário 2: Rate Limit Detectado

#### Resposta Automática
```typescript
// Quando rate limit é detectado
if (isRateLimitError(sendResult.error)) {
  console.log('🚫 Rate limit detectado - ativando modo adaptativo');
  
  // 1. Aumentar delay imediatamente
  adaptiveDelayMultiplier *= 1.5;
  
  // 2. Aplicar backoff para esta mensagem
  const backoffDelay = currentDelay * Math.pow(2, attempt - 1);
  await sleep(backoffDelay);
  
  // 3. Marcar slot como sob rate limit
  markSlotAsRateLimited(slotNumber);
  
  // 4. Redistribuir mensagens pendentes se necessário
  if (attempt >= maxAttempts) {
    redistributePendingMessages(slotNumber);
  }
}
```

### Cenário 3: Slot Offline Durante Campanha

#### Recuperação Automática
```typescript
// Detectar slot offline
if (!sendResult.success && isConnectionError(sendResult.error)) {
  console.log(`❌ Slot ${slotNumber} offline - redistribuindo mensagens`);
  
  // 1. Marcar slot como offline
  markSlotAsOffline(slotNumber);
  
  // 2. Redistribuir mensagens pendentes
  const pendingMessages = getPendingMessagesForSlot(slotNumber);
  const activeSlots = getActiveSlots().filter(s => s.slotNumber !== slotNumber);
  
  if (activeSlots.length > 0) {
    const redistributed = distributeToSlots(pendingMessages, activeSlots);
    await enqueuePendingMessages(redistributed);
    
    console.log(`📤 ${pendingMessages.length} mensagens redistribuídas entre ${activeSlots.length} slots`);
  }
}
```

## Troubleshooting

### Problemas Comuns

#### 1. Alta Taxa de Rate Limit

**Sintomas**:
- Múltiplos erros de rate limit
- Delay adaptativo constantemente aumentando
- Baixa taxa de entrega

**Diagnóstico**:
```typescript
function diagnoseRateLimitIssues(metrics: CadenceMetrics): Diagnosis {
  const rateLimitRate = metrics.rateLimitDetections / metrics.totalMessages;
  
  if (rateLimitRate > 0.2) {
    return {
      issue: 'HIGH_RATE_LIMIT',
      severity: 'CRITICAL',
      recommendations: [
        'Aumentar delay base para 3-5 segundos',
        'Reduzir número de slots ativos',
        'Implementar pausa de 30 minutos entre campanhas',
        'Verificar se mensagens não são idênticas'
      ]
    };
  }
  
  // Outras verificações...
}
```

**Soluções**:
1. Aumentar delay base
2. Implementar pausa entre campanhas
3. Diversificar conteúdo das mensagens
4. Reduzir volume diário

#### 2. Distribuição Desigual

**Sintomas**:
- Um slot processa muito mais mensagens que outros
- Diferença significativa no tempo de conclusão por slot

**Diagnóstico**:
```typescript
function analyzeDistribution(distribution: Distribution[]): DistributionAnalysis {
  const counts = distribution.map(d => d.items.length);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const variance = max - min;
  
  return {
    isBalanced: variance <= 1,
    variance,
    recommendation: variance > 5 ? 'REBALANCE_NEEDED' : 'OK'
  };
}
```

**Soluções**:
1. Verificar algoritmo de distribuição
2. Considerar performance histórica dos slots
3. Implementar redistribuição dinâmica

#### 3. Performance Degradada

**Sintomas**:
- Throughput abaixo do esperado
- Tempo de resposta alto
- Timeouts frequentes

**Diagnóstico e Solução**:
```typescript
class PerformanceDiagnostic {
  analyzePerformance(metrics: PerformanceMetrics): PerformanceReport {
    const issues = [];
    
    // Verificar throughput
    if (metrics.messagesPerMinute < 30) {
      issues.push({
        type: 'LOW_THROUGHPUT',
        impact: 'HIGH',
        cause: 'Delay muito alto ou problemas de conectividade',
        solution: 'Reduzir delay ou verificar conexão'
      });
    }
    
    // Verificar tempo de resposta
    if (metrics.averageResponseTime > 5000) {
      issues.push({
        type: 'HIGH_LATENCY',
        impact: 'MEDIUM',
        cause: 'Problemas de rede ou sobrecarga do servidor',
        solution: 'Verificar infraestrutura de rede'
      });
    }
    
    return { issues, healthScore: this.calculateHealthScore(metrics) };
  }
}
```

### Ferramentas de Debug

#### Monitor em Tempo Real
```typescript
class RealTimeMonitor {
  private metrics: Map<string, any> = new Map();
  
  startMonitoring(campaignId: string): void {
    const interval = setInterval(() => {
      const currentMetrics = this.collectCurrentMetrics();
      this.updateDashboard(currentMetrics);
      this.checkAlerts(currentMetrics);
    }, 5000); // Atualizar a cada 5 segundos
    
    this.metrics.set(campaignId, { interval, startTime: Date.now() });
  }
  
  private updateDashboard(metrics: CadenceMetrics): void {
    console.clear();
    console.log('📊 MONITOR CADÊNCIA WHATSAPP - TEMPO REAL');
    console.log('═'.repeat(50));
    console.log(`📱 Mensagens: ${metrics.messagesSent}/${metrics.totalMessages}`);
    console.log(`🎯 Taxa Entrega: ${((metrics.messagesSent / metrics.totalMessages) * 100).toFixed(1)}%`);
    console.log(`⚡ Throughput: ${metrics.currentThroughput} msg/min`);
    console.log(`🔄 Slots Ativos: ${metrics.slotsActive}/${metrics.slotsTotal}`);
    console.log(`⏱️  Delay Atual: ${metrics.averageDelay}ms`);
    console.log(`🚫 Rate Limits: ${metrics.rateLimitDetections}`);
    console.log('═'.repeat(50));
  }
}
```

#### Análise de Logs
```typescript
function analyzeLogs(logEntries: LogEntry[]): LogAnalysis {
  const patterns = {
    rateLimits: logEntries.filter(log => log.message.includes('rate limit')),
    failures: logEntries.filter(log => log.level === 'ERROR'),
    slowResponses: logEntries.filter(log => 
      log.responseTime && log.responseTime > 3000
    )
  };
  
  return {
    totalEntries: logEntries.length,
    errorRate: patterns.failures.length / logEntries.length,
    rateLimitRate: patterns.rateLimits.length / logEntries.length,
    averageResponseTime: calculateAverageResponseTime(logEntries),
    recommendations: generateRecommendations(patterns)
  };
}
```

## Conclusão

O sistema de cadência Round Robin para WhatsApp representa uma solução avançada para distribuição inteligente de mensagens em massa, combinando:

1. **Distribuição Equilibrada**: Algoritmo Round Robin garante carga uniforme
2. **Adaptabilidade**: Sistema aprende e ajusta automaticamente
3. **Resiliência**: Recuperação automática de falhas e redistribuição
4. **Compliance**: Respeita limites e políticas anti-spam do WhatsApp
5. **Monitoramento**: Métricas em tempo real e alertas proativos
6. **Escalabilidade**: Suporta crescimento de volume e número de slots

A implementação permite alta taxa de entrega mantendo a qualidade do serviço e evitando bloqueios, essencial para operações comerciais de grande escala. 