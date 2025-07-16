# Guia Completo: Sistema de Reconexão WhatsApp

## Índice
1. [Visão Geral](#visão-geral)
2. [Tipos de Reconexão](#tipos-de-reconexão)
3. [Detecção de Necessidade de Reconexão](#detecção-de-necessidade-de-reconexão)
4. [Fluxo Completo de Reconexão](#fluxo-completo-de-reconexão)
5. [Preservação de Estado](#preservação-de-estado)
6. [Estratégias de Reconexão](#estratégias-de-reconexão)
7. [Tratamento de Falhas](#tratamento-de-falhas)
8. [Otimizações e Performance](#otimizações-e-performance)
9. [Monitoramento da Reconexão](#monitoramento-da-reconexão)
10. [Cenários Específicos](#cenários-específicos)
11. [Configurações Avançadas](#configurações-avançadas)
12. [Debugging e Troubleshooting](#debugging-e-troubleshooting)

## Visão Geral

O sistema de reconexão do WhatsApp é projetado para manter a continuidade do serviço mesmo diante de interrupções temporárias. Ele utiliza as credenciais salvas (auth state) para reestabelecer a conexão sem necessidade de novo QR code.

### Arquitetura de Reconexão

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Detecção de   │    │   Análise de    │    │   Execução da   │
│   Desconexão    │────▶│   Viabilidade   │────▶│   Reconexão     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Status Codes    │    │ Credenciais     │    │ Novo Cliente    │
│ Error Analysis  │    │ Auth State      │    │ Event Handlers  │
│ Network Check   │    │ Session Data    │    │ State Recovery  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Tipos de Reconexão

### 1. Reconexão Automática (Auto-Reconnection)

**Características**:
- Iniciada automaticamente pelo sistema
- Baseada em códigos de erro específicos
- Mantém o mesmo auth state
- Transparente para o usuário

**Trigger**:
```typescript
if (connection === 'close') {
  const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
  const codesToNotReconnect = [
    DisconnectReason.loggedOut,    // 401
    DisconnectReason.forbidden,    // 403
    402,                           // Payment required
    406                            // Not acceptable
  ];
  
  const shouldReconnect = !codesToNotReconnect.includes(statusCode);
  
  if (shouldReconnect) {
    await this.connectToWhatsapp(this.phoneNumber);
  }
}
```

### 2. Reconexão Manual (Reload Connection)

**Características**:
- Iniciada por comando explícito
- Recria completamente o cliente
- Mantém configurações existentes
- Usado para resolver problemas específicos

**Implementação**:
```typescript
public async reloadConnection(): Promise<WASocket> {
  try {
    // Recria o cliente com as mesmas configurações
    return await this.createClient(this.phoneNumber);
  } catch (error) {
    this.logger.error(error);
    throw new InternalServerErrorException(error?.toString());
  }
}
```

### 3. Reconexão com Reset (Hard Reset)

**Características**:
- Limpa cache e estado temporário
- Recarrega auth state do storage
- Usado em casos de corrupção de dados
- Última tentativa antes de logout

**Processo**:
```typescript
private async hardResetReconnection() {
  try {
    // 1. Limpa cache local
    this.msgRetryCounterCache.flushAll();
    this.userDevicesCache.flushAll();
    
    // 2. Recarrega auth state
    this.instance.authState = await this.defineAuthState();
    
    // 3. Recria cliente
    await this.createClient(this.phoneNumber);
    
    this.logger.info('Hard reset reconnection successful');
  } catch (error) {
    this.logger.error(`Hard reset failed: ${error.message}`);
    throw error;
  }
}
```

## Detecção de Necessidade de Reconexão

### Análise de Códigos de Status

```typescript
private analyzeDisconnectionCode(statusCode: number): ReconnectionDecision {
  const reconnectionMap = {
    // RECONNECTABLE - Problemas temporários
    428: { shouldReconnect: true, priority: 'high', delay: 2000 },     // Connection closed
    408: { shouldReconnect: true, priority: 'high', delay: 5000 },     // Timeout
    440: { shouldReconnect: true, priority: 'medium', delay: 3000 },   // Connection replaced
    515: { shouldReconnect: true, priority: 'high', delay: 1000 },     // Restart required
    503: { shouldReconnect: true, priority: 'low', delay: 10000 },     // Service unavailable
    
    // NON-RECONNECTABLE - Problemas permanentes
    401: { shouldReconnect: false, reason: 'User logged out' },        // Logged out
    403: { shouldReconnect: false, reason: 'Access forbidden' },       // Forbidden
    402: { shouldReconnect: false, reason: 'Payment required' },       // Payment required
    406: { shouldReconnect: false, reason: 'Not acceptable' },         // Not acceptable
    500: { shouldReconnect: false, reason: 'Bad session' },            // Bad session
    411: { shouldReconnect: false, reason: 'Multi-device mismatch' },  // Multi-device
  };

  return reconnectionMap[statusCode] || { 
    shouldReconnect: true, 
    priority: 'medium', 
    delay: 5000 
  };
}
```

### Verificação de Pré-Condições

```typescript
private async checkReconnectionPrerequisites(): Promise<boolean> {
  // 1. Verifica se a instância ainda existe
  const instance = await this.prismaRepository.instance.findFirst({
    where: { id: this.instanceId }
  });
  
  if (!instance) {
    this.logger.error('Instance no longer exists in database');
    return false;
  }

  // 2. Verifica se auth state está disponível
  if (!this.instance.authState?.state?.creds) {
    this.logger.error('Auth state or credentials not available');
    return false;
  }

  // 3. Verifica se não está em processo de encerramento
  if (this.endSession) {
    this.logger.warn('Instance is in shutdown process');
    return false;
  }

  // 4. Verifica conectividade básica
  const networkCheck = await this.performNetworkCheck();
  if (!networkCheck.isConnected) {
    this.logger.error(`Network check failed: ${networkCheck.error}`);
    return false;
  }

  return true;
}
```

### Teste de Conectividade

```typescript
private async performNetworkCheck(): Promise<{ isConnected: boolean; error?: string }> {
  try {
    // Testa conectividade com servidores WhatsApp
    const whatsappHosts = [
      'web.whatsapp.com',
      'g.whatsapp.net',
      'mmg.whatsapp.net'
    ];

    for (const host of whatsappHosts) {
      try {
        const response = await axios.get(`https://${host}`, { 
          timeout: 5000,
          validateStatus: () => true // Aceita qualquer status
        });
        
        if (response.status < 500) {
          return { isConnected: true };
        }
      } catch (error) {
        continue; // Tenta próximo host
      }
    }

    return { isConnected: false, error: 'All WhatsApp hosts unreachable' };
  } catch (error) {
    return { isConnected: false, error: error.message };
  }
}
```

## Fluxo Completo de Reconexão

### Processo Principal

```typescript
private async executeReconnection(statusCode: number): Promise<void> {
  const startTime = Date.now();
  const reconnectionId = `${this.instanceId}_${startTime}`;
  
  this.logger.info(`Starting reconnection process - ID: ${reconnectionId}`);

  try {
    // FASE 1: Preparação
    await this.prepareForReconnection(reconnectionId);
    
    // FASE 2: Validação de pré-requisitos
    const canReconnect = await this.checkReconnectionPrerequisites();
    if (!canReconnect) {
      throw new Error('Reconnection prerequisites not met');
    }
    
    // FASE 3: Configuração de delay estratégico
    const decision = this.analyzeDisconnectionCode(statusCode);
    if (decision.delay > 0) {
      this.logger.info(`Waiting ${decision.delay}ms before reconnection`);
      await this.delay(decision.delay);
    }
    
    // FASE 4: Backup do estado atual
    const currentState = await this.backupCurrentState();
    
    // FASE 5: Execução da reconexão
    await this.performReconnection(reconnectionId, currentState);
    
    // FASE 6: Validação pós-reconexão
    await this.validateReconnectionSuccess(reconnectionId);
    
    // FASE 7: Restauração de estado
    await this.restorePostReconnectionState(currentState);
    
    const duration = Date.now() - startTime;
    this.logger.info(`Reconnection successful - ID: ${reconnectionId}, Duration: ${duration}ms`);
    
    // Emite evento de sucesso
    this.eventEmitter.emit('reconnection.success', {
      reconnectionId,
      instanceId: this.instanceId,
      duration,
      statusCode
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    this.logger.error(`Reconnection failed - ID: ${reconnectionId}, Duration: ${duration}ms, Error: ${error.message}`);
    
    // Emite evento de falha
    this.eventEmitter.emit('reconnection.failed', {
      reconnectionId,
      instanceId: this.instanceId,
      duration,
      statusCode,
      error: error.message
    });
    
    throw error;
  }
}
```

### Fases Detalhadas

#### Fase 1: Preparação

```typescript
private async prepareForReconnection(reconnectionId: string): Promise<void> {
  // 1. Marca início do processo de reconexão
  this.isReconnecting = true;
  this.currentReconnectionId = reconnectionId;
  
  // 2. Pausa processamento de novos eventos
  this.pauseEventProcessing = true;
  
  // 3. Fecha conexão atual se ainda estiver aberta
  if (this.client?.ws?.readyState === 1) {
    this.client.ws.close();
  }
  
  // 4. Limpa timers e intervalos ativos
  this.clearActiveTimers();
  
  // 5. Atualiza status no banco
  await this.prismaRepository.instance.update({
    where: { id: this.instanceId },
    data: { connectionStatus: 'reconnecting' }
  });
  
  // 6. Emite webhook de início de reconexão
  this.sendDataWebhook(Events.RECONNECTION_STARTED, {
    reconnectionId,
    instance: this.instance.name,
    timestamp: new Date().toISOString()
  });
}
```

#### Fase 4: Backup do Estado

```typescript
private async backupCurrentState(): Promise<InstanceState> {
  return {
    // Configurações da instância
    instanceConfig: {
      phoneNumber: this.phoneNumber,
      qrcodeCount: this.instance.qrcode.count,
      settings: await this.findSettings(),
      chatwoot: this.localChatwoot,
      webhook: this.localWebhook,
      proxy: this.localProxy
    },
    
    // Estado de cache
    cacheState: {
      msgRetryCounter: await this.exportCacheData(this.msgRetryCounterCache),
      userDevices: await this.exportCacheData(this.userDevicesCache),
      groupMetadata: await this.exportGroupMetadataCache()
    },
    
    // Métricas e contadores
    metrics: {
      disconnections: { ...this.metrics.disconnections },
      reconnectionAttempts: this.reconnectionAttempts,
      lastSuccessfulConnection: this.lastSuccessfulConnection
    },
    
    // Estado da sessão
    sessionState: {
      wuid: this.instance.wuid,
      profileName: await this.getProfileName(),
      profilePictureUrl: this.instance.profilePictureUrl
    }
  };
}
```

#### Fase 5: Execução da Reconexão

```typescript
private async performReconnection(reconnectionId: string, backupState: InstanceState): Promise<void> {
  try {
    // 1. Recarrega configurações
    this.loadSettings();
    this.loadWebhook();
    this.loadProxy();
    this.loadChatwoot();
    
    // 2. Reconstrói auth state se necessário
    if (!this.instance.authState?.state?.creds) {
      this.instance.authState = await this.defineAuthState();
    }
    
    // 3. Cria novo cliente
    this.client = await this.createClientForReconnection(backupState);
    
    // 4. Configura event handlers
    this.setupEventHandlers();
    
    // 5. Configura recursos específicos
    await this.setupReconnectionSpecificFeatures(backupState);
    
    this.logger.info(`Client recreated successfully for reconnection ${reconnectionId}`);
    
  } catch (error) {
    this.logger.error(`Failed to perform reconnection ${reconnectionId}: ${error.message}`);
    throw error;
  }
}
```

#### Fase 6: Validação de Sucesso

```typescript
private async validateReconnectionSuccess(reconnectionId: string): Promise<void> {
  const maxWaitTime = 30000; // 30 segundos
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const validationInterval = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > maxWaitTime) {
        clearInterval(validationInterval);
        reject(new Error(`Reconnection validation timeout after ${maxWaitTime}ms`));
        return;
      }
      
      // Verifica se a conexão está aberta
      if (this.stateConnection.state === 'open') {
        clearInterval(validationInterval);
        
        // Validações adicionais
        const validations = await this.performReconnectionValidations();
        
        if (validations.allPassed) {
          this.logger.info(`Reconnection ${reconnectionId} validated successfully`);
          resolve();
        } else {
          reject(new Error(`Reconnection validation failed: ${validations.failures.join(', ')}`));
        }
      }
    }, 1000);
  });
}
```

#### Fase 7: Restauração de Estado

```typescript
private async restorePostReconnectionState(backupState: InstanceState): Promise<void> {
  try {
    // 1. Restaura cache se necessário
    if (backupState.cacheState.msgRetryCounter) {
      await this.restoreCacheData(this.msgRetryCounterCache, backupState.cacheState.msgRetryCounter);
    }
    
    if (backupState.cacheState.userDevices) {
      await this.restoreCacheData(this.userDevicesCache, backupState.cacheState.userDevices);
    }
    
    // 2. Sincroniza estado com banco de dados
    await this.syncStateWithDatabase();
    
    // 3. Restaura métricas
    this.metrics = { ...backupState.metrics };
    this.reconnectionAttempts++;
    this.lastSuccessfulConnection = Date.now();
    
    // 4. Reativa processamento de eventos
    this.pauseEventProcessing = false;
    this.isReconnecting = false;
    this.currentReconnectionId = null;
    
    // 5. Dispara sincronizações necessárias
    await this.performPostReconnectionSync();
    
    this.logger.info('Post-reconnection state restoration completed');
    
  } catch (error) {
    this.logger.error(`Failed to restore post-reconnection state: ${error.message}`);
    // Não falha a reconexão por isso, apenas loga
  }
}
```

## Preservação de Estado

### Auth State Management

```typescript
private async preserveAuthState(): Promise<void> {
  // 1. Força salvamento das credenciais atuais
  if (this.instance.authState?.saveCreds) {
    await this.instance.authState.saveCreds();
  }
  
  // 2. Cria backup adicional em caso de emergência
  const backup = {
    creds: JSON.stringify(this.instance.authState.state.creds, BufferJSON.replacer),
    keys: await this.exportSignalKeys(),
    timestamp: Date.now()
  };
  
  // 3. Salva em múltiplos locais
  await Promise.allSettled([
    this.saveAuthBackup('database', backup),
    this.saveAuthBackup('redis', backup),
    this.saveAuthBackup('file', backup)
  ]);
}

private async saveAuthBackup(type: string, backup: any): Promise<void> {
  try {
    switch (type) {
      case 'database':
        await this.prismaRepository.authBackup.create({
          data: {
            instanceId: this.instanceId,
            creds: backup.creds,
            keys: backup.keys,
            timestamp: new Date(backup.timestamp)
          }
        });
        break;
        
      case 'redis':
        await this.cache.set(`auth_backup:${this.instanceId}`, JSON.stringify(backup), 3600);
        break;
        
      case 'file':
        const backupPath = `./backups/auth_${this.instanceId}_${backup.timestamp}.json`;
        await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
        break;
    }
  } catch (error) {
    this.logger.warn(`Failed to save auth backup to ${type}: ${error.message}`);
  }
}
```

### Session Data Continuity

```typescript
private async maintainSessionContinuity(): Promise<void> {
  // 1. Preserva informações críticas da sessão
  const sessionSnapshot = {
    instanceId: this.instanceId,
    wuid: this.instance.wuid,
    profileName: await this.getProfileName(),
    profilePictureUrl: this.instance.profilePictureUrl,
    connectionTimestamp: Date.now(),
    
    // Estado dos chats
    activeChats: await this.getActiveChatsList(),
    
    // Configurações ativas
    settings: await this.findSettings(),
    
    // Estado de presença
    lastPresence: this.lastKnownPresence,
    
    // Contadores importantes
    messageCounters: this.getMessageCounters(),
  };
  
  // 2. Salva snapshot temporário
  await this.cache.set(`session_snapshot:${this.instanceId}`, JSON.stringify(sessionSnapshot), 1800);
  
  this.logger.info('Session continuity data preserved');
}
```

### Message Processing State

```typescript
private async preserveMessageProcessingState(): Promise<void> {
  // 1. Pausa processamento de novas mensagens
  this.pauseMessageProcessing = true;
  
  // 2. Aguarda conclusão de mensagens em processamento
  const processingTimeout = 10000; // 10 segundos
  const startWait = Date.now();
  
  while (this.pendingMessageProcessing.size > 0 && (Date.now() - startWait) < processingTimeout) {
    await this.delay(100);
  }
  
  if (this.pendingMessageProcessing.size > 0) {
    this.logger.warn(`${this.pendingMessageProcessing.size} messages still processing during reconnection`);
  }
  
  // 3. Salva estado das mensagens pendentes
  const pendingState = {
    pendingMessages: Array.from(this.pendingMessageProcessing.values()),
    lastProcessedMessageId: this.lastProcessedMessageId,
    messageQueueLength: this.messageQueue.length
  };
  
  await this.cache.set(`msg_state:${this.instanceId}`, JSON.stringify(pendingState), 600);
}
```

## Estratégias de Reconexão

### Estratégia Baseada em Prioridade

```typescript
private async executeReconnectionStrategy(statusCode: number): Promise<void> {
  const decision = this.analyzeDisconnectionCode(statusCode);
  
  switch (decision.priority) {
    case 'high':
      await this.highPriorityReconnection(statusCode);
      break;
    case 'medium':
      await this.mediumPriorityReconnection(statusCode);
      break;
    case 'low':
      await this.lowPriorityReconnection(statusCode);
      break;
    default:
      await this.defaultReconnectionStrategy(statusCode);
  }
}

private async highPriorityReconnection(statusCode: number): Promise<void> {
  // Reconexão imediata com retry agressivo
  const maxAttempts = 5;
  const baseDelay = 1000;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      this.logger.info(`High priority reconnection attempt ${attempt}/${maxAttempts}`);
      
      await this.executeReconnection(statusCode);
      return; // Sucesso
      
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      const delay = baseDelay * attempt;
      this.logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`);
      await this.delay(delay);
    }
  }
}

private async mediumPriorityReconnection(statusCode: number): Promise<void> {
  // Reconexão com backoff moderado
  const maxAttempts = 3;
  const delays = [2000, 5000, 10000];
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      this.logger.info(`Medium priority reconnection attempt ${attempt}/${maxAttempts}`);
      
      if (attempt > 1) {
        await this.delay(delays[attempt - 1]);
      }
      
      await this.executeReconnection(statusCode);
      return;
      
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      this.logger.warn(`Attempt ${attempt} failed, will retry with delay`);
    }
  }
}

private async lowPriorityReconnection(statusCode: number): Promise<void> {
  // Reconexão conservadora com delays longos
  const delays = [10000, 30000, 60000]; // 10s, 30s, 1min
  
  for (let i = 0; i < delays.length; i++) {
    try {
      this.logger.info(`Low priority reconnection attempt ${i + 1}/${delays.length}`);
      
      await this.delay(delays[i]);
      await this.executeReconnection(statusCode);
      return;
      
    } catch (error) {
      if (i === delays.length - 1) {
        throw error;
      }
      
      this.logger.warn(`Low priority attempt ${i + 1} failed`);
    }
  }
}
```

### Estratégia Adaptativa

```typescript
private async adaptiveReconnectionStrategy(statusCode: number): Promise<void> {
  // Analisa histórico de reconexões para adaptar estratégia
  const history = await this.getReconnectionHistory();
  const recentFailures = history.filter(h => 
    h.timestamp > Date.now() - 3600000 && // Última hora
    h.success === false
  ).length;
  
  // Adapta estratégia baseada no histórico
  if (recentFailures >= 3) {
    this.logger.info('Multiple recent failures detected, using conservative strategy');
    await this.conservativeReconnectionStrategy(statusCode);
  } else if (recentFailures === 0) {
    this.logger.info('No recent failures, using aggressive strategy');
    await this.aggressiveReconnectionStrategy(statusCode);
  } else {
    this.logger.info('Some recent failures, using balanced strategy');
    await this.balancedReconnectionStrategy(statusCode);
  }
}

private async conservativeReconnectionStrategy(statusCode: number): Promise<void> {
  // Estratégia conservadora - evita sobrecarregar o sistema
  const baseDelay = 30000; // 30 segundos
  const maxAttempts = 2;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const delay = baseDelay * attempt;
    
    this.logger.info(`Conservative reconnection attempt ${attempt}/${maxAttempts} after ${delay}ms`);
    await this.delay(delay);
    
    try {
      // Verifica novamente se reconexão é necessária
      const stillNeedsReconnection = await this.verifyReconnectionStillNeeded();
      if (!stillNeedsReconnection) {
        this.logger.info('Reconnection no longer needed');
        return;
      }
      
      await this.executeReconnection(statusCode);
      return;
      
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
    }
  }
}

private async aggressiveReconnectionStrategy(statusCode: number): Promise<void> {
  // Estratégia agressiva - múltiplas tentativas rápidas
  const attempts = [500, 1000, 2000, 4000, 8000]; // Backoff exponencial rápido
  
  for (let i = 0; i < attempts.length; i++) {
    if (i > 0) {
      await this.delay(attempts[i]);
    }
    
    try {
      this.logger.info(`Aggressive reconnection attempt ${i + 1}/${attempts.length}`);
      await this.executeReconnection(statusCode);
      return;
      
    } catch (error) {
      if (i === attempts.length - 1) {
        throw error;
      }
    }
  }
}
```

## Tratamento de Falhas

### Detecção de Falhas na Reconexão

```typescript
private async handleReconnectionFailure(error: Error, statusCode: number, attempt: number): Promise<void> {
  const failureAnalysis = this.analyzeReconnectionFailure(error, statusCode);
  
  this.logger.error(`Reconnection attempt ${attempt} failed`, {
    error: error.message,
    statusCode,
    analysisType: failureAnalysis.type,
    isRecoverable: failureAnalysis.isRecoverable,
    suggestedAction: failureAnalysis.suggestedAction
  });
  
  // Registra falha nas métricas
  this.metrics.reconnectionFailures++;
  this.metrics.lastReconnectionFailure = {
    timestamp: Date.now(),
    error: error.message,
    statusCode,
    attempt
  };
  
  // Toma ação baseada na análise
  switch (failureAnalysis.suggestedAction) {
    case 'retry_with_delay':
      await this.retryWithIncreasedDelay(statusCode, attempt);
      break;
      
    case 'reset_auth_state':
      await this.resetAuthStateAndRetry(statusCode);
      break;
      
    case 'escalate_to_manual':
      await this.escalateToManualIntervention(error, statusCode);
      break;
      
    case 'abort_reconnection':
      await this.abortReconnectionProcess(error, statusCode);
      break;
      
    default:
      throw error;
  }
}

private analyzeReconnectionFailure(error: Error, statusCode: number): FailureAnalysis {
  const errorMessage = error.message.toLowerCase();
  
  // Análise baseada na mensagem de erro
  if (errorMessage.includes('timeout')) {
    return {
      type: 'timeout',
      isRecoverable: true,
      suggestedAction: 'retry_with_delay',
      confidence: 0.9
    };
  }
  
  if (errorMessage.includes('auth') || errorMessage.includes('credential')) {
    return {
      type: 'authentication',
      isRecoverable: true,
      suggestedAction: 'reset_auth_state',
      confidence: 0.8
    };
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return {
      type: 'network',
      isRecoverable: true,
      suggestedAction: 'retry_with_delay',
      confidence: 0.7
    };
  }
  
  if (errorMessage.includes('session') || errorMessage.includes('invalid')) {
    return {
      type: 'session_invalid',
      isRecoverable: false,
      suggestedAction: 'abort_reconnection',
      confidence: 0.9
    };
  }
  
  // Análise baseada no código de status
  if (statusCode >= 500) {
    return {
      type: 'server_error',
      isRecoverable: true,
      suggestedAction: 'retry_with_delay',
      confidence: 0.6
    };
  }
  
  if (statusCode >= 400 && statusCode < 500) {
    return {
      type: 'client_error',
      isRecoverable: false,
      suggestedAction: 'escalate_to_manual',
      confidence: 0.8
    };
  }
  
  // Caso genérico
  return {
    type: 'unknown',
    isRecoverable: true,
    suggestedAction: 'retry_with_delay',
    confidence: 0.3
  };
}
```

### Estratégias de Recovery de Falhas

```typescript
private async resetAuthStateAndRetry(statusCode: number): Promise<void> {
  this.logger.info('Attempting auth state reset and retry');
  
  try {
    // 1. Backup do auth state atual
    const currentAuthState = { ...this.instance.authState };
    
    // 2. Limpa auth state atual
    this.instance.authState = null;
    
    // 3. Recarrega auth state do storage
    this.instance.authState = await this.defineAuthState();
    
    // 4. Valida se auth state foi carregado corretamente
    if (!this.instance.authState?.state?.creds) {
      throw new Error('Failed to reload auth state from storage');
    }
    
    // 5. Tenta reconexão com novo auth state
    await this.executeReconnection(statusCode);
    
    this.logger.info('Auth state reset and reconnection successful');
    
  } catch (error) {
    this.logger.error(`Auth state reset failed: ${error.message}`);
    
    // Restaura auth state anterior como fallback
    if (currentAuthState) {
      this.instance.authState = currentAuthState;
    }
    
    throw error;
  }
}

private async escalateToManualIntervention(error: Error, statusCode: number): Promise<void> {
  this.logger.warn('Escalating reconnection to manual intervention');
  
  // 1. Emite evento de escalation
  this.eventEmitter.emit('reconnection.escalated', {
    instanceId: this.instanceId,
    instanceName: this.instance.name,
    error: error.message,
    statusCode,
    timestamp: Date.now()
  });
  
  // 2. Envia webhook para administradores
  this.sendDataWebhook(Events.RECONNECTION_MANUAL_REQUIRED, {
    instance: this.instance.name,
    error: error.message,
    statusCode,
    message: 'Manual intervention required for reconnection',
    timestamp: new Date().toISOString()
  });
  
  // 3. Atualiza status no banco
  await this.prismaRepository.instance.update({
    where: { id: this.instanceId },
    data: { 
      connectionStatus: 'manual_intervention_required',
      disconnectionReasonCode: statusCode,
      disconnectionObject: JSON.stringify({ 
        error: error.message, 
        escalatedAt: new Date().toISOString() 
      })
    }
  });
  
  // 4. Para tentativas automáticas
  this.endSession = true;
  
  throw new Error(`Manual intervention required: ${error.message}`);
}
```

## Otimizações e Performance

### Reconnection Pooling

```typescript
class ReconnectionPool {
  private activeReconnections = new Map<string, Promise<void>>();
  private readonly maxConcurrentReconnections = 5;
  
  async queueReconnection(instanceId: string, reconnectionFn: () => Promise<void>): Promise<void> {
    // Evita reconexões duplicadas para a mesma instância
    if (this.activeReconnections.has(instanceId)) {
      this.logger.info(`Reconnection already in progress for instance ${instanceId}`);
      return this.activeReconnections.get(instanceId);
    }
    
    // Controla número máximo de reconexões simultâneas
    while (this.activeReconnections.size >= this.maxConcurrentReconnections) {
      await this.waitForSlot();
    }
    
    // Executa reconexão
    const reconnectionPromise = this.executePooledReconnection(instanceId, reconnectionFn);
    this.activeReconnections.set(instanceId, reconnectionPromise);
    
    try {
      await reconnectionPromise;
    } finally {
      this.activeReconnections.delete(instanceId);
    }
  }
  
  private async executePooledReconnection(instanceId: string, reconnectionFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      await reconnectionFn();
      
      const duration = Date.now() - startTime;
      this.logger.info(`Pooled reconnection completed for ${instanceId} in ${duration}ms`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Pooled reconnection failed for ${instanceId} after ${duration}ms: ${error.message}`);
      throw error;
    }
  }
  
  private async waitForSlot(): Promise<void> {
    return new Promise(resolve => {
      const checkSlot = () => {
        if (this.activeReconnections.size < this.maxConcurrentReconnections) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }
}
```

### Caching Estratégico

```typescript
private async optimizeReconnectionWithCache(): Promise<void> {
  // 1. Cache de configurações para evitar recarregamentos
  const configCacheKey = `config:${this.instanceId}`;
  let cachedConfig = await this.cache.get(configCacheKey);
  
  if (!cachedConfig) {
    cachedConfig = {
      settings: await this.findSettings(),
      chatwoot: await this.findChatwoot(),
      webhook: await this.findWebhook(),
      proxy: await this.findProxy()
    };
    
    await this.cache.set(configCacheKey, JSON.stringify(cachedConfig), 300); // 5 minutos
  } else {
    cachedConfig = JSON.parse(cachedConfig);
  }
  
  // 2. Aplica configurações do cache
  this.localSettings = cachedConfig.settings;
  this.localChatwoot = cachedConfig.chatwoot;
  this.localWebhook = cachedConfig.webhook;
  this.localProxy = cachedConfig.proxy;
  
  // 3. Cache de metadados de grupos para acelerar inicialização
  const groupCacheKey = `groups:${this.instanceId}`;
  const cachedGroups = await this.cache.get(groupCacheKey);
  
  if (cachedGroups) {
    await this.preloadGroupMetadata(JSON.parse(cachedGroups));
  }
  
  this.logger.info('Reconnection optimized with cached data');
}

private async preloadGroupMetadata(cachedGroups: any[]): Promise<void> {
  for (const group of cachedGroups) {
    try {
      await groupMetadataCache.set(group.id, {
        timestamp: Date.now(),
        data: group
      });
    } catch (error) {
      this.logger.warn(`Failed to preload group metadata for ${group.id}: ${error.message}`);
    }
  }
}
```

### Resource Management

```typescript
private async optimizeResourceUsage(): Promise<void> {
  // 1. Limpa recursos desnecessários antes da reconexão
  await this.cleanupUnusedResources();
  
  // 2. Otimiza configurações do socket para reconexão
  const optimizedSocketConfig = this.getOptimizedSocketConfig();
  
  // 3. Pré-aloca buffers e caches necessários
  await this.preallocateResources();
  
  // 4. Configura limites otimizados
  this.configureOptimizedLimits();
}

private async cleanupUnusedResources(): Promise<void> {
  // Limpa caches antigos
  this.msgRetryCounterCache.prune();
  this.userDevicesCache.prune();
  
  // Limpa listeners órfãos
  this.removeAllListeners();
  
  // Força garbage collection se disponível
  if (global.gc) {
    global.gc();
  }
}

private getOptimizedSocketConfig(): any {
  return {
    // Otimizações para reconexão
    connectTimeoutMs: 15_000,     // Reduzido de 30s
    keepAliveIntervalMs: 25_000,  // Reduzido de 30s
    qrTimeout: 30_000,            // Reduzido de 45s
    retryRequestDelayMs: 250,     // Reduzido de 350ms
    maxMsgRetryCount: 3,          // Reduzido de 4
    
    // Otimizações de performance
    transactionOpts: { 
      maxCommitRetries: 5,        // Reduzido de 10
      delayBetweenTriesMs: 1500   // Reduzido de 3000ms
    }
  };
}
```

## Monitoramento da Reconexão

### Métricas Detalhadas

```typescript
interface ReconnectionMetrics {
  total: {
    attempts: number;
    successes: number;
    failures: number;
    timeouts: number;
  };
  
  timing: {
    averageDuration: number;
    fastestReconnection: number;
    slowestReconnection: number;
    totalReconnectionTime: number;
  };
  
  patterns: {
    byStatusCode: { [code: number]: number };
    byTimeOfDay: { [hour: number]: number };
    byStrategy: { [strategy: string]: number };
  };
  
  health: {
    successRate: number;
    averageTimeBetweenReconnections: number;
    consecutiveFailures: number;
    lastSuccessfulReconnection: number;
  };
}

private updateReconnectionMetrics(result: ReconnectionResult): void {
  // Atualiza totais
  this.metrics.total.attempts++;
  
  if (result.success) {
    this.metrics.total.successes++;
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastSuccessfulReconnection = Date.now();
  } else {
    this.metrics.total.failures++;
    this.metrics.consecutiveFailures++;
  }
  
  if (result.timedOut) {
    this.metrics.total.timeouts++;
  }
  
  // Atualiza timing
  this.updateTimingMetrics(result.duration);
  
  // Atualiza padrões
  this.updatePatternMetrics(result);
  
  // Calcula métricas de saúde
  this.calculateHealthMetrics();
  
  // Persiste métricas
  this.persistMetrics();
}

private calculateHealthMetrics(): void {
  const { total } = this.metrics;
  
  // Taxa de sucesso
  this.metrics.health.successRate = total.attempts > 0 
    ? total.successes / total.attempts 
    : 1;
  
  // Tempo médio entre reconexões
  if (this.reconnectionTimestamps.length > 1) {
    const intervals = this.reconnectionTimestamps
      .slice(1)
      .map((timestamp, index) => timestamp - this.reconnectionTimestamps[index]);
    
    this.metrics.health.averageTimeBetweenReconnections = 
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }
}
```

### Dashboard de Monitoramento

```typescript
public async getReconnectionDashboard(): Promise<ReconnectionDashboard> {
  const now = Date.now();
  const last24h = now - (24 * 60 * 60 * 1000);
  const last7d = now - (7 * 24 * 60 * 60 * 1000);
  
  return {
    instance: {
      id: this.instanceId,
      name: this.instance.name,
      currentStatus: this.stateConnection.state,
      lastReconnection: this.metrics.lastSuccessfulReconnection,
      isReconnecting: this.isReconnecting
    },
    
    metrics: {
      current: this.metrics,
      
      trends: {
        last24h: await this.getMetricsForPeriod(last24h, now),
        last7d: await this.getMetricsForPeriod(last7d, now),
        comparison: await this.getMetricsComparison()
      }
    },
    
    health: {
      status: this.calculateHealthStatus(),
      indicators: this.getHealthIndicators(),
      recommendations: this.getHealthRecommendations()
    },
    
    recentEvents: await this.getRecentReconnectionEvents(50),
    
    predictions: {
      nextReconnectionRisk: this.predictNextReconnectionRisk(),
      patternAnalysis: this.analyzeReconnectionPatterns()
    }
  };
}

private calculateHealthStatus(): 'healthy' | 'warning' | 'critical' {
  const { health } = this.metrics;
  
  if (health.consecutiveFailures >= 5) return 'critical';
  if (health.successRate < 0.8) return 'critical';
  if (health.consecutiveFailures >= 2) return 'warning';
  if (health.successRate < 0.95) return 'warning';
  
  return 'healthy';
}
```

### Alertas Inteligentes

```typescript
private async checkReconnectionAlerts(): Promise<void> {
  const alerts = [];
  
  // Alerta de múltiplas falhas consecutivas
  if (this.metrics.consecutiveFailures >= 3) {
    alerts.push({
      level: 'warning',
      type: 'consecutive_failures',
      message: `${this.metrics.consecutiveFailures} consecutive reconnection failures`,
      action: 'investigate_root_cause'
    });
  }
  
  // Alerta de taxa de sucesso baixa
  if (this.metrics.health.successRate < 0.9) {
    alerts.push({
      level: 'warning',
      type: 'low_success_rate',
      message: `Reconnection success rate is ${(this.metrics.health.successRate * 100).toFixed(1)}%`,
      action: 'optimize_reconnection_strategy'
    });
  }
  
  // Alerta de reconexões muito frequentes
  const recentReconnections = this.reconnectionTimestamps.filter(
    timestamp => timestamp > Date.now() - 3600000 // Última hora
  ).length;
  
  if (recentReconnections >= 10) {
    alerts.push({
      level: 'critical',
      type: 'frequent_reconnections',
      message: `${recentReconnections} reconnections in the last hour`,
      action: 'check_network_stability'
    });
  }
  
  // Alerta de duração de reconexão longa
  if (this.metrics.timing.averageDuration > 30000) {
    alerts.push({
      level: 'warning',
      type: 'slow_reconnections',
      message: `Average reconnection time is ${this.metrics.timing.averageDuration}ms`,
      action: 'optimize_reconnection_performance'
    });
  }
  
  // Envia alertas se houver
  if (alerts.length > 0) {
    await this.sendReconnectionAlerts(alerts);
  }
}

private async sendReconnectionAlerts(alerts: ReconnectionAlert[]): Promise<void> {
  for (const alert of alerts) {
    // Webhook para alertas
    this.sendDataWebhook(Events.RECONNECTION_ALERT, {
      instance: this.instance.name,
      alert,
      timestamp: new Date().toISOString()
    });
    
    // Log estruturado
    this.logger.warn('Reconnection alert triggered', {
      instanceId: this.instanceId,
      alert,
      metrics: this.metrics.health
    });
    
    // Notificação para sistemas de monitoramento
    await this.notifyMonitoringSystems(alert);
  }
}
```

## Cenários Específicos

### Reconexão Após Reboot do Servidor

```typescript
private async handleServerRebootReconnection(): Promise<void> {
  this.logger.info('Handling post-server-reboot reconnection');
  
  try {
    // 1. Verifica se instância estava ativa antes do reboot
    const wasActive = await this.checkInstanceWasActiveBeforeReboot();
    
    if (!wasActive) {
      this.logger.info('Instance was not active before reboot, skipping reconnection');
      return;
    }
    
    // 2. Aguarda estabilização do sistema
    const systemStabilizationDelay = 10000; // 10 segundos
    await this.delay(systemStabilizationDelay);
    
    // 3. Verifica conectividade de rede
    const networkReady = await this.waitForNetworkStability();
    if (!networkReady) {
      throw new Error('Network not stable after server reboot');
    }
    
    // 4. Recarrega todas as configurações
    await this.reloadAllConfigurations();
    
    // 5. Executa reconexão com configurações de reboot
    await this.executePostRebootReconnection();
    
    this.logger.info('Post-reboot reconnection completed successfully');
    
  } catch (error) {
    this.logger.error(`Post-reboot reconnection failed: ${error.message}`);
    throw error;
  }
}

private async executePostRebootReconnection(): Promise<void> {
  // Configurações específicas para reconexão pós-reboot
  const rebootConfig = {
    connectTimeoutMs: 45000,      // Timeout maior
    keepAliveIntervalMs: 40000,   // Keep-alive mais conservador
    retryRequestDelayMs: 500,     // Delay maior entre requests
    maxMsgRetryCount: 2,          // Menos retries inicialmente
  };
  
  // Salva configuração atual
  const originalConfig = this.getSocketConfig();
  
  try {
    // Aplica configuração de reboot
    this.applySocketConfig(rebootConfig);
    
    // Executa reconexão
    await this.executeReconnection(DisconnectReason.restartRequired);
    
    // Aguarda estabilização
    await this.delay(5000);
    
    // Restaura configuração normal
    this.applySocketConfig(originalConfig);
    
  } catch (error) {
    // Restaura configuração mesmo em caso de erro
    this.applySocketConfig(originalConfig);
    throw error;
  }
}
```

### Reconexão com Troca de IP

```typescript
private async handleIPChangeReconnection(): Promise<void> {
  this.logger.info('Handling IP change reconnection');
  
  try {
    // 1. Detecta mudança de IP
    const currentIP = await this.getCurrentPublicIP();
    const lastKnownIP = await this.getLastKnownIP();
    
    if (currentIP !== lastKnownIP) {
      this.logger.info(`IP changed from ${lastKnownIP} to ${currentIP}`);
      
      // 2. Aguarda propagação de DNS
      await this.delay(5000);
      
      // 3. Testa conectividade com novo IP
      const connectivityTest = await this.testConnectivityWithNewIP(currentIP);
      if (!connectivityTest.success) {
        throw new Error(`Connectivity test failed with new IP: ${connectivityTest.error}`);
      }
      
      // 4. Limpa caches relacionados a rede
      await this.clearNetworkCaches();
      
      // 5. Executa reconexão
      await this.executeReconnection(DisconnectReason.connectionLost);
      
      // 6. Salva novo IP
      await this.saveLastKnownIP(currentIP);
      
    } else {
      // IP não mudou, reconexão normal
      await this.executeReconnection(DisconnectReason.connectionLost);
    }
    
  } catch (error) {
    this.logger.error(`IP change reconnection failed: ${error.message}`);
    throw error;
  }
}
```

### Reconexão Durante Alta Carga

```typescript
private async handleHighLoadReconnection(): Promise<void> {
  this.logger.info('Handling reconnection during high system load');
  
  try {
    // 1. Detecta alta carga do sistema
    const systemLoad = await this.getSystemLoad();
    
    if (systemLoad.cpu > 80 || systemLoad.memory > 90) {
      this.logger.warn(`High system load detected - CPU: ${systemLoad.cpu}%, Memory: ${systemLoad.memory}%`);
      
      // 2. Reduz prioridade do processo de reconexão
      await this.reducePriority();
      
      // 3. Usa configurações conservadoras
      const conservativeConfig = {
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 60000,
        retryRequestDelayMs: 1000,
        maxMsgRetryCount: 1,
      };
      
      this.applySocketConfig(conservativeConfig);
      
      // 4. Aguarda redução da carga
      await this.waitForLoadReduction(systemLoad);
    }
    
    // 5. Executa reconexão
    await this.executeReconnection(DisconnectReason.connectionLost);
    
  } catch (error) {
    this.logger.error(`High load reconnection failed: ${error.message}`);
    throw error;
  } finally {
    // Restaura prioridade normal
    await this.restoreNormalPriority();
  }
}

private async waitForLoadReduction(currentLoad: SystemLoad): Promise<void> {
  const maxWaitTime = 60000; // 1 minuto
  const checkInterval = 5000; // 5 segundos
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const load = await this.getSystemLoad();
    
    if (load.cpu < 70 && load.memory < 80) {
      this.logger.info('System load reduced, proceeding with reconnection');
      return;
    }
    
    this.logger.info(`Waiting for load reduction - CPU: ${load.cpu}%, Memory: ${load.memory}%`);
    await this.delay(checkInterval);
  }
  
  this.logger.warn('Proceeding with reconnection despite high load');
}
```

## Debugging e Troubleshooting

### Ferramentas de Debug

```typescript
public async debugReconnection(): Promise<ReconnectionDebugInfo> {
  return {
    instance: {
      id: this.instanceId,
      name: this.instance.name,
      state: this.stateConnection.state,
      isReconnecting: this.isReconnecting,
      endSession: this.endSession
    },
    
    authState: {
      exists: !!this.instance.authState,
      hasCreds: !!this.instance.authState?.state?.creds,
      hasKeys: !!this.instance.authState?.state?.keys,
      canSave: typeof this.instance.authState?.saveCreds === 'function'
    },
    
    network: {
      clientReady: this.client?.ws?.readyState === 1,
      proxyEnabled: this.localProxy?.enabled || false,
      connectivity: await this.testNetworkConnectivity()
    },
    
    cache: {
      msgRetryCounter: this.msgRetryCounterCache.keys().length,
      userDevices: this.userDevicesCache.keys().length,
      redisConnected: await this.testRedisConnection()
    },
    
    metrics: {
      reconnectionAttempts: this.reconnectionAttempts,
      consecutiveFailures: this.metrics.consecutiveFailures,
      lastSuccess: this.lastSuccessfulConnection,
      averageDuration: this.metrics.timing.averageDuration
    },
    
    history: await this.getRecentReconnectionHistory(),
    
    configuration: {
      settings: this.localSettings ? 'loaded' : 'not_loaded',
      webhook: this.localWebhook ? 'configured' : 'not_configured',
      chatwoot: this.localChatwoot?.enabled || false,
      qrCodeLimit: this.configService.get<QrCode>('QRCODE').LIMIT
    }
  };
}

public async traceReconnectionFlow(statusCode: number): Promise<ReconnectionTrace> {
  const trace: ReconnectionTrace = {
    timestamp: Date.now(),
    statusCode,
    steps: []
  };
  
  try {
    // Passo 1: Análise inicial
    trace.steps.push({
      step: 'analysis',
      timestamp: Date.now(),
      status: 'started',
      data: { statusCode }
    });
    
    const decision = this.analyzeDisconnectionCode(statusCode);
    
    trace.steps.push({
      step: 'analysis',
      timestamp: Date.now(),
      status: 'completed',
      data: decision
    });
    
    if (!decision.shouldReconnect) {
      trace.steps.push({
        step: 'decision',
        timestamp: Date.now(),
        status: 'completed',
        data: { decision: 'no_reconnection', reason: decision.reason }
      });
      return trace;
    }
    
    // Passo 2: Pré-requisitos
    trace.steps.push({
      step: 'prerequisites',
      timestamp: Date.now(),
      status: 'started'
    });
    
    const canReconnect = await this.checkReconnectionPrerequisites();
    
    trace.steps.push({
      step: 'prerequisites',
      timestamp: Date.now(),
      status: canReconnect ? 'completed' : 'failed',
      data: { canReconnect }
    });
    
    if (!canReconnect) {
      return trace;
    }
    
    // Passo 3: Execução
    trace.steps.push({
      step: 'execution',
      timestamp: Date.now(),
      status: 'started'
    });
    
    await this.executeReconnection(statusCode);
    
    trace.steps.push({
      step: 'execution',
      timestamp: Date.now(),
      status: 'completed'
    });
    
    return trace;
    
  } catch (error) {
    trace.steps.push({
      step: 'error',
      timestamp: Date.now(),
      status: 'failed',
      data: { error: error.message }
    });
    
    return trace;
  }
}
```

### Comandos de Diagnóstico

```typescript
public async runReconnectionDiagnostics(): Promise<DiagnosticResults> {
  const diagnostics: DiagnosticResults = {
    timestamp: Date.now(),
    tests: []
  };
  
  // Teste 1: Conectividade básica
  diagnostics.tests.push(await this.testBasicConnectivity());
  
  // Teste 2: Auth state
  diagnostics.tests.push(await this.testAuthState());
  
  // Teste 3: Configurações
  diagnostics.tests.push(await this.testConfigurations());
  
  // Teste 4: Recursos do sistema
  diagnostics.tests.push(await this.testSystemResources());
  
  // Teste 5: Cache e storage
  diagnostics.tests.push(await this.testCacheAndStorage());
  
  // Teste 6: Histórico de reconexões
  diagnostics.tests.push(await this.analyzeReconnectionHistory());
  
  // Resumo geral
  const passedTests = diagnostics.tests.filter(t => t.status === 'passed').length;
  const totalTests = diagnostics.tests.length;
  
  diagnostics.summary = {
    overallStatus: passedTests === totalTests ? 'healthy' : 'issues_detected',
    passedTests,
    totalTests,
    recommendations: this.generateRecommendations(diagnostics.tests)
  };
  
  return diagnostics;
}

private async testBasicConnectivity(): Promise<DiagnosticTest> {
  try {
    const networkTest = await this.performNetworkCheck();
    
    return {
      name: 'Basic Connectivity',
      status: networkTest.isConnected ? 'passed' : 'failed',
      message: networkTest.isConnected 
        ? 'Network connectivity is working'
        : `Network connectivity failed: ${networkTest.error}`,
      details: networkTest
    };
  } catch (error) {
    return {
      name: 'Basic Connectivity',
      status: 'error',
      message: `Connectivity test error: ${error.message}`,
      details: { error: error.message }
    };
  }
}

private async testAuthState(): Promise<DiagnosticTest> {
  try {
    const hasAuthState = !!this.instance.authState;
    const hasCreds = !!this.instance.authState?.state?.creds;
    const hasKeys = !!this.instance.authState?.state?.keys;
    const canSave = typeof this.instance.authState?.saveCreds === 'function';
    
    const allGood = hasAuthState && hasCreds && hasKeys && canSave;
    
    return {
      name: 'Auth State',
      status: allGood ? 'passed' : 'failed',
      message: allGood 
        ? 'Auth state is complete and functional'
        : 'Auth state has issues',
      details: { hasAuthState, hasCreds, hasKeys, canSave }
    };
  } catch (error) {
    return {
      name: 'Auth State',
      status: 'error',
      message: `Auth state test error: ${error.message}`,
      details: { error: error.message }
    };
  }
}
```

## Conclusão

O sistema de reconexão do WhatsApp é uma arquitetura sofisticada que garante:

1. **Detecção Inteligente** de situações que necessitam reconexão
2. **Estratégias Adaptativas** baseadas no tipo de desconexão
3. **Preservação de Estado** durante todo o processo
4. **Otimizações de Performance** para reconexões rápidas
5. **Monitoramento Abrangente** com métricas e alertas
6. **Tratamento Robusto de Falhas** com escalation automático
7. **Ferramentas de Debug** completas para troubleshooting

A implementação permite alta disponibilidade do serviço WhatsApp com reconexões transparentes e manutenção da continuidade da sessão, adaptando-se automaticamente às diferentes condições de rede e sistema. 