# Guia Completo: Eventos de Desconexão do QR Code WhatsApp

## Índice
1. [Visão Geral](#visão-geral)
2. [Tipos de Desconexão](#tipos-de-desconexão)
3. [Códigos de Status e Razões](#códigos-de-status-e-razões)
4. [Fluxo de Detecção de Desconexão](#fluxo-de-detecção-de-desconexão)
5. [Lógica de Reconexão](#lógica-de-reconexão)
6. [Limpeza de Dados](#limpeza-de-dados)
7. [Eventos e Webhooks](#eventos-e-webhooks)
8. [Tratamento de Erros](#tratamento-de-erros)
9. [Logs e Monitoramento](#logs-e-monitoramento)
10. [Casos Especiais](#casos-especiais)
11. [Estratégias de Recovery](#estratégias-de-recovery)
12. [Debugging e Troubleshooting](#debugging-e-troubleshooting)

## Visão Geral

O sistema de desconexão do QR code é responsável por detectar, classificar e responder adequadamente às diferentes situações de perda de conexão com o WhatsApp. Ele determina quando tentar reconectar automaticamente e quando encerrar definitivamente a sessão.

### Arquitetura de Desconexão

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WhatsApp      │    │   Baileys       │    │   Sistema de    │
│   Servidor      │────▶│   Client        │────▶│   Desconexão    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                           ┌─────────────────────────────────────────┐
                           │         Tipos de Resposta              │
                           │  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
                           │  │Reconexão│  │ Logout  │  │ Cleanup │ │
                           │  │Automática│  │ Sessão  │  │  Dados  │ │
                           │  └─────────┘  └─────────┘  └─────────┘ │
                           └─────────────────────────────────────────┘
```

## Tipos de Desconexão

### 1. Desconexões Temporárias (Reconectáveis)

**Características**:
- Problemas de rede temporários
- Instabilidade do servidor WhatsApp
- Reinicializações do servidor
- Timeouts de conexão

**Códigos Associados**:
- `DisconnectReason.connectionClosed` (código não especificado)
- `DisconnectReason.connectionLost` 
- `DisconnectReason.restartRequired`
- `DisconnectReason.timedOut`

### 2. Desconexões Permanentes (Não Reconectáveis)

**Características**:
- Usuário foi deslogado do WhatsApp
- Dispositivo foi banido
- Sessão expirou ou foi invalidada
- Problemas de autenticação

**Códigos Associados**:
- `DisconnectReason.loggedOut` (401)
- `DisconnectReason.forbidden` (403)
- `402` (Payment required)
- `406` (Not acceptable)

### 3. Desconexões por Limite de QR Code

**Características**:
- Limite de tentativas de QR code atingido
- Usuário não escaneou dentro do tempo limite
- Múltiplas tentativas falharam

**Tratamento Especial**:
```typescript
if (this.instance.qrcode.count === this.configService.get<QrCode>('QRCODE').LIMIT) {
  this.sendDataWebhook(Events.QRCODE_UPDATED, {
    message: 'QR code limit reached, please login again',
    statusCode: DisconnectReason.badSession,
  });

  this.endSession = true;
  return this.eventEmitter.emit('no.connection', this.instance.name);
}
```

## Códigos de Status e Razões

### Códigos de Desconexão do Baileys

```typescript
enum DisconnectReason {
  connectionClosed = 428,     // Conexão fechada inesperadamente
  connectionLost = 408,       // Conexão perdida (timeout)
  connectionReplaced = 440,   // Conexão substituída por outra sessão
  timedOut = 408,            // Timeout de conexão
  loggedOut = 401,           // Usuário deslogado
  badSession = 500,          // Sessão inválida/corrompida
  restartRequired = 515,     // Reinicialização necessária
  multideviceMismatch = 411, // Conflito multi-device
  forbidden = 403,           // Acesso negado
  unavailable = 503,         // Serviço indisponível
}
```

### Mapeamento de Ações por Código

```typescript
const disconnectionActions = {
  // RECONECTÁVEIS
  428: { action: 'reconnect', reason: 'Connection closed unexpectedly' },
  408: { action: 'reconnect', reason: 'Connection timeout' },
  440: { action: 'reconnect', reason: 'Connection replaced' },
  515: { action: 'reconnect', reason: 'Restart required' },
  503: { action: 'reconnect', reason: 'Service unavailable' },
  
  // NÃO RECONECTÁVEIS  
  401: { action: 'logout', reason: 'User logged out' },
  403: { action: 'logout', reason: 'Access forbidden' },
  402: { action: 'logout', reason: 'Payment required' },
  406: { action: 'logout', reason: 'Not acceptable' },
  500: { action: 'logout', reason: 'Bad session' },
  411: { action: 'logout', reason: 'Multi-device mismatch' },
};
```

## Fluxo de Detecção de Desconexão

### Método Principal: connectionUpdate()

```typescript
private async connectionUpdate({ qr, connection, lastDisconnect }: Partial<ConnectionState>) {
  // 1. Atualiza estado da conexão
  if (connection) {
    this.stateConnection = {
      state: connection,
      statusReason: (lastDisconnect?.error as Boom)?.output?.statusCode ?? 200,
    };
  }

  // 2. Processa desconexão
  if (connection === 'close') {
    await this.handleDisconnection(lastDisconnect);
  }

  // 3. Processa conexão estabelecida
  if (connection === 'open') {
    await this.handleConnectionEstablished();
  }

  // 4. Processa estado de conectando
  if (connection === 'connecting') {
    this.sendDataWebhook(Events.CONNECTION_UPDATE, { 
      instance: this.instance.name, 
      ...this.stateConnection 
    });
  }
}
```

### Detalhamento do Processo de Desconexão

```typescript
private async handleDisconnection(lastDisconnect: any) {
  // 1. Extrai código de status
  const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
  const errorMessage = lastDisconnect?.error?.message;
  
  this.logger.warn(`Disconnection detected - Code: ${statusCode}, Message: ${errorMessage}`);

  // 2. Define códigos que não devem reconectar
  const codesToNotReconnect = [
    DisconnectReason.loggedOut,    // 401
    DisconnectReason.forbidden,    // 403  
    402,                           // Payment required
    406                            // Not acceptable
  ];

  // 3. Determina se deve reconectar
  const shouldReconnect = !codesToNotReconnect.includes(statusCode);

  if (shouldReconnect) {
    await this.handleReconnection(statusCode, errorMessage);
  } else {
    await this.handlePermanentDisconnection(statusCode, lastDisconnect);
  }
}
```

## Lógica de Reconexão

### Reconexão Automática

```typescript
private async handleReconnection(statusCode: number, errorMessage: string) {
  this.logger.info(`Attempting automatic reconnection - Code: ${statusCode}`);
  
  try {
    // 1. Aguarda antes de reconectar (backoff)
    const delay = this.calculateReconnectionDelay(statusCode);
    await new Promise(resolve => setTimeout(resolve, delay));

    // 2. Tenta reconectar mantendo o número de telefone
    await this.connectToWhatsapp(this.phoneNumber);
    
    this.logger.info('Reconnection successful');
  } catch (error) {
    this.logger.error(`Reconnection failed: ${error.message}`);
    
    // Se falhar, tenta novamente até um limite
    await this.retryReconnection(statusCode, errorMessage);
  }
}
```

### Cálculo de Delay de Reconexão

```typescript
private calculateReconnectionDelay(statusCode: number): number {
  const delays = {
    428: 2000,   // Connection closed - 2s
    408: 5000,   // Timeout - 5s  
    440: 3000,   // Connection replaced - 3s
    515: 1000,   // Restart required - 1s
    503: 10000,  // Service unavailable - 10s
  };

  return delays[statusCode] || 5000; // Default 5s
}
```

### Sistema de Retry com Backoff

```typescript
private async retryReconnection(statusCode: number, errorMessage: string, attempt: number = 1) {
  const maxAttempts = 5;
  const baseDelay = this.calculateReconnectionDelay(statusCode);
  
  if (attempt > maxAttempts) {
    this.logger.error(`Max reconnection attempts reached for code ${statusCode}`);
    await this.handlePermanentDisconnection(statusCode, { error: { message: errorMessage } });
    return;
  }

  // Exponential backoff
  const delay = baseDelay * Math.pow(2, attempt - 1);
  
  this.logger.info(`Reconnection attempt ${attempt}/${maxAttempts} in ${delay}ms`);
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  try {
    await this.connectToWhatsapp(this.phoneNumber);
    this.logger.info(`Reconnection successful on attempt ${attempt}`);
  } catch (error) {
    this.logger.warn(`Reconnection attempt ${attempt} failed: ${error.message}`);
    await this.retryReconnection(statusCode, errorMessage, attempt + 1);
  }
}
```

## Limpeza de Dados

### Desconexão Permanente

```typescript
private async handlePermanentDisconnection(statusCode: number, lastDisconnect: any) {
  this.logger.warn(`Permanent disconnection - Code: ${statusCode}`);

  try {
    // 1. Emite webhook de status
    this.sendDataWebhook(Events.STATUS_INSTANCE, {
      instance: this.instance.name,
      status: 'closed',
      disconnectionAt: new Date(),
      disconnectionReasonCode: statusCode,
      disconnectionObject: JSON.stringify(lastDisconnect),
    });

    // 2. Atualiza status no banco de dados
    await this.prismaRepository.instance.update({
      where: { id: this.instanceId },
      data: {
        connectionStatus: 'close',
        disconnectionAt: new Date(),
        disconnectionReasonCode: statusCode,
        disconnectionObject: JSON.stringify(lastDisconnect),
      },
    });

    // 3. Notifica integração Chatwoot (se habilitada)
    if (this.configService.get<Chatwoot>('CHATWOOT').ENABLED && this.localChatwoot?.enabled) {
      this.chatwootService.eventWhatsapp(
        Events.STATUS_INSTANCE,
        { instanceName: this.instance.name, instanceId: this.instanceId },
        { instance: this.instance.name, status: 'closed' },
      );
    }

    // 4. Emite evento interno de logout
    this.eventEmitter.emit('logout.instance', this.instance.name, 'inner');

    // 5. Fecha conexões
    this.client?.ws?.close();
    this.client.end(new Error('Close connection'));

    // 6. Emite webhook final de atualização
    this.sendDataWebhook(Events.CONNECTION_UPDATE, { 
      instance: this.instance.name, 
      ...this.stateConnection 
    });

    // 7. Limpa dados da sessão (se configurado)
    await this.cleanupSessionData(statusCode);

  } catch (error) {
    this.logger.error(`Error during permanent disconnection cleanup: ${error.message}`);
  }
}
```

### Limpeza de Dados de Sessão

```typescript
private async cleanupSessionData(statusCode: number) {
  const cleanupCodes = [
    DisconnectReason.loggedOut,  // 401
    DisconnectReason.forbidden,  // 403
    DisconnectReason.badSession, // 500
  ];

  if (cleanupCodes.includes(statusCode)) {
    this.logger.info(`Cleaning session data for code ${statusCode}`);

    try {
      // 1. Remove sessão do banco
      const sessionExists = await this.prismaRepository.session.findFirst({ 
        where: { sessionId: this.instanceId } 
      });
      
      if (sessionExists) {
        await this.prismaRepository.session.delete({ 
          where: { sessionId: this.instanceId } 
        });
        this.logger.info('Session data removed from database');
      }

      // 2. Limpa cache Redis (se habilitado)
      const cache = this.configService.get<CacheConf>('CACHE');
      if (cache?.REDIS.ENABLED) {
        await this.cache.del(`auth:${this.instanceId}:*`);
        this.logger.info('Session data removed from Redis cache');
      }

      // 3. Remove arquivos de sessão (se usando provider de arquivos)
      const provider = this.configService.get<ProviderSession>('PROVIDER');
      if (provider?.ENABLED) {
        await this.authStateProvider.cleanup(this.instanceId);
        this.logger.info('Session files removed');
      }

    } catch (error) {
      this.logger.error(`Error cleaning session data: ${error.message}`);
    }
  }
}
```

## Eventos e Webhooks

### Webhooks Emitidos Durante Desconexão

```typescript
// 1. Status da instância
this.sendDataWebhook(Events.STATUS_INSTANCE, {
  instance: this.instance.name,
  status: 'closed',
  disconnectionAt: new Date(),
  disconnectionReasonCode: statusCode,
  disconnectionObject: JSON.stringify(lastDisconnect),
});

// 2. Atualização de conexão  
this.sendDataWebhook(Events.CONNECTION_UPDATE, {
  instance: this.instance.name,
  state: 'close',
  statusReason: statusCode,
  wuid: this.instance.wuid,
  profileName: await this.getProfileName(),
  profilePictureUrl: this.instance.profilePictureUrl,
});

// 3. QR code atualizado (se aplicável)
this.sendDataWebhook(Events.QRCODE_UPDATED, {
  message: 'QR code limit reached, please login again',
  statusCode: DisconnectReason.badSession,
});
```

### Eventos Internos

```typescript
// 1. Evento de logout interno
this.eventEmitter.emit('logout.instance', this.instance.name, 'inner');

// 2. Evento de falta de conexão
this.eventEmitter.emit('no.connection', this.instance.name);

// 3. Evento de reconexão bem-sucedida
this.eventEmitter.emit('reconnection.success', {
  instance: this.instance.name,
  previousDisconnectCode: statusCode,
  reconnectionTime: Date.now() - disconnectionTime
});
```

## Tratamento de Erros

### Try-Catch em Operações Críticas

```typescript
private async safeReconnection() {
  try {
    await this.connectToWhatsapp(this.phoneNumber);
  } catch (connectionError) {
    this.logger.error(`Reconnection failed: ${connectionError.message}`);
    
    // Tenta identificar o tipo de erro
    if (connectionError.message.includes('ENOTFOUND')) {
      this.logger.error('DNS resolution failed - network issue');
    } else if (connectionError.message.includes('ECONNREFUSED')) {
      this.logger.error('Connection refused - service down');
    } else if (connectionError.message.includes('timeout')) {
      this.logger.error('Connection timeout - slow network');
    }
    
    // Re-throw para handling upstream
    throw connectionError;
  }
}
```

### Validação de Estado Antes de Operações

```typescript
private async validateInstanceState() {
  // 1. Verifica se instância ainda existe
  const instance = await this.prismaRepository.instance.findFirst({
    where: { id: this.instanceId }
  });

  if (!instance) {
    throw new Error('Instance no longer exists in database');
  }

  // 2. Verifica se já não está em processo de desconexão
  if (this.endSession) {
    throw new Error('Instance is already in disconnection process');
  }

  // 3. Verifica se cliente ainda está ativo
  if (!this.client || this.client.ws?.readyState !== 1) {
    throw new Error('Client is not in ready state');
  }

  return true;
}
```

## Logs e Monitoramento

### Logs Estruturados de Desconexão

```typescript
private logDisconnectionEvent(statusCode: number, lastDisconnect: any, action: string) {
  const logData = {
    instanceId: this.instanceId,
    instanceName: this.instance.name,
    event: 'disconnection',
    statusCode,
    action, // 'reconnect' | 'logout' | 'cleanup'
    timestamp: new Date().toISOString(),
    errorMessage: lastDisconnect?.error?.message,
    stackTrace: lastDisconnect?.error?.stack,
    connectionDuration: this.getConnectionDuration(),
    previousState: this.stateConnection.state,
  };

  // Log baseado na severidade
  if (action === 'reconnect') {
    this.logger.warn('Temporary disconnection detected', logData);
  } else {
    this.logger.error('Permanent disconnection detected', logData);
  }

  // Envia para sistema de monitoramento externo
  this.sendToMonitoringSystem(logData);
}
```

### Métricas de Monitoramento

```typescript
private updateDisconnectionMetrics(statusCode: number, action: string) {
  // Incrementa contadores
  this.metrics.disconnections.total++;
  this.metrics.disconnections.byCode[statusCode] = (this.metrics.disconnections.byCode[statusCode] || 0) + 1;
  this.metrics.disconnections.byAction[action] = (this.metrics.disconnections.byAction[action] || 0) + 1;

  // Atualiza última desconexão
  this.metrics.lastDisconnection = {
    timestamp: Date.now(),
    code: statusCode,
    action
  };

  // Calcula taxa de reconexão
  if (action === 'reconnect') {
    this.metrics.reconnectionRate = 
      this.metrics.disconnections.byAction.reconnect / this.metrics.disconnections.total;
  }
}
```

## Casos Especiais

### 1. Desconexão Durante QR Code

```typescript
private async handleQRCodeDisconnection(statusCode: number) {
  // Se desconectou durante geração/espera do QR code
  if (this.instance.qrcode.count > 0 && this.stateConnection.state === 'connecting') {
    
    this.logger.info('Disconnection during QR code phase');
    
    // Reseta contador se for erro temporário
    const temporaryCodes = [428, 408, 503];
    if (temporaryCodes.includes(statusCode)) {
      this.instance.qrcode.count = Math.max(0, this.instance.qrcode.count - 1);
      this.logger.info(`QR code count reset to ${this.instance.qrcode.count}`);
    }
    
    // Tenta reconectar imediatamente
    await this.connectToWhatsapp(this.phoneNumber);
  }
}
```

### 2. Desconexão Por Múltiplos Dispositivos

```typescript
private async handleMultiDeviceConflict(statusCode: number) {
  if (statusCode === DisconnectReason.multideviceMismatch) {
    this.logger.warn('Multi-device conflict detected');
    
    // Emite webhook específico
    this.sendDataWebhook(Events.MULTIDEVICE_CONFLICT, {
      instance: this.instance.name,
      message: 'Another device is using this WhatsApp account',
      action: 'logout_required'
    });
    
    // Força logout para evitar conflitos
    await this.handlePermanentDisconnection(statusCode, {
      error: { message: 'Multi-device conflict' }
    });
  }
}
```

### 3. Desconexão Por Inatividade

```typescript
private setupInactivityDetection() {
  // Monitor de último heartbeat
  let lastHeartbeat = Date.now();
  
  const inactivityTimer = setInterval(() => {
    const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;
    const maxInactivity = 5 * 60 * 1000; // 5 minutos
    
    if (timeSinceLastHeartbeat > maxInactivity) {
      this.logger.warn('Inactivity timeout detected');
      
      // Força reconexão
      this.connectToWhatsapp(this.phoneNumber).catch(error => {
        this.logger.error(`Inactivity reconnection failed: ${error.message}`);
      });
    }
  }, 60000); // Verifica a cada minuto

  // Atualiza heartbeat em eventos do cliente
  this.client.ev.on('connection.update', () => {
    lastHeartbeat = Date.now();
  });
  
  // Limpa timer na desconexão permanente
  this.client.ev.on('close', () => {
    clearInterval(inactivityTimer);
  });
}
```

## Estratégias de Recovery

### 1. Recovery Baseado em Histórico

```typescript
private async analyzeDisconnectionHistory(statusCode: number): Promise<'retry' | 'abort'> {
  // Busca histórico de desconexões recentes
  const recentDisconnections = await this.prismaRepository.instance.findMany({
    where: {
      id: this.instanceId,
      disconnectionAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24h
      }
    },
    orderBy: { disconnectionAt: 'desc' },
    take: 10
  });

  // Se muitas desconexões com o mesmo código, pode ser problema persistente
  const sameCodeCount = recentDisconnections.filter(d => d.disconnectionReasonCode === statusCode).length;
  
  if (sameCodeCount >= 5) {
    this.logger.warn(`Too many disconnections with code ${statusCode} in last 24h: ${sameCodeCount}`);
    return 'abort';
  }

  return 'retry';
}
```

### 2. Recovery Escalonado

```typescript
private async escalatedRecovery(statusCode: number, attempt: number) {
  const recoveryStrategies = [
    // Estratégia 1: Reconexão simples
    async () => {
      this.logger.info('Recovery strategy 1: Simple reconnection');
      await this.connectToWhatsapp(this.phoneNumber);
    },
    
    // Estratégia 2: Limpeza de cache e reconexão
    async () => {
      this.logger.info('Recovery strategy 2: Clear cache and reconnect');
      await this.cache.del(`instance:${this.instanceId}:*`);
      await this.connectToWhatsapp(this.phoneNumber);
    },
    
    // Estratégia 3: Reset completo da sessão
    async () => {
      this.logger.info('Recovery strategy 3: Complete session reset');
      await this.cleanupSessionData(statusCode);
      await this.connectToWhatsapp(this.phoneNumber);
    },
    
    // Estratégia 4: Reinicialização da instância
    async () => {
      this.logger.info('Recovery strategy 4: Instance restart');
      await this.logoutInstance();
      await this.createClient(this.phoneNumber);
    }
  ];

  if (attempt <= recoveryStrategies.length) {
    try {
      await recoveryStrategies[attempt - 1]();
      this.logger.info(`Recovery strategy ${attempt} successful`);
    } catch (error) {
      this.logger.error(`Recovery strategy ${attempt} failed: ${error.message}`);
      
      if (attempt < recoveryStrategies.length) {
        await this.escalatedRecovery(statusCode, attempt + 1);
      } else {
        this.logger.error('All recovery strategies exhausted');
        await this.handlePermanentDisconnection(statusCode, { error });
      }
    }
  }
}
```

## Debugging e Troubleshooting

### Logs de Debug Detalhados

```typescript
private enableDebugLogging() {
  // Log de todas as mudanças de estado de conexão
  this.client.ev.on('connection.update', (update) => {
    this.logger.debug('Connection update:', {
      instanceId: this.instanceId,
      connection: update.connection,
      lastDisconnect: update.lastDisconnect,
      qr: !!update.qr,
      timestamp: Date.now()
    });
  });

  // Log de eventos do WebSocket
  this.client.ws?.on('close', (code, reason) => {
    this.logger.debug('WebSocket closed:', {
      instanceId: this.instanceId,
      code,
      reason: reason?.toString(),
      timestamp: Date.now()
    });
  });

  this.client.ws?.on('error', (error) => {
    this.logger.debug('WebSocket error:', {
      instanceId: this.instanceId,
      error: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });
  });
}
```

### Comandos de Diagnóstico

```typescript
public async diagnoseConnection(): Promise<DiagnosticReport> {
  const report: DiagnosticReport = {
    instanceId: this.instanceId,
    instanceName: this.instance.name,
    timestamp: Date.now(),
    
    // Estado atual
    currentState: {
      connectionStatus: this.stateConnection.state,
      lastStatusCode: this.stateConnection.statusReason,
      clientReady: this.client?.ws?.readyState === 1,
      endSession: this.endSession
    },
    
    // Verificações de rede
    network: {
      canReachWhatsApp: await this.testWhatsAppConnectivity(),
      dnsResolution: await this.testDNSResolution(),
      proxy: this.localProxy?.enabled || false
    },
    
    // Estado da sessão
    session: {
      hasAuthState: !!this.instance.authState,
      hasCredentials: !!this.instance.authState?.state?.creds,
      hasKeys: !!this.instance.authState?.state?.keys,
      sessionExists: await this.checkSessionExists()
    },
    
    // Histórico recente
    recentEvents: await this.getRecentConnectionEvents(),
    
    // Métricas
    metrics: {
      totalDisconnections: this.metrics.disconnections.total,
      reconnectionRate: this.metrics.reconnectionRate,
      lastDisconnection: this.metrics.lastDisconnection
    }
  };

  return report;
}
```

### Ferramentas de Recovery Manual

```typescript
public async forceReconnection(cleanSession: boolean = false): Promise<void> {
  this.logger.info(`Force reconnection requested - Clean session: ${cleanSession}`);
  
  try {
    // 1. Para processos atuais
    this.endSession = true;
    this.client?.ws?.close();
    
    // 2. Limpa sessão se solicitado
    if (cleanSession) {
      await this.cleanupSessionData(DisconnectReason.restartRequired);
    }
    
    // 3. Aguarda um momento
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Reinicia
    this.endSession = false;
    await this.connectToWhatsapp(this.phoneNumber);
    
    this.logger.info('Force reconnection completed successfully');
  } catch (error) {
    this.logger.error(`Force reconnection failed: ${error.message}`);
    throw error;
  }
}

public async resetInstance(): Promise<void> {
  this.logger.info('Instance reset requested');
  
  try {
    // 1. Logout completo
    await this.logoutInstance();
    
    // 2. Limpa todos os dados
    await this.cleanupSessionData(DisconnectReason.restartRequired);
    
    // 3. Reseta contadores
    this.instance.qrcode.count = 0;
    this.metrics.disconnections = { total: 0, byCode: {}, byAction: {} };
    
    // 4. Atualiza status no banco
    await this.prismaRepository.instance.update({
      where: { id: this.instanceId },
      data: {
        connectionStatus: 'close',
        ownerJid: null,
        profileName: null,
        profilePicUrl: null
      }
    });
    
    this.logger.info('Instance reset completed');
  } catch (error) {
    this.logger.error(`Instance reset failed: ${error.message}`);
    throw error;
  }
}
```

### Interfaces de Diagnóstico

```typescript
interface DiagnosticReport {
  instanceId: string;
  instanceName: string;
  timestamp: number;
  
  currentState: {
    connectionStatus: string;
    lastStatusCode: number;
    clientReady: boolean;
    endSession: boolean;
  };
  
  network: {
    canReachWhatsApp: boolean;
    dnsResolution: boolean;
    proxy: boolean;
  };
  
  session: {
    hasAuthState: boolean;
    hasCredentials: boolean;
    hasKeys: boolean;
    sessionExists: boolean;
  };
  
  recentEvents: ConnectionEvent[];
  
  metrics: {
    totalDisconnections: number;
    reconnectionRate: number;
    lastDisconnection: {
      timestamp: number;
      code: number;
      action: string;
    };
  };
}

interface ConnectionEvent {
  timestamp: number;
  event: 'connected' | 'disconnected' | 'reconnected';
  statusCode?: number;
  duration?: number;
}
```

## Conclusão

O sistema de desconexão do QR code WhatsApp é uma implementação robusta que:

1. **Classifica diferentes tipos de desconexão** (temporária vs permanente)
2. **Implementa lógica inteligente de reconexão** com backoff exponencial
3. **Gerencia limpeza adequada de dados** baseada no tipo de desconexão
4. **Emite eventos e webhooks** para notificação externa
5. **Fornece logs detalhados** para debugging e monitoramento
6. **Oferece estratégias de recovery** escalonadas
7. **Inclui ferramentas de diagnóstico** para troubleshooting

A arquitetura permite alta disponibilidade do serviço WhatsApp mesmo em cenários de instabilidade de rede ou problemas temporários do servidor, mantendo sempre a integridade dos dados da sessão. 