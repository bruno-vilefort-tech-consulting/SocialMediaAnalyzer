import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, QrCode, Smartphone, Wifi, WifiOff, RefreshCw, Send, CheckCircle, AlertCircle, Phone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppQRStatus {
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnection: Date | null;
}

export default function WhatsAppQRPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Teste de conexão WhatsApp QR - Sistema de Entrevistas");

  const { data: status, isLoading, refetch } = useQuery<WhatsAppQRStatus>({
    queryKey: ["/api/whatsapp-qr/status"],
    refetchInterval: 3000, // Atualizar a cada 3 segundos
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("/api/whatsapp-qr/disconnect", "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-qr/status"] });
      toast({
        title: "WhatsApp desconectado",
        description: "Sessão encerrada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao desconectar WhatsApp",
        variant: "destructive",
      });
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: () => apiRequest("/api/whatsapp-qr/reconnect", "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-qr/status"] });
      toast({
        title: "Reconnectando...",
        description: "Aguarde um novo QR Code",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao reconectar WhatsApp",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: (data: { phoneNumber: string; message: string }) => 
      apiRequest("/api/whatsapp-qr/test", "POST", data),
    onSuccess: () => {
      toast({
        title: "Teste enviado!",
        description: "Mensagem de teste enviada com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro no teste",
        description: error?.message || "Falha ao enviar mensagem de teste",
        variant: "destructive",
      });
    },
  });

  const handleTest = () => {
    if (!testPhone || !testMessage) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o telefone e a mensagem",
        variant: "destructive",
      });
      return;
    }

    testMutation.mutate({
      phoneNumber: testPhone,
      message: testMessage,
    });
  };

  const getStatusColor = () => {
    if (status?.isConnected) return "bg-green-100 text-green-800 border-green-200";
    if (status?.qrCode) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const getStatusText = () => {
    if (status?.isConnected) return "Conectado";
    if (status?.qrCode) return "Aguardando escaneamento";
    return "Desconectado";
  };

  const getStatusIcon = () => {
    if (status?.isConnected) return <Wifi className="w-4 h-4" />;
    if (status?.qrCode) return <QrCode className="w-4 h-4" />;
    return <WifiOff className="w-4 h-4" />;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp QR Connection</h1>
          <p className="text-muted-foreground">
            Conecte seu WhatsApp pessoal ou business via QR Code
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5" />
              <CardTitle>Status da Conexão</CardTitle>
            </div>
            <Badge className={getStatusColor()}>
              {getStatusIcon()}
              <span className="ml-2">{getStatusText()}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.isConnected && (
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">WhatsApp Conectado</p>
                  {status.phoneNumber && (
                    <p className="text-sm text-green-700">
                      Número: +{status.phoneNumber}
                    </p>
                  )}
                  {status.lastConnection && (
                    <p className="text-sm text-green-700">
                      Conectado em: {new Date(status.lastConnection).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                Desconectar
              </Button>
            </div>
          )}

          {!status?.isConnected && status?.qrCode && (
            <div className="flex flex-col items-center space-y-4 p-6 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-center">
                <QrCode className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <h3 className="font-medium text-yellow-900">Escaneie o QR Code</h3>
                <p className="text-sm text-yellow-700 mb-4">
                  Abra o WhatsApp no seu celular e escaneie o código abaixo
                </p>
              </div>
              
              <div className="bg-white p-4 rounded-lg border-2 border-yellow-300">
                <img 
                  src={status.qrCode} 
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64 mx-auto"
                />
              </div>
              
              <div className="text-center text-sm text-yellow-700">
                <p className="mb-2">Como escanear:</p>
                <ol className="text-left space-y-1">
                  <li>1. Abra o WhatsApp no celular</li>
                  <li>2. Toque em "Mais opções" (⋮) ou "Configurações"</li>
                  <li>3. Selecione "Aparelhos conectados"</li>
                  <li>4. Toque em "Conectar um aparelho"</li>
                  <li>5. Escaneie este QR Code</li>
                </ol>
              </div>

              <Button
                variant="outline"
                onClick={() => reconnectMutation.mutate()}
                disabled={reconnectMutation.isPending}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Gerar Novo QR
              </Button>
            </div>
          )}

          {!status?.isConnected && !status?.qrCode && (
            <div className="flex flex-col items-center space-y-4 p-6 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <div className="text-center">
                <h3 className="font-medium text-red-900">WhatsApp Desconectado</h3>
                <p className="text-sm text-red-700">
                  Clique em "Conectar" para gerar um novo QR Code
                </p>
              </div>
              <Button
                onClick={() => reconnectMutation.mutate()}
                disabled={reconnectMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Conectar WhatsApp
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Card */}
      {status?.isConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Send className="w-5 h-5" />
              <CardTitle>Teste de Envio</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-phone">Número de Teste</Label>
                <div className="flex">
                  <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="ml-2 text-sm">+55</span>
                  </div>
                  <Input
                    id="test-phone"
                    placeholder="11987654321"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="rounded-l-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Digite apenas números (DDD + telefone)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="test-message">Mensagem de Teste</Label>
                <Input
                  id="test-message"
                  placeholder="Mensagem de teste..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleTest}
              disabled={testMutation.isPending || !status?.isConnected}
              className="w-full"
            >
              {testMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar Teste
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <QrCode className="w-5 h-5" />
            <span>Sobre WhatsApp QR</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2 text-green-900">Vantagens:</h4>
              <ul className="text-sm space-y-1 text-green-700">
                <li>• Sem necessidade de API oficial da Meta</li>
                <li>• Funciona com WhatsApp pessoal ou business</li>
                <li>• Conexão instantânea via QR Code</li>
                <li>• Ideal para testes e pequenos volumes</li>
                <li>• Sem custos adicionais de API</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2 text-amber-900">Limitações:</h4>
              <ul className="text-sm space-y-1 text-amber-700">
                <li>• Não é oficial da Meta (pode ser instável)</li>
                <li>• Sessão pode cair se o celular desconectar</li>
                <li>• Requer celular sempre conectado</li>
                <li>• Melhor para volumes menores</li>
                <li>• Dependente da estabilidade do Baileys</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>Dica:</strong> Mantenha seu celular conectado e com WhatsApp ativo para garantir que as mensagens sejam enviadas corretamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}