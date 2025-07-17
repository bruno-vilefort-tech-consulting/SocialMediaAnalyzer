# Estratégia Round Robin - Sistema de Cadência WhatsApp

## 📋 Resumo Executivo

Este documento detalha o sistema Round Robin implementado para distribuição inteligente de mensagens WhatsApp, garantindo alta taxa de entrega e evitando rate limits através de múltiplos slots de conexão.

## 🎯 Algoritmo Round Robin

### Distribuição Básica
```typescript
// Função principal de distribuição
function distributeToSlots<T>(items: T[], slots: any[]): { slotNumber: number; items: T[] }[] {
  const distribution = slots.map(slot => ({
    slotNumber: slot.slotNumber,
    items: []
  }));
  
  items.forEach((item, index) => {
    const slotIndex = index % slots.length; // Round Robin circular
    distribution[slotIndex].items.push(item);
  });
  
  return distribution;
}
```

### Exemplo Prático: 1000 Candidatos em 3 Slots
```
Entrada: 1000 candidatos, 3 slots ativos
Saída:
- Slot 1: candidatos[0, 3, 6, 9, ...] = 334 mensagens
- Slot 2: candidatos[1, 4, 7, 10, ...] = 333 mensagens
- Slot 3: candidatos[2, 5, 8, 11, ...] = 333 mensagens
```

## 🔄 Sistema de Slots

### Configuração Multi-Slot
- **Máximo 3 slots por cliente**
- **Cada slot = 1 conexão WhatsApp independente**
- **Distribuição automática baseada em disponibilidade**

### Estados de Slot
- ✅ **Connected**: Pronto para envio
- 🔄 **Connecting**: Em processo de conexão
- ❌ **Disconnected**: Requer reconexão
- ⚠️ **Rate Limited**: Temporariamente limitado

## ⏱️ Sistema de Cadência

### Configuração de Delays
```typescript
const rateLimitConfig = {
  delayPerMessage: 1000,    // 1s entre mensagens
  batchSize: 10,            // Lotes de 10
  maxRetries: 3,            // 3 tentativas
  adaptiveMultiplier: 1.0   // Multiplicador adaptativo
};
```

### Delay Adaptativo
- **Base**: 1 segundo entre mensagens
- **Detecção Rate Limit**: Aumenta automaticamente 1.5x
- **Máximo**: 3x o delay original
- **Recovery**: Reduz gradualmente com sucesso

### Exemplo de Adaptação
```
Cenário: Rate limit detectado
Delay original: 1000ms
Após 1º rate limit: 1500ms (1.5x)
Após 2º rate limit: 2250ms (1.5x)
Após 3º rate limit: 3000ms (máximo)
```

## 🚀 Processamento em Filas

### Arquitetura de Filas
1. **Dispatch Queue**: Divide seleções em jobs individuais
2. **Message Queue**: Processa mensagens com delay
3. **Status Queue**: Atualiza status em tempo real

### Worker Configuration
```typescript
// Configuração de workers
dispatchWorker: { concurrency: 3 }   // 3 dispatches simultâneos
messageWorker: { concurrency: 10 }   // 10 mensagens simultâneas
statusWorker: { concurrency: 5 }     // 5 updates simultâneos
```

## 📊 Métricas de Performance

### Throughput Esperado
- **1 slot ativo**: ~60 mensagens/minuto (1s delay)
- **2 slots ativos**: ~120 mensagens/minuto
- **3 slots ativos**: ~180 mensagens/minuto

### Tempo Estimado (1000 mensagens)
- **1 slot**: ~17 minutos
- **2 slots**: ~8.5 minutos  
- **3 slots**: ~6 minutos

## 🛡️ Proteções Anti-Spam

### Rate Limit Detection
```typescript
const rateLimitKeywords = ['rate', 'limit', 'spam', 'blocked', 'too many'];
const isRateLimit = error => rateLimitKeywords.some(keyword => 
  error.toLowerCase().includes(keyword)
);
```

### Backoff Exponencial
```
Tentativa 1: delay × 1 = 1000ms
Tentativa 2: delay × 2 = 2000ms  
Tentativa 3: delay × 4 = 4000ms
```

### Diversificação de Conteúdo
- Variação de saudações aleatórias
- Templates personalizados por candidato
- Randomização de delay (±20%)

## 📈 Monitoramento em Tempo Real

### Dashboard Metrics
```
📊 CADÊNCIA WHATSAPP - TEMPO REAL
══════════════════════════════════
📱 Mensagens: 847/1000 (84.7%)
🎯 Taxa Entrega: 94.2%
⚡ Throughput: 156 msg/min
🔄 Slots Ativos: 3/3
⏱️ Delay Atual: 1200ms (1.2x)
🚫 Rate Limits: 3
══════════════════════════════════
```

### Alertas Automáticos
- 🟡 **Warning**: Taxa falha > 10%
- 🟠 **Error**: Rate limits > 10 detecções
- 🔴 **Critical**: Slots offline > 50%

## 🔧 Configurações Avançadas

### Otimização por Horário
```typescript
const hourFactors = {
  8: 1.3,    // Horário comercial - delay maior
  12: 1.2,   // Almoço - delay médio
  20: 0.9,   // Noturno - delay menor
  2: 0.7     // Madrugada - delay mínimo
};
```

### Distribuição Ponderada
- Considera performance histórica do slot
- Ajusta distribuição baseada em taxa de sucesso
- Redistribui automaticamente em caso de falha

## ❌ Troubleshooting

### Problema: Alta Taxa de Rate Limit
**Soluções**:
1. Aumentar delay base para 3-5s
2. Reduzir slots ativos temporariamente
3. Implementar pausa de 30min entre campanhas

### Problema: Distribuição Desigual
**Soluções**:
1. Verificar status de conectividade dos slots
2. Implementar redistribuição dinâmica
3. Considerar performance histórica

### Problema: Performance Baixa
**Soluções**:
1. Otimizar delays base
2. Verificar infraestrutura de rede
3. Aumentar concorrência de workers

## 📖 Casos de Uso

### Campanha Pequena (< 100 mensagens)
- **Slots recomendados**: 1-2
- **Delay**: 1-2 segundos
- **Tempo estimado**: 2-3 minutos

### Campanha Média (100-500 mensagens)
- **Slots recomendados**: 2-3
- **Delay**: 1-1.5 segundos  
- **Tempo estimado**: 3-8 minutos

### Campanha Grande (> 500 mensagens)
- **Slots recomendados**: 3 (máximo)
- **Delay**: 1 segundo + adaptativo
- **Tempo estimado**: 6+ minutos

## 🎯 Benefícios do Sistema

1. **Alta Disponibilidade**: Múltiplas conexões garantem continuidade
2. **Evita Bloqueios**: Sistema inteligente previne rate limits
3. **Escalabilidade**: Performance cresce com número de slots
4. **Adaptabilidade**: Ajustes automáticos baseados em resposta
5. **Monitoramento**: Visibilidade completa do processo
6. **Resiliência**: Recuperação automática de falhas

## 🏁 Conclusão

O sistema Round Robin para cadência WhatsApp oferece uma solução robusta e escalável para envio de mensagens em massa, combinando distribuição inteligente, proteções anti-spam e monitoramento em tempo real para garantir máxima eficiência e taxa de entrega. 