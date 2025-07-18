import { Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import P from 'pino'

/**
 * Configuração otimizada para Baileys 6.7.18 em ambientes hospedados
 * Resolve problemas de conectividade em Replit, HuggingFace, etc.
 * ATUALIZADO: Removido mobile: true depreciado
 */
export class BaileysConfig {
  
  /**
   * Configuração principal do socket para ambientes restritivos
   */
  static async getSocketConfig(sessionState: any, retryCount: number = 0) {
    // Buscar versão mais recente do WhatsApp Web
    let version: [number, number, number] = [2, 2419, 6]; // Fallback seguro
    
    try {
      if (retryCount === 0) {
        // Primeira tentativa: versão dinâmica
        const { version: dynamicVersion } = await fetchLatestBaileysVersion()
        version = dynamicVersion as [number, number, number];
      } else {
        // Tentativas subsequentes: versão fixa
      }
    } catch (error) {
      //
    }
    
    // 🔥 CONFIGURAÇÕES PROGRESSIVAS BASEADAS NO NÚMERO DE TENTATIVAS
    const configs = [
      // Tentativa 1: Configuração padrão
      {
        browser: Browsers.macOS('Chrome'),
        connectTimeoutMs: 45000,
        defaultQueryTimeoutMs: 45000,
        qrTimeout: 45000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 3000,
        maxMsgRetryCount: 3,
        markOnlineOnConnect: true,
        fireInitQueries: true,
      },
      // Tentativa 2: Configuração mais conservadora
      {
        browser: Browsers.ubuntu('WhatsApp'),
        connectTimeoutMs: 30000,
        defaultQueryTimeoutMs: 30000,
        qrTimeout: 30000,
        keepAliveIntervalMs: 15000,
        retryRequestDelayMs: 2000,
        maxMsgRetryCount: 2,
        markOnlineOnConnect: false,
        fireInitQueries: false,
      },
      // Tentativa 3: Configuração minimalista
      {
        browser: ['WhatsApp', 'Chrome', '4.0.0'],
        connectTimeoutMs: 20000,
        defaultQueryTimeoutMs: 20000,
        qrTimeout: 20000,
        keepAliveIntervalMs: 10000,
        retryRequestDelayMs: 1000,
        maxMsgRetryCount: 1,
        markOnlineOnConnect: false,
        fireInitQueries: false,
      }
    ];
    
    const currentConfig = configs[Math.min(retryCount, configs.length - 1)];
    
    return {
      version,
      auth: sessionState,
      
      // 🔥 CONFIGURAÇÃO DE BROWSER PROGRESSIVA
      browser: currentConfig.browser,
      
      // 🔥 LOGGER SILENCIOSO
      logger: P({ level: 'silent' }),
      printQRInTerminal: false,
      
      // 🔥 TIMEOUTS PROGRESSIVOS
      connectTimeoutMs: currentConfig.connectTimeoutMs,
      defaultQueryTimeoutMs: currentConfig.defaultQueryTimeoutMs,
      qrTimeout: currentConfig.qrTimeout,
      keepAliveIntervalMs: currentConfig.keepAliveIntervalMs,
      retryRequestDelayMs: currentConfig.retryRequestDelayMs,
      maxMsgRetryCount: currentConfig.maxMsgRetryCount,
      
      // 🔥 CONFIGURAÇÕES DE PERFORMANCE PROGRESSIVAS
      markOnlineOnConnect: currentConfig.markOnlineOnConnect,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      emitOwnEvents: false,
      fireInitQueries: currentConfig.fireInitQueries,
      
      // 🔥 CONFIGURAÇÕES PARA REDUZIR TRÁFEGO
      shouldSyncHistoryMessage: () => false, // Nunca sincronizar mensagens
      shouldIgnoreJid: () => false, // Não ignorar JIDs
      
      // 🔥 CONFIGURAÇÕES DE CACHE E MEMÓRIA
      cachedGroupMetadata: async () => undefined,
      shouldProcessHistoryMessage: () => false, // Não processar histórico
      
      // 🔥 CONFIGURAÇÕES DE RECONEXÃO
      transactionOpts: {
        maxCommitRetries: 3,
        delayBetweenTriesMs: 5000
      },
      
      // 🔥 CONFIGURAÇÕES DE MENSAGEM
      getMessage: async () => undefined, // Sem recuperação de mensagens
      
      // 🔥 CONFIGURAÇÕES EXPERIMENTAIS PARA MELHOR CONECTIVIDADE
      linkPreviewImageThumbnailWidth: 0, // Sem thumbnails
      options: {
        // Configurações adicionais para estabilidade
      }
    }
  }
  
  /**
   * Validar ambiente de execução
   */
  static validateEnvironment() {
    const isReplit = process.env.REPL_ID !== undefined
    const isHuggingFace = process.env.SPACE_ID !== undefined
    const isCloudRun = process.env.K_SERVICE !== undefined
    const isVercel = process.env.VERCEL !== undefined
    
    return {
      platform: isReplit ? 'Replit' : isHuggingFace ? 'HuggingFace' : 
                isCloudRun ? 'CloudRun' : isVercel ? 'Vercel' : 'Local',
      isRestrictive: isReplit || isHuggingFace || isCloudRun || isVercel,
      hasTimeouts: true
    }
  }
  
  /**
   * Configurações específicas para contornar bloqueios de rede
   */
  static getNetworkOptimizations() {
    return {
      // Configurações de DNS e rede
      dnsConfig: {
        // Usar DNS alternativos se necessário
        servers: ['8.8.8.8', '1.1.1.1']
      },
      
      // Headers HTTP otimizados
      headers: {
        'User-Agent': 'WhatsApp/2.2316.4 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      
      // Configurações de proxy se necessário
      proxy: {
        enabled: false, // Desabilitado por padrão
        host: '',
        port: 0
      }
    }
  }
  
  /**
   * Configurações de monitoramento para detectar problemas
   */
  static getMonitoringConfig() {
    return {
      // Intervalo de health check
      healthCheckInterval: 90000, // 1.5 minutos
      
      // Timeout para reconexão
      reconnectionDelay: 15000, // 15 segundos
      
      // Máximo de tentativas de reconexão
      maxReconnectionAttempts: 5,
      
      // Timeout para detecção de problemas
      connectionTimeout: 300000, // 5 minutos
      
      // Logs detalhados para debug
      detailedLogging: true
    }
  }
} 