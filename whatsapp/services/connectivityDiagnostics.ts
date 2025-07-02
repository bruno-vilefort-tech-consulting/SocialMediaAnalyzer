/**
 * Sistema de diagnóstico de conectividade para WhatsApp
 * Detecta problemas de rede e sugere soluções
 * ATUALIZADO: Removido mobile: true depreciado do Baileys v6.7.18
 */

export interface ConnectivityDiagnostic {
  issueType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  solution: string;
  shouldUseBrowserOptimization: boolean;
}

export class ConnectivityDiagnostics {
  
  static async diagnoseEnvironment(): Promise<ConnectivityDiagnostic[]> {
    const diagnostics: ConnectivityDiagnostic[] = [];
    
    // Verificar ambiente de execução
    const envDiag = this.checkEnvironment();
    if (envDiag) diagnostics.push(envDiag);
    
    // Verificar conectividade DNS
    const dnsDiag = await this.checkDNSConnectivity();
    if (dnsDiag) diagnostics.push(dnsDiag);
    
    // Verificar portas
    const portDiag = await this.checkPortAccess();
    if (portDiag) diagnostics.push(portDiag);
    
    // Verificar WebSocket
    const wsDiag = await this.checkWebSocketSupport();
    if (wsDiag) diagnostics.push(wsDiag);
    
    // Verificar limites de recursos
    const resourceDiag = this.checkResourceLimits();
    if (resourceDiag) diagnostics.push(resourceDiag);
    
    return diagnostics;
  }
  
  private static checkEnvironment(): ConnectivityDiagnostic | null {
    const isReplit = process.env.REPL_ID !== undefined;
    const isHuggingFace = process.env.SPACE_ID !== undefined;
    const isContainer = process.env.CONTAINER !== undefined;
    
    if (isReplit) {
      return {
        issueType: 'environment_replit',
        severity: 'high',
        description: 'Ambiente Replit detectado com restrições de rede',
        solution: 'Firewall ou proxy está bloqueando WebSockets. Usar browser: Browsers.ubuntu()',
        shouldUseBrowserOptimization: true
      };
    }
    
    if (isHuggingFace) {
      return {
        issueType: 'environment_huggingface',
        severity: 'high',
        description: 'Ambiente HuggingFace Spaces com limitações de conectividade',
        solution: 'Usar timeouts estendidos e browser Ubuntu otimizado',
        shouldUseBrowserOptimization: true
      };
    }
    
    if (isContainer) {
      return {
        issueType: 'environment_container',
        severity: 'medium',
        description: 'Ambiente containerizado pode ter restrições de rede',
        solution: 'Verificar políticas de rede do container e usar configurações otimizadas',
        shouldUseBrowserOptimization: true
      };
    }
    
    return null;
  }
  
  private static async checkDNSConnectivity(): Promise<ConnectivityDiagnostic | null> {
    try {
      const dns = await import('dns');
      const { promisify } = await import('util');
      const lookup = promisify(dns.lookup);
      
      // Testar resolução de web.whatsapp.com
      await lookup('web.whatsapp.com');
      return null; // DNS OK
      
    } catch (error) {
      return {
        issueType: 'dns_blocked',
        severity: 'critical',
        description: 'web.whatsapp.com bloqueado ou inacessível via DNS',
        solution: 'DNS está bloqueado. Usar browser Ubuntu otimizado para contornar',
        shouldUseBrowserOptimization: true
      };
    }
  }
  
  private static async checkPortAccess(): Promise<ConnectivityDiagnostic | null> {
    try {
      const net = await import('net');
      
      // Testar porta 443 (HTTPS)
      const socket = new net.Socket();
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          socket.destroy();
          resolve({
            issueType: 'port_blocked',
            severity: 'high',
            description: 'Porta 443 (HTTPS) pode estar bloqueada',
            solution: 'Firewall bloqueando porta 443. Usar configurações de timeout estendido',
            shouldUseBrowserOptimization: true
          });
        }, 5000);
        
        socket.on('connect', () => {
          clearTimeout(timeout);
          socket.destroy();
          resolve(null); // Porta OK
        });
        
        socket.on('error', () => {
          clearTimeout(timeout);
          resolve({
            issueType: 'port_blocked',
            severity: 'high',
            description: 'Erro ao conectar na porta 443',
            solution: 'Porta 443 bloqueada. Usar timeouts estendidos e browser Ubuntu',
            shouldUseBrowserOptimization: true
          });
        });
        
        socket.connect(443, 'web.whatsapp.com');
      });
      
    } catch (error) {
      return {
        issueType: 'network_error',
        severity: 'critical',
        description: 'Erro geral de conectividade de rede',
        solution: 'Problemas de rede detectados. Usar configuração de emergência',
        shouldUseBrowserOptimization: true
      };
    }
  }
  
  private static async checkWebSocketSupport(): Promise<ConnectivityDiagnostic | null> {
    // Para ambientes conhecidos que têm problemas com WebSocket
    const isRestrictedEnv = process.env.REPL_ID || process.env.SPACE_ID || process.env.RAILWAY_ENVIRONMENT;
    
    if (isRestrictedEnv) {
      return {
        issueType: 'websocket_restricted',
        severity: 'high',
        description: 'Ambiente com restrições conhecidas para WebSocket',
        solution: 'WebSocket pode estar limitado. Usar browser Ubuntu com timeouts estendidos',
        shouldUseBrowserOptimization: true
      };
    }
    
    return null;
  }
  
  private static checkResourceLimits(): ConnectivityDiagnostic | null {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > 400) { // Mais de 400MB usado
      return {
        issueType: 'memory_high',
        severity: 'medium',
        description: 'Alto uso de memória pode afetar conectividade',
        solution: 'Memória alta detectada. Usar configurações minimalistas',
        shouldUseBrowserOptimization: true
      };
    }
    
    return null;
  }
  
  static generateRecommendations(diagnostics: ConnectivityDiagnostic[]): string[] {
    const recommendations: string[] = [];
    
    const hasCritical = diagnostics.some(d => d.severity === 'critical');
    const hasHigh = diagnostics.some(d => d.severity === 'high');
    const needsBrowserOpt = diagnostics.some(d => d.shouldUseBrowserOptimization);
    
    if (hasCritical) {
      recommendations.push('Usar configuração de emergência com timeouts máximos');
    }
    
    if (hasHigh) {
      recommendations.push('Usar browser: Browsers.ubuntu() obrigatoriamente');
    }
    
    if (needsBrowserOpt) {
      recommendations.push('Aplicar todas as otimizações de browser e timeout');
    }
    
    // Sempre recomendar configuração moderna
    recommendations.push('Usar Baileys v6.7.18 com configuração moderna (sem mobile: true)');
    
    return recommendations;
  }
  
  /**
   * Gerar configuração otimizada baseada nos diagnósticos
   */
  static generateOptimizedConfig(diagnostics: ConnectivityDiagnostic[]) {
    const hasCriticalIssues = diagnostics.some(d => d.severity === 'critical');
    const hasNetworkIssues = diagnostics.some(d => d.issueType.includes('dns') || d.issueType.includes('port'));
    
    return {
      // Configurações de browser modernas para v6.7.18
      browser: ['Ubuntu', 'Chrome', '20.0.0'], // Substitui mobile: true depreciado
      
      // Timeouts baseados na severidade dos problemas
      connectTimeoutMs: hasCriticalIssues ? 300000 : 180000, // 5min ou 3min
      qrTimeout: hasCriticalIssues ? 240000 : 180000, // 4min ou 3min
      defaultQueryTimeoutMs: 120000, // 2min padrão
      
      // Configurações de reconexão
      retryRequestDelayMs: hasNetworkIssues ? 10000 : 5000,
      maxMsgRetryCount: hasCriticalIssues ? 2 : 3,
      
      // Configurações de performance
      markOnlineOnConnect: false, // Sempre false para evitar problemas
      syncFullHistory: false, // Sempre false
      generateHighQualityLinkPreview: false, // Sempre false
      fireInitQueries: !hasCriticalIssues, // False se há problemas críticos
      
      // Logger baseado no ambiente
      logger: { level: hasCriticalIssues ? 'error' : 'silent' },
      
      // Versão estável
      version: [2, 2419, 6] // Versão testada
    };
  }
} 