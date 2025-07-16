import { useCacheBusting } from "@/hooks/useCacheBusting";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, Info } from "lucide-react";

/**
 * Componente de notificação para Cache Busting
 * 
 * Exibe alertas quando há nova versão disponível
 * Fornece controles para desenvolvedores em modo desenvolvimento
 */
export function CacheBustingNotification() {
  const { 
    currentVersion, 
    isNewVersion, 
    hasReloaded, 
    triggerCacheBust 
  } = useCacheBusting();

  // Não exibe nada se não houver versão ou se já recarregou
  if (!currentVersion || hasReloaded) {
    return null;
  }

  // Exibe alerta de nova versão
  if (isNewVersion) {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-md">
        <Alert className="bg-blue-50 border-blue-200">
          <RefreshCw className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>Nova versão disponível! Recarregando...</span>
              <div className="ml-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Controles de desenvolvimento (apenas em modo dev)
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Alert className="bg-gray-50 border-gray-200 max-w-xs">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="text-xs text-gray-600">
                Versão: {currentVersion.substring(0, 12)}...
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={triggerCacheBust}
                className="w-full"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Invalidar Cache
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return null;
}