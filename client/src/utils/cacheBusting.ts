/**
 * Cache Busting Utilities
 * 
 * Funções auxiliares para trabalhar com cache busting
 * no lado do cliente da aplicação
 */

interface CacheInfo {
  version: string;
  startTime: number;
  timestamp: number;
}

/**
 * Limpa todo o cache do navegador
 */
export async function clearBrowserCache(): Promise<void> {
  try {
    // Limpa localStorage
    localStorage.clear();
    
    // Limpa sessionStorage
    sessionStorage.clear();
    
    // Limpa cache do service worker se existir
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
    
    // Limpa cache da API do navegador se disponível
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }
  } catch (error) {
    console.error('❌ [CACHE-BUSTING] Erro ao limpar cache:', error);
  }
}

/**
 * Adiciona versão a uma URL
 */
export function addVersionToUrl(url: string, version: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${version}`;
}

/**
 * Força reload da página com cache busting
 */
export function forceReloadWithCacheBusting(): void {
  const timestamp = Date.now();
  const currentUrl = window.location.href;
  const separator = currentUrl.includes('?') ? '&' : '?';
  
  // Força reload com timestamp único
  window.location.href = `${currentUrl}${separator}_cb=${timestamp}`;
}

/**
 * Verifica se há uma nova versão disponível
 */
export async function checkForNewVersion(currentVersion: string): Promise<boolean> {
  try {
    const response = await fetch('/api/cache-version');
    const data: CacheInfo = await response.json();
    
    return data.version !== currentVersion;
  } catch (error) {
    console.error('❌ [CACHE-BUSTING] Erro ao verificar nova versão:', error);
    return false;
  }
}

/**
 * Monitora mudanças de versão em interval
 */
export function startVersionMonitoring(
  currentVersion: string,
  onNewVersion: (newVersion: string) => void,
  intervalMs: number = 30000
): () => void {
  const interval = setInterval(async () => {
    try {
      const response = await fetch('/api/cache-version');
      const data: CacheInfo = await response.json();
      
      if (data.version !== currentVersion) {
        onNewVersion(data.version);
      }
    } catch (error) {
      console.error('❌ [CACHE-BUSTING] Erro no monitoramento:', error);
    }
  }, intervalMs);
  
  // Retorna função para parar o monitoramento
  return () => clearInterval(interval);
}

/**
 * Detecta se o usuário está em uma versão desatualizada
 */
export function isOutdatedVersion(
  currentVersion: string,
  serverVersion: string
): boolean {
  if (!currentVersion || !serverVersion) return false;
  
  // Extrai timestamp da versão (primeira parte antes do _)
  const currentTimestamp = parseInt(currentVersion.split('_')[0]);
  const serverTimestamp = parseInt(serverVersion.split('_')[0]);
  
  return currentTimestamp < serverTimestamp;
}

/**
 * Configurações globais para cache busting
 */
export const CACHE_BUSTING_CONFIG = {
  CHECK_INTERVAL: 30000, // 30 segundos
  RELOAD_DELAY: 1000, // 1 segundo
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000, // 5 segundos
  DEVELOPMENT_MODE: process.env.NODE_ENV === 'development'
} as const;