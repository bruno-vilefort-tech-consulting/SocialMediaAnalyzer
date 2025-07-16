/**
 * Global Cache Busting Service
 * 
 * Sistema responsável por gerar versões únicas para quebrar cache do frontend
 * em deploy/restart da aplicação, garantindo que usuários sempre recebam
 * a versão mais recente dos arquivos.
 */

class CacheBustingService {
  private deployVersion: string;
  private startTime: number;
  
  constructor() {
    this.startTime = Date.now();
    this.deployVersion = this.generateDeployVersion();
    console.log(`🚀 [CACHE-BUSTING] Deploy version: ${this.deployVersion}`);
  }
  
  /**
   * Gera versão única baseada em timestamp + process ID
   */
  private generateDeployVersion(): string {
    const timestamp = this.startTime.toString();
    const processId = process.pid.toString();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    
    return `${timestamp}_${processId}_${randomSuffix}`;
  }
  
  /**
   * Retorna a versão atual do deploy
   */
  getDeployVersion(): string {
    return this.deployVersion;
  }
  
  /**
   * Retorna timestamp do início da aplicação
   */
  getStartTime(): number {
    return this.startTime;
  }
  
  /**
   * Gera URL com cache busting parameter
   */
  addCacheBuster(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${this.deployVersion}`;
  }
  
  /**
   * Retorna headers para força cache busting
   */
  getCacheBustingHeaders(): Record<string, string> {
    return {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Deploy-Version': this.deployVersion,
      'X-Start-Time': this.startTime.toString()
    };
  }
  
  /**
   * Middleware para adicionar headers de cache busting
   */
  cacheBustingMiddleware() {
    return (req: any, res: any, next: any) => {
      const headers = this.getCacheBustingHeaders();
      
      // Adiciona headers de cache busting
      Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      
      // Headers específicos para recursos estáticos
      if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
      
      next();
    };
  }
  
  /**
   * Força reload do cache no frontend
   */
  triggerCacheReload(): void {
    this.deployVersion = this.generateDeployVersion();
    console.log(`🔄 [CACHE-BUSTING] Cache reload triggered: ${this.deployVersion}`);
  }
}

export const cacheBustingService = new CacheBustingService();