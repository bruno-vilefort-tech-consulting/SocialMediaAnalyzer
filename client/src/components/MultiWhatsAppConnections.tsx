import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Wifi, WifiOff, RefreshCw, Power, Loader2, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface WhatsAppConnection {
  connectionId: string;
  clientId: string;
  slotNumber: number;
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
  service: 'baileys' | 'wppconnect' | 'evolution';
}

interface MultiConnectionStatus {
  success: boolean;
  clientId: string;
  connections: WhatsAppConnection[];
  totalConnections: number;
  activeConnections: number;
}

interface ConnectionSlotProps {
  connection: WhatsAppConnection;
  onConnect: (slotNumber: number) => void;
  onDisconnect: (slotNumber: number) => void;
  onTest: (slotNumber: number, phoneNumber: string, message: string) => void;
  onHideConnection: (slotNumber: number) => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isTesting: boolean;
  isHidden: boolean;
}

const ConnectionSlot: React.FC<ConnectionSlotProps> = ({
  connection,
  onConnect,
  onDisconnect,
  onTest,
  onHideConnection,
  isConnecting,
  isDisconnecting,
  isTesting,
  isHidden
}) => {
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Teste de conexão WhatsApp');
  // QR deve aparecer se já existe um QR Code ou se o usuário clicou para conectar
  const [showQR, setShowQR] = useState(!!connection.qrCode);

  // Atualizar showQR quando connection.qrCode mudar
  React.useEffect(() => {
    console.log(`🔍 [SLOT ${connection.slotNumber}] QR Code Debug:`, {
      hasQrCode: !!connection.qrCode,
      qrCodeLength: connection.qrCode?.length || 0,
      isConnected: connection.isConnected,
      showQR: showQR
    });

    if (connection.qrCode && !connection.isConnected) {
      console.log(`✅ [SLOT ${connection.slotNumber}] Exibindo QR Code de ${connection.qrCode.length} caracteres`);
      setShowQR(true);
    }
  }, [connection.qrCode, connection.isConnected]);

  const getServiceBadgeColor = (service: string) => {
    switch (service) {
      case 'baileys': return 'bg-green-500';
      case 'wppconnect': return 'bg-blue-500';
      case 'evolution': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const handleConnect = () => {
    setShowQR(true);
    onConnect(connection.slotNumber);
  };

  const handleHideQR = () => {
    setShowQR(false);
  };

  const handleHideCard = () => {
    onHideConnection(connection.slotNumber);
  };

  const handleTest = () => {
    if (testPhone.trim() && testMessage.trim()) {
      onTest(connection.slotNumber, testPhone, testMessage);
    }
  };

  // Se o card está escondido, não renderizar nada
  if (isHidden) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Conexão {connection.slotNumber}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={getServiceBadgeColor(connection.service)}>
              {connection.service.toUpperCase()}
            </Badge>
            <Badge variant={connection.isConnected ? "default" : "secondary"}>
              {connection.isConnected ? (
                <Wifi className="h-3 w-3 mr-1" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1" />
              )}
              {connection.isConnected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status e controles */}
        <div className="flex flex-wrap gap-2">
          {connection.isConnected ? (
            <>
              <Button
                onClick={() => onDisconnect(connection.slotNumber)}
                disabled={isDisconnecting}
                variant="outline"
                size="sm"
              >
                {isDisconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Power className="h-4 w-4 mr-2" />
                )}
                Desconectar
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                size="sm"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <MessageCircle className="h-4 w-4 mr-1" />
                )}
                Conectar
              </Button>

              {showQR && connection.qrCode && (
                <>
                  <Button
                    onClick={handleConnect}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Atualizar
                  </Button>
                  <Button
                    onClick={handleHideQR}
                    variant="outline"
                    size="sm"
                  >
                    Esconder QR
                  </Button>
                </>
              )}
              
              {/* Botão Esconder quando desconectado */}
              <Button
                onClick={handleHideCard}
                variant="outline"
                size="sm"
              >
                Esconder
              </Button>
            </>
          )}
        </div>

        {/* QR Code */}
        {showQR && connection.qrCode && !connection.isConnected && (
          <div className="space-y-3">
            <Separator />
            <div className="text-center">
              <h4 className="text-sm font-medium mb-2">Escaneie o QR Code</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Abra o WhatsApp no celular, vá em "Dispositivos conectados" e escaneie este código
              </p>

              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-lg shadow border">
                  <img
                    src={connection.qrCode}
                    alt={`QR Code Slot ${connection.slotNumber}`}
                    width={200}
                    height={200}
                    style={{
                      width: '200px',
                      height: '200px',
                      display: 'block'
                    }}
                    onLoad={() => console.log(`✅ [SLOT ${connection.slotNumber}] QR Code image carregada com sucesso`)}
                    onError={(e) => console.error(`❌ [SLOT ${connection.slotNumber}] Erro ao carregar QR Code:`, e)}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  QR Code válido por 2 minutos. Monitoramento contínuo ATIVO.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Banner de conexão */}
        {connection.isConnected && connection.phoneNumber && (
          <div className="p-3 bg-green-100 border border-green-400 rounded">
            <p className="text-green-800 text-sm">
              ✅ Conectado com sucesso! ({connection.phoneNumber})
            </p>
            <p className="text-green-700 text-xs mt-1">
              🔒 Conexão segura via protocolo mobile
            </p>
          </div>
        )}

        {/* Teste de mensagem */}
        {connection.isConnected && (
          <div className="space-y-3 p-3 border rounded-lg bg-gray-50">
            <h4 className="font-medium text-sm">Teste de Conexão</h4>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`testPhone${connection.slotNumber}`} className="text-xs">
                  Número de Teste
                </Label>
                <Input
                  id={`testPhone${connection.slotNumber}`}
                  placeholder="5511999999999"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`testMessage${connection.slotNumber}`} className="text-xs">
                  Mensagem
                </Label>
                <Input
                  id={`testMessage${connection.slotNumber}`}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Button
              onClick={handleTest}
              disabled={isTesting || !testPhone.trim()}
              className="w-full"
              size="sm"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MessageCircle className="h-4 w-4 mr-2" />
              )}
              Enviar Teste
            </Button>
          </div>
        )}

        {/* Informações técnicas */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Connection ID:</strong> {connection.connectionId}</p>
          <p><strong>Última Conexão:</strong> {
            connection.lastConnection
              ? new Date(connection.lastConnection).toLocaleString('pt-BR')
              : 'Nunca'
          }</p>
        </div>
      </CardContent>
    </Card>
  );
};

const MultiWhatsAppConnections: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [connectingSlots, setConnectingSlots] = useState<Set<number>>(new Set());
  const [disconnectingSlots, setDisconnectingSlots] = useState<Set<number>>(new Set());
  const [testingSlots, setTestingSlots] = useState<Set<number>>(new Set());
  
  // Estado para controlar quantas conexões estão visíveis com persistência
  const [visibleConnections, setVisibleConnections] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(`whatsapp_visible_connections_${user?.clientId}`);
      return stored ? parseInt(stored, 10) : 1;
    } catch {
      return 1;
    }
  });

  // Estado para rastrear conexões escondidas com persistência
  const [hiddenConnections, setHiddenConnections] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem(`whatsapp_hidden_connections_${user?.clientId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Estado local das conexões para exibir QR Code imediatamente
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);

  // Query para obter status das conexões
  const { data: connectionsData, isLoading, refetch, error } = useQuery<MultiConnectionStatus>({
    queryKey: ['/api/multi-whatsapp/connections'],
    refetchInterval: 5000, // Atualizar a cada 5 segundos
    queryFn: async () => {
      const response = await apiRequest('/api/multi-whatsapp/connections', 'GET');
      const data = await response.json();
      console.log('🔍 [MULTI-WA] Dados recebidos da API:', data);
      return data;
    }
  });

  // Tratamento de erro da query
  React.useEffect(() => {
    if (error) {
      console.error('❌ [MULTI-WA] Erro ao buscar conexões:', error);
      toast({
        title: "Erro de conexão",
        description: "Falha ao carregar status das conexões WhatsApp",
        variant: "destructive"
      });
    }
  }, [error, toast]);

  // Salvar estado de conexões visíveis no localStorage
  useEffect(() => {
    if (user?.clientId) {
      localStorage.setItem(`whatsapp_visible_connections_${user.clientId}`, visibleConnections.toString());
    }
  }, [visibleConnections, user?.clientId]);

  // Salvar conexões escondidas no localStorage
  useEffect(() => {
    if (user?.clientId) {
      localStorage.setItem(`whatsapp_hidden_connections_${user.clientId}`, JSON.stringify([...hiddenConnections]));
    }
  }, [hiddenConnections, user?.clientId]);

  // Sincronizar estado local com dados da API
  React.useEffect(() => {
    if (connectionsData && connectionsData.connections) {
      setConnections(connectionsData.connections);
    }
  }, [connectionsData]);

  // Mutation para conectar slot usando DirectQrBaileys
  const connectMutation = useMutation({
    mutationFn: async (slotNumber: number) => {
      const response = await apiRequest(`/api/multi-whatsapp/test-direct-qr/${slotNumber}`, 'POST');
      return response.json();
    },
    onMutate: (slotNumber) => {
      setConnectingSlots(prev => new Set(prev).add(slotNumber));
    },
    onSuccess: (data, slotNumber) => {
      if (data.success && data.qrCode) {
        // Atualizar state local com o QR Code real do DirectQrBaileys
        setConnections(prev => prev.map(conn =>
          conn.slotNumber === slotNumber
            ? { ...conn, qrCode: data.qrCode, isConnected: false }
            : conn
        ));

        toast({
          title: "QR Code Real Gerado!",
          description: `QR Code autêntico do Baileys criado para Conexão ${slotNumber}. Escaneie com seu WhatsApp.`,
        });

        refetch(); // Atualizar dados
      } else {
        toast({
          title: "Erro na geração do QR",
          description: data.message || "Falha ao gerar QR Code real",
          variant: "destructive"
        });
      }
    },
    onError: (error, slotNumber) => {
      toast({
        title: "Erro na conexão",
        description: `Falha ao conectar Slot ${slotNumber}`,
        variant: "destructive"
      });
    },
    onSettled: (data, error, slotNumber) => {
      setConnectingSlots(prev => {
        const newSet = new Set(prev);
        newSet.delete(slotNumber);
        return newSet;
      });
    }
  });

  // Mutation para desconectar slot
  const disconnectMutation = useMutation({
    mutationFn: async (slotNumber: number) => {
      const response = await apiRequest(`/api/multi-whatsapp/disconnect/${slotNumber}`, 'POST');
      return response.json();
    },
    onMutate: (slotNumber) => {
      setDisconnectingSlots(prev => new Set(prev).add(slotNumber));
    },
    onSuccess: (data, slotNumber) => {
      if (data.success) {
        toast({
          title: "Desconectado",
          description: `Slot ${slotNumber} desconectado com sucesso.`,
        });
        refetch(); // Atualizar dados
      } else {
        toast({
          title: "Erro na desconexão",
          description: data.message,
          variant: "destructive"
        });
      }
    },
    onError: (error, slotNumber) => {
      toast({
        title: "Erro na desconexão",
        description: `Falha ao desconectar Slot ${slotNumber}`,
        variant: "destructive"
      });
    },
    onSettled: (data, error, slotNumber) => {
      setDisconnectingSlots(prev => {
        const newSet = new Set(prev);
        newSet.delete(slotNumber);
        return newSet;
      });
    }
  });

  // Mutation para teste de mensagem
  const testMutation = useMutation({
    mutationFn: async ({ slotNumber, phoneNumber, message }: { slotNumber: number; phoneNumber: string; message: string }) => {
      const response = await apiRequest('/api/multi-whatsapp/test', 'POST', {
        phoneNumber,
        message,
        preferredSlot: slotNumber
      });
      return response.json();
    },
    onMutate: ({ slotNumber }) => {
      setTestingSlots(prev => new Set(prev).add(slotNumber));
    },
    onSuccess: (data, { slotNumber }) => {
      if (data.success) {
        toast({
          title: "Mensagem enviada",
          description: `Teste enviado via Slot ${data.usedSlot || slotNumber}`,
        });
      } else {
        toast({
          title: "Erro no envio",
          description: data.message,
          variant: "destructive"
        });
      }
    },
    onError: (error, { slotNumber }) => {
      toast({
        title: "Erro no teste",
        description: `Falha ao enviar teste via Slot ${slotNumber}`,
        variant: "destructive"
      });
    },
    onSettled: (data, error, { slotNumber }) => {
      setTestingSlots(prev => {
        const newSet = new Set(prev);
        newSet.delete(slotNumber);
        return newSet;
      });
    }
  });

  // Função para adicionar nova conexão
  const handleAddConnection = () => {
    if (visibleConnections < 3) {
      setVisibleConnections(prev => prev + 1);
    }
  };

  // Função para esconder uma conexão
  const handleHideConnection = (slotNumber: number) => {
    setHiddenConnections(prev => new Set(prev).add(slotNumber));
  };

  // Função para mostrar UMA conexão escondida por vez
  const handleShowHiddenConnections = () => {
    if (hiddenConnections.size > 0) {
      const hiddenArray = Array.from(hiddenConnections);
      const firstHidden = hiddenArray[0]; // Pega o primeiro escondido
      const newHiddenConnections = new Set(hiddenConnections);
      newHiddenConnections.delete(firstHidden); // Remove apenas um
      setHiddenConnections(newHiddenConnections);
    }
  };

  const handleConnect = (slotNumber: number) => {
    connectMutation.mutate(slotNumber);
  };

  const handleDisconnect = (slotNumber: number) => {
    disconnectMutation.mutate(slotNumber);
  };

  const handleTest = (slotNumber: number, phoneNumber: string, message: string) => {
    testMutation.mutate({ slotNumber, phoneNumber, message });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Carregando conexões WhatsApp...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com resumo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Múltiplas Conexões WhatsApp
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {connectionsData?.activeConnections || 0} / {connectionsData?.totalConnections || 3} Ativas
              </Badge>
              <Button
                onClick={() => refetch()}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Gerencie até 3 conexões WhatsApp simultâneas. Cada slot pode usar uma conta diferente para aumentar a capacidade de envio.
          </p>
          {error && (
            <div className="mt-3 p-3 bg-red-100 border border-red-400 rounded text-red-800 text-sm">
              ⚠️ Erro ao conectar com servidor WhatsApp. Verifique sua conexão.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid com as conexões visíveis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {connections
          .filter((connection) => connection.slotNumber <= visibleConnections)
          .map((connection) => (
            <ConnectionSlot
              key={connection.connectionId}
              connection={connection}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onTest={handleTest}
              onHideConnection={handleHideConnection}
              isConnecting={connectingSlots.has(connection.slotNumber)}
              isDisconnecting={disconnectingSlots.has(connection.slotNumber)}
              isTesting={testingSlots.has(connection.slotNumber)}
              isHidden={hiddenConnections.has(connection.slotNumber)}
            />
          ))}
      </div>

      {/* Botão para mostrar conexões escondidas */}
      {hiddenConnections.size > 0 && (
        <div className="flex justify-center mb-4">
          <Button
            onClick={handleShowHiddenConnections}
            variant="outline"
            className="flex items-center gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
          >
            <MessageCircle className="h-4 w-4" />
            Adicionar Conexão
          </Button>
        </div>
      )}

      {/* Botão Adicionar Conexão */}
      {visibleConnections < 3 && (
        <div className="flex justify-center">
          <Button
            onClick={handleAddConnection}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar Conexão
          </Button>
        </div>
      )}
    </div>
  );
};

export default MultiWhatsAppConnections;