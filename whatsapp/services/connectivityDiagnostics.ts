/**
 * Serviço de Diagnóstico de Conectividade WhatsApp
 * Verifica problemas comuns e sugere soluções
 */

export interface ConnectivityIssue {
  type: 'dns_block' | 'firewall' | 'rate_limit' | 'infrastructure' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  solution: string;
  shouldUseMobile: boolean;
}

export class ConnectivityDiagnostics {
  
  /**
   * Diagnóstica problemas baseados no erro
   */
  static diagnoseError(error: any): ConnectivityIssue {
    const errorMsg = error?.message || error?.toString() || '';
    
    // DNS/ENOTFOUND (mais comum)
    if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
      return {
        type: 'dns_block',
        severity: 'critical',
        message: 'Bloqueio de DNS detectado para web.whatsapp.com',
        solution: 'Usar protocolo mobile (mmg.whatsapp.net) para contornar bloqueio',
        shouldUseMobile: true
      };
    }
    
    // WebSocket errors
    if (errorMsg.includes('WebSocket') || errorMsg.includes('ws://') || errorMsg.includes('wss://')) {
      return {
        type: 'firewall',
        severity: 'high',
        message: 'Conexão WebSocket bloqueada',
        solution: 'Firewall ou proxy está bloqueando WebSockets. Usar mobile: true',
        shouldUseMobile: true
      };
    }
    
    // Rate limiting
    if (errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('Too many')) {
      return {
        type: 'rate_limit',
        severity: 'medium',
        message: 'Limite de tentativas excedido',
        solution: 'Aguardar antes de tentar novamente. Limpar sessão e reconectar',
        shouldUseMobile: false
      };
    }
    
    // Hugging Face / Replit specific
    if (errorMsg.includes('spaces') || errorMsg.includes('replit') || errorMsg.includes('railway')) {
      return {
        type: 'infrastructure',
        severity: 'high',
        message: 'Ambiente de hospedagem restritivo detectado',
        solution: 'Usar configuração mobile otimizada para plataformas cloud',
        shouldUseMobile: true
      };
    }
    
    // Timeout
    if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
      return {
        type: 'infrastructure',
        severity: 'medium',
        message: 'Timeout de conexão',
        solution: 'Aumentar timeouts e usar protocolo mobile',
        shouldUseMobile: true
      };
    }
    
    return {
      type: 'unknown',
      severity: 'medium',
      message: 'Erro desconhecido de conectividade',
      solution: 'Tentar protocolo mobile como fallback',
      shouldUseMobile: true
    };
  }
  
  /**
   * Verifica se o ambiente é restritivo
   */
  static checkEnvironment(): {
    isRestrictive: boolean;
    platform: string;
    recommendations: string[];
  } {
    const hostname = process.env.HOSTNAME || '';
    const platform = process.env.REPL_SLUG ? 'replit' : 
                     process.env.SPACE_ID ? 'huggingface' :
                     hostname.includes('railway') ? 'railway' :
                     hostname.includes('vercel') ? 'vercel' :
                     hostname.includes('heroku') ? 'heroku' : 'unknown';
    
    const restrictivePlatforms = ['replit', 'huggingface', 'railway', 'vercel'];
    const isRestrictive = restrictivePlatforms.includes(platform);
    
    const recommendations: string[] = [];
    
    if (isRestrictive) {
      recommendations.push('Usar mobile: true obrigatoriamente');
      recommendations.push('Usar mmg.whatsapp.net em vez de web.whatsapp.com');
      recommendations.push('Timeouts mais conservadores');
      recommendations.push('Reduzir tráfego WebSocket (syncFullHistory: false)');
    }
    
    if (platform === 'replit') {
      recommendations.push('Verificar se Always On está ativo');
      recommendations.push('Configurar REPL_SECRETS corretamente');
    }
    
    if (platform === 'huggingface') {
      recommendations.push('Verificar se Space tem CPU persistente');
      recommendations.push('Considerar usar Space privado');
    }
    
    return {
      isRestrictive,
      platform,
      recommendations
    };
  }
  
  /**
   * Gera configuração otimizada baseada no ambiente
   */
  static getOptimizedConfig(): {
    mobile: boolean;
    browser: [string, string, string];
    timeouts: Record<string, number>;
    features: Record<string, boolean>;
  } {
    const env = this.checkEnvironment();
    
    return {
      mobile: true, // Sempre usar mobile em ambientes cloud
      browser: ['Ubuntu', 'Chrome', '20.0.04'], // Browser Linux confiável
      timeouts: {
        connectTimeoutMs: env.isRestrictive ? 90000 : 60000,
        defaultQueryTimeoutMs: env.isRestrictive ? 90000 : 60000,
        keepAliveIntervalMs: env.isRestrictive ? 30000 : 25000,
        qrTimeout: env.isRestrictive ? 120000 : 90000,
        retryRequestDelayMs: env.isRestrictive ? 3000 : 2000
      },
      features: {
        syncFullHistory: false, // Reduzir tráfego
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: false,
        emitOwnEvents: false,
        fireInitQueries: true // Importante para handshake
      }
    };
  }
  
  /**
   * Log diagnósticos no console
   */
  static logEnvironmentInfo(): void {
    const env = this.checkEnvironment();
    const config = this.getOptimizedConfig();
    
    console.log('\n🔍 === DIAGNÓSTICO DE CONECTIVIDADE WHATSAPP ===');
    console.log(`🌐 Plataforma: ${env.platform}`);
    console.log(`⚠️  Ambiente restritivo: ${env.isRestrictive ? 'SIM' : 'NÃO'}`);
    console.log(`📱 Protocolo mobile: ${config.mobile ? 'ATIVADO' : 'DESATIVADO'}`);
    console.log(`🔗 Servidor: ${config.mobile ? 'mmg.whatsapp.net' : 'web.whatsapp.com'}`);
    
    if (env.recommendations.length > 0) {
      console.log('💡 Recomendações:');
      env.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
    
    console.log('⚙️  Timeouts otimizados:');
    Object.entries(config.timeouts).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value}ms`);
    });
    
    console.log('🔧 Features otimizadas:');
    Object.entries(config.features).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value}`);
    });
    
    console.log('=== FIM DO DIAGNÓSTICO ===\n');
  }
}

export const connectivityDiagnostics = new ConnectivityDiagnostics(); 