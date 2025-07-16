import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface CacheVersion {
  version: string;
  startTime: number;
  timestamp: number;
}

/**
 * Hook para Global Cache Busting
 * 
 * Monitora versão do deploy e força reload quando detecta mudanças
 * Garante que usuários sempre recebam a versão mais recente da aplicação
 */
export function useCacheBusting() {
  const [initialVersion, setInitialVersion] = useState<string | null>(null);
  const [hasReloaded, setHasReloaded] = useState(false);
  
  // Busca versão atual do servidor
  const { data: cacheVersion, error } = useQuery({
    queryKey: ['cache-version'],
    queryFn: async () => {
      const response = await apiRequest('/api/cache-version');
      return response as CacheVersion;
    },
    refetchInterval: 30000, // Verifica a cada 30 segundos
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    staleTime: 0 // Sempre considerar dados como obsoletos
  });

  // Armazena versão inicial na primeira carga
  useEffect(() => {
    if (cacheVersion?.version && !initialVersion) {
      setInitialVersion(cacheVersion.version);
      console.log('🚀 [CACHE-BUSTING] Versão inicial definida:', cacheVersion.version);
    }
  }, [cacheVersion, initialVersion]);

  // Detecta mudança de versão e força reload
  useEffect(() => {
    if (
      initialVersion &&
      cacheVersion?.version &&
      cacheVersion.version !== initialVersion &&
      !hasReloaded
    ) {
      console.log('🔄 [CACHE-BUSTING] Nova versão detectada:', {
        anterior: initialVersion,
        atual: cacheVersion.version,
        forçandoReload: true
      });
      
      setHasReloaded(true);
      
      // Pequeno delay para garantir que o usuário veja a mensagem
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }, [initialVersion, cacheVersion, hasReloaded]);

  // Função para forçar invalidação de cache (desenvolvimento)
  const triggerCacheBust = async () => {
    try {
      await apiRequest('/api/cache-bust', { method: 'POST' });
      console.log('🔄 [CACHE-BUSTING] Cache invalidado manualmente');
    } catch (error) {
      console.error('❌ [CACHE-BUSTING] Erro ao invalidar cache:', error);
    }
  };

  // Função para adicionar versão às URLs
  const addVersionToUrl = (url: string): string => {
    if (!cacheVersion?.version) return url;
    
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${cacheVersion.version}`;
  };

  return {
    currentVersion: cacheVersion?.version || null,
    startTime: cacheVersion?.startTime || null,
    isNewVersion: initialVersion && cacheVersion?.version !== initialVersion,
    hasReloaded,
    triggerCacheBust,
    addVersionToUrl,
    error
  };
}