import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Clock, 
  User, 
  MessageSquare, 
  RefreshCw,
  Phone,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

interface WhatsAppStatus {
  isConnected: boolean;
  phone: string | null;
  qrCode: string | null;
  lastConnection: string | null;
  connectionTime?: string;
  messagesSent?: number;
  lastActivity?: string;
}

interface ConnectionHistory {
  timestamp: string;
  event: string;
  phone?: string;
  status: 'connected' | 'disconnected' | 'error';
}

export function WhatsAppStatusPage() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionHistory[]>([]);
  const { toast } = useToast();

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/client/whatsapp/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        
        // Adicionar ao histórico se status mudou
        if (status && status.isConnected !== data.isConnected) {
          const newEvent: ConnectionHistory = {
            timestamp: new Date().toISOString(),
            event: data.isConnected ? 'Conectado' : 'Desconectado',
            phone: data.phone,
            status: data.isConnected ? 'connected' : 'disconnected'
          };
          setConnectionHistory(prev => [newEvent, ...prev.slice(0, 9)]);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    } finally {
      setLoading(false);
    }
  };

  const reconnect = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/client/whatsapp/connect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        toast({
          title: "Reconectando...",
          description: "Tentativa de reconexão iniciada"
        });
        setTimeout(fetchStatus, 2000);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao tentar reconectar",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Atualizar a cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (isConnected: boolean) => {
    if (isConnected) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusBadge = (isConnected: boolean) => {
    if (isConnected) {
      return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Conectado</Badge>;
    }
    return <Badge variant="destructive">Desconectado</Badge>;
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return 'N/A';
    // Formatar número brasileiro: +55 (11) 99999-9999
    if (phone.startsWith('55') && phone.length >= 12) {
      const ddd = phone.substring(2, 4);
      const number = phone.substring(4);
      const part1 = number.substring(0, number.length - 4);
      const part2 = number.substring(number.length - 4);
      return `+55 (${ddd}) ${part1}-${part2}`;
    }
    return phone;
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading && !status) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Status WhatsApp</h1>
          <p className="text-muted-foreground">Monitoramento em tempo real da conexão WhatsApp</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Status WhatsApp</h1>
          <p className="text-muted-foreground">Monitoramento em tempo real da conexão WhatsApp</p>
        </div>
        <Button onClick={fetchStatus} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Status Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Status da Conexão
          </CardTitle>
          <CardDescription>
            Status atual da conexão WhatsApp Business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(status?.isConnected || false)}
                <span className="font-medium">Status</span>
              </div>
              {getStatusBadge(status?.isConnected || false)}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Telefone</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatPhone(status?.phone)}
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <span className="font-medium">Última Conexão</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatTime(status?.lastConnection)}
              </p>
            </div>
          </div>

          {!status?.isConnected && (
            <>
              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">WhatsApp desconectado</span>
                </div>
                <Button onClick={reconnect} size="sm" disabled={loading}>
                  <Wifi className="h-4 w-4 mr-2" />
                  Reconectar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* QR Code */}
      {status?.qrCode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              QR Code para Conexão
            </CardTitle>
            <CardDescription>
              Escaneie o QR Code com o WhatsApp do seu celular
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <img 
                src={status.qrCode} 
                alt="QR Code WhatsApp" 
                className="max-w-xs border rounded-lg"
              />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              1. Abra o WhatsApp no seu celular<br/>
              2. Vá em Configurações → Aparelhos conectados<br/>
              3. Toque em "Conectar um aparelho"<br/>
              4. Escaneie este QR Code
            </p>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Conexões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Conexões
          </CardTitle>
          <CardDescription>
            Últimas atividades de conexão
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectionHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhuma atividade registrada nesta sessão
            </p>
          ) : (
            <div className="space-y-3">
              {connectionHistory.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {item.status === 'connected' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {item.status === 'disconnected' && <XCircle className="h-4 w-4 text-red-500" />}
                    {item.status === 'error' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    <div>
                      <p className="font-medium text-sm">{item.event}</p>
                      {item.phone && (
                        <p className="text-xs text-muted-foreground">{formatPhone(item.phone)}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(item.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estatísticas de Conexão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Estatísticas
          </CardTitle>
          <CardDescription>
            Informações sobre o uso do WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {status?.isConnected ? '1' : '0'}
              </div>
              <p className="text-sm text-muted-foreground">Conexões Ativas</p>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {connectionHistory.filter(h => h.status === 'connected').length}
              </div>
              <p className="text-sm text-muted-foreground">Conexões Hoje</p>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-amber-600">
                {connectionHistory.filter(h => h.status === 'disconnected').length}
              </div>
              <p className="text-sm text-muted-foreground">Desconexões Hoje</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}