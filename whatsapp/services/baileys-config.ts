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
  static async getSocketConfig(sessionState: any) {
    // Buscar versão mais recente do WhatsApp Web
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(`🔧 [BAILEYS-CONFIG] WhatsApp v${version.join('.')}, é a versão mais recente: ${isLatest}`)
    
    return {
      version,
      auth: sessionState,
      
      // 🔥 CONFIGURAÇÃO DE BROWSER OTIMIZADA PARA V6.7.18
      browser: Browsers.ubuntu('MultiWhatsApp'),
      
      // 🔥 LOGGER SILENCIOSO
      logger: P({ level: 'silent' }),
      printQRInTerminal: false,
      
      // 🔥 TIMEOUTS AUMENTADOS PARA AMBIENTES LENTOS
      connectTimeoutMs: 180000, // 3 minutos para conectar
      defaultQueryTimeoutMs: 90000, // 1.5 minutos para queries
      qrTimeout: 180000, // QR válido por 3 minutos
      keepAliveIntervalMs: 45000, // Keep alive a cada 45s
      retryRequestDelayMs: 8000, // 8 segundos entre tentativas
      maxMsgRetryCount: 3, // Máximo 3 tentativas para evitar loops
      
      // 🔥 CONFIGURAÇÕES DE PERFORMANCE PARA AMBIENTES RESTRITIVOS
      markOnlineOnConnect: false, // Não marcar online automaticamente
      syncFullHistory: false, // Nunca sincronizar histórico completo
      generateHighQualityLinkPreview: false, // Sem previews de alta qualidade
      emitOwnEvents: false, // Não emitir eventos próprios
      fireInitQueries: false, // Não executar queries de inicialização
      
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