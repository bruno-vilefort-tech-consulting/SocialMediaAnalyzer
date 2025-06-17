import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Trash2, Phone, QrCode, Wifi, WifiOff, MessageSquare, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { WhatsAppConnection } from "@shared/schema";

interface Client {
  id: number;
  companyName: string;
  cnpj: string;
  status: string;
}

export default function WhatsAppManagerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [testPhone, setTestPhone] = useState<string>("");
  const [testMessage, setTestMessage] = useState<string>("Teste de mensagem WhatsApp");

  // Fetch clients for selection
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"]
  });

  // Fetch WhatsApp connections
  const { data: connections = [], refetch: refetchConnections } = useQuery<WhatsAppConnection[]>({
    queryKey: ["/api/whatsapp/connections"]
  });

  // Create connection mutation
  const createConnectionMutation = useMutation({
    mutationFn: (data: { clientId: string; clientName: string }) =>
      apiRequest("/api/whatsapp/connect", "POST", data),
    onSuccess: () => {
      toast({
        title: "Conexão criada",
        description: "Nova conexão WhatsApp criada com sucesso"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/connections"] });
      setSelectedClientId("");
      setSelectedClientName("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar conexão",
        description: error.message || "Erro interno do servidor",
        variant: "destructive"
      });
    }
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: (connectionId: string) =>
      apiRequest(`/api/whatsapp/disconnect/${connectionId}`, "POST"),
    onSuccess: () => {
      toast({
        title: "Desconectado",
        description: "WhatsApp desconectado com sucesso"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/connections"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao desconectar",
        description: error.message || "Erro interno do servidor",
        variant: "destructive"
      });
    }
  });

  // Delete connection mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: (connectionId: string) =>
      apiRequest(`/api/whatsapp/connection/${connectionId}`, "DELETE"),
    onSuccess: () => {
      toast({
        title: "Conexão removida",
        description: "Conexão WhatsApp removida com sucesso"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/connections"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover",
        description: error.message || "Erro interno do servidor",
        variant: "destructive"
      });
    }
  });

  // Send test message mutation
  const sendTestMutation = useMutation({
    mutationFn: (data: { connectionId: string; phoneNumber: string; message: string }) =>
      apiRequest(`/api/whatsapp/send/${data.connectionId}`, "POST", {
        phoneNumber: data.phoneNumber,
        message: data.message
      }),
    onSuccess: () => {
      toast({
        title: "Mensagem enviada",
        description: "Mensagem de teste enviada com sucesso"
      });
      setTestPhone("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Erro interno do servidor",
        variant: "destructive"
      });
    }
  });

  const handleCreateConnection = () => {
    if (!selectedClientId || !selectedClientName) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um cliente para conectar",
        variant: "destructive"
      });
      return;
    }

    createConnectionMutation.mutate({
      clientId: selectedClientId,
      clientName: selectedClientName
    });
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id.toString() === clientId);
    setSelectedClientId(clientId);
    setSelectedClientName(client?.companyName || "");
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "Nunca";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("pt-BR");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp por Cliente</h1>
        <p className="text-muted-foreground">
          Gerencie conexões WhatsApp específicas para cada cliente
        </p>
      </div>

      {/* Create New Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Nova Conexão WhatsApp
          </CardTitle>
          <CardDescription>
            Conecte um WhatsApp específico para um cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="client-select">Cliente *</Label>
              <Select value={selectedClientId} onValueChange={handleClientSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.companyName} ({client.cnpj})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCreateConnection}
                disabled={!selectedClientId || createConnectionMutation.isPending}
              >
                {createConnectionMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <QrCode className="h-4 w-4 mr-2" />
                )}
                Conectar WhatsApp
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Connections */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Conexões Ativas</h2>
        
        {connections.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center">
                <WifiOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma conexão WhatsApp encontrada</p>
                <p className="text-sm text-muted-foreground">
                  Crie uma nova conexão para começar a usar o WhatsApp
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {connections.map((connection) => (
              <WhatsAppConnectionCard
                key={connection.id}
                connection={connection}
                onDisconnect={() => disconnectMutation.mutate(connection.id)}
                onDelete={() => deleteConnectionMutation.mutate(connection.id)}
                onSendTest={(phone, message) => sendTestMutation.mutate({
                  connectionId: connection.id,
                  phoneNumber: phone,
                  message
                })}
                testPhone={testPhone}
                setTestPhone={setTestPhone}
                testMessage={testMessage}
                setTestMessage={setTestMessage}
                isDisconnecting={disconnectMutation.isPending}
                isDeleting={deleteConnectionMutation.isPending}
                isSendingTest={sendTestMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-4">
        <Button
          variant="outline"
          onClick={() => refetchConnections()}
          disabled={false}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar Status
        </Button>
        
        <p className="text-sm text-muted-foreground">
          Total: {connections.length} conexões
        </p>
      </div>
    </div>
  );
}

interface ConnectionCardProps {
  connection: WhatsAppConnection;
  onDisconnect: () => void;
  onDelete: () => void;
  onSendTest: (phone: string, message: string) => void;
  testPhone: string;
  setTestPhone: (phone: string) => void;
  testMessage: string;
  setTestMessage: (message: string) => void;
  isDisconnecting: boolean;
  isDeleting: boolean;
  isSendingTest: boolean;
}

function WhatsAppConnectionCard({
  connection,
  onDisconnect,
  onDelete,
  onSendTest,
  testPhone,
  setTestPhone,
  testMessage,
  setTestMessage,
  isDisconnecting,
  isDeleting,
  isSendingTest
}: ConnectionCardProps) {
  const [connectionStatus, setConnectionStatus] = useState(connection);

  // Poll connection status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/whatsapp/status/${connection.id}`);
        if (response.ok) {
          const status = await response.json();
          setConnectionStatus(prev => ({ ...prev, ...status }));
        }
      } catch (error) {
        console.error("Erro ao atualizar status:", error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [connection.id]);

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "Nunca";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("pt-BR");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              {connectionStatus.isConnected ? (
                <Wifi className="h-5 w-5 text-green-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-600" />
              )}
              {connection.clientName}
            </CardTitle>
            <CardDescription>
              Cliente ID: {connection.clientId}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant={connectionStatus.isConnected ? "default" : "secondary"}>
              {connectionStatus.isConnected ? "Conectado" : "Desconectado"}
            </Badge>
            {connectionStatus.phoneNumber && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {connectionStatus.phoneNumber}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* QR Code */}
        {connectionStatus.qrCode && !connectionStatus.isConnected && (
          <div className="flex flex-col items-center space-y-2">
            <p className="text-sm text-muted-foreground">Escaneie o QR Code no WhatsApp:</p>
            <div className="bg-white p-4 rounded-lg">
              <img
                src={connectionStatus.qrCode}
                alt="QR Code WhatsApp"
                className="w-48 h-48"
              />
            </div>
          </div>
        )}

        {/* Connection Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Criado:</span>
            <p className="text-muted-foreground">{formatDate(connection.createdAt)}</p>
          </div>
          <div>
            <span className="font-medium">Última conexão:</span>
            <p className="text-muted-foreground">{formatDate(connection.lastConnection)}</p>
          </div>
        </div>

        {/* Test Message Section */}
        {connectionStatus.isConnected && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Teste de Mensagem
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="test-phone">Telefone</Label>
                  <Input
                    id="test-phone"
                    placeholder="5511999999999"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="test-message">Mensagem</Label>
                  <Input
                    id="test-message"
                    placeholder="Mensagem de teste"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => onSendTest(testPhone, testMessage)}
                disabled={!testPhone || !testMessage || isSendingTest}
                className="w-full"
              >
                {isSendingTest ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <MessageSquare className="h-4 w-4 mr-2" />
                )}
                Enviar Teste
              </Button>
            </div>
          </>
        )}

        {/* Actions */}
        <Separator />
        <div className="flex gap-2 justify-end">
          {connectionStatus.isConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <WifiOff className="h-4 w-4 mr-2" />
              )}
              Desconectar
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Remover
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}