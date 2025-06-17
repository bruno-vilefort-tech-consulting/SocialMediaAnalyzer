import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bot, Settings, CheckCircle, AlertCircle, Loader2, Save, Volume2, MessageSquare, QrCode, Smartphone, Send, RefreshCw, Trash2, Phone, Wifi, WifiOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface MasterSettings {
  openaiApiKey?: string | null;
  gptModel?: string;
}

interface ApiConfig {
  id?: number;
  entityType: string;
  entityId: string;
  openaiVoice?: string | null;
  whatsappQrConnected?: boolean | null;
  whatsappQrPhoneNumber?: string | null;
  whatsappQrLastConnection?: Date | null;
  updatedAt?: Date | null;
}

interface ClientVoiceSetting {
  id?: number;
  clientId: number;
  voice: string;
  updatedAt?: Date | null;
}

interface WhatsAppStatus {
  isConnected: boolean;
  qrCode: string | null;
  phone?: string;
  lastConnection?: string;
}

interface WhatsAppConnection {
  id: string;
  clientId: string;
  clientName: string;
  status: 'connected' | 'disconnected' | 'connecting';
  phoneNumber?: string;
  lastConnection?: string;
  createdAt: string;
}

interface Client {
  id: number;
  companyName: string;
  cnpj: string;
  status: string;
}

export default function ApiConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const isMaster = user?.role === 'master';

  // Master Settings para configurações OpenAI globais
  const { data: masterSettings, isLoading: configLoading } = useQuery<MasterSettings>({
    queryKey: ["/api/master-settings"],
    enabled: isMaster,
  });

  // API Config específica por entidade (nova arquitetura)
  const entityType = isMaster ? 'master' : 'client';
  const entityId = isMaster ? user?.id?.toString() || '' : user?.clientId?.toString() || '';
  
  const { data: apiConfig, isLoading: apiConfigLoading } = useQuery<ApiConfig>({
    queryKey: [`/api/api-config/${entityType}/${entityId}`],
    enabled: !!entityId,
  });

  // Configurações de voz para cliente (DEPRECATED - mantido para compatibilidade)
  const { data: voiceSetting, isLoading: voiceLoading } = useQuery<ClientVoiceSetting>({
    queryKey: [`/api/client-voice-settings/${user?.clientId}`],
    enabled: !isMaster && !!user?.clientId,
  });

  // Status WhatsApp QR - Com polling para atualização em tempo real
  const { data: whatsappStatus, isLoading: whatsappLoading, refetch: refetchWhatsAppStatus } = useQuery<WhatsAppStatus>({
    queryKey: ["/api/whatsapp-qr/status"],
    refetchInterval: 3000, // Atualiza a cada 3 segundos
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Estados para configurações master
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o");
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Estado para configuração de voz (cliente)
  const [selectedVoice, setSelectedVoice] = useState<string>("nova");
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  // Estados para teste WhatsApp
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Esta é uma mensagem de teste do sistema de entrevistas.");
  
  // Estados para WhatsApp Manager (conexões por cliente)
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [managerTestPhone, setManagerTestPhone] = useState<string>("");
  const [managerTestMessage, setManagerTestMessage] = useState<string>("Teste de mensagem WhatsApp por cliente");

  // Queries para WhatsApp Manager
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: isMaster,
  });

  const { data: connections = [], refetch: refetchConnections } = useQuery<WhatsAppConnection[]>({
    queryKey: ["/api/whatsapp/connections"],
  });

  // Carrega dados existentes
  useEffect(() => {
    if (masterSettings) {
      setOpenaiApiKey(masterSettings.openaiApiKey === '***KEY_SET***' ? '' : masterSettings.openaiApiKey || "");
      setOpenaiModel(masterSettings.gptModel || "gpt-4o");
    }
  }, [masterSettings]);

  useEffect(() => {
    // Prioriza apiConfig (nova arquitetura) sobre voiceSetting (deprecated)
    if (apiConfig?.openaiVoice) {
      setSelectedVoice(apiConfig.openaiVoice);
    } else if (voiceSetting) {
      setSelectedVoice(voiceSetting.voice || "nova");
    }
  }, [apiConfig, voiceSetting]);

  // Mutation para salvar configurações master
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/master-settings", "POST", {
        openaiApiKey,
        gptModel: openaiModel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master-settings"] });
      toast({
        title: "Configurações salvas",
        description: "Chave API e modelo OpenAI salvos com sucesso",
      });
      setTestStatus('idle');
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Falha ao salvar configurações",
        variant: "destructive",
      });
    },
  });

  // Mutation para salvar configuração de voz (DEPRECATED - mantido para compatibilidade)
  const saveVoiceMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/client-voice-settings", "POST", {
        clientId: user?.clientId,
        voice: selectedVoice,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/client-voice-settings/${user?.clientId}`] });
      toast({
        title: "Voz configurada",
        description: "Configuração de voz salva com sucesso",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Falha ao salvar configuração de voz",
        variant: "destructive",
      });
    },
  });

  // Mutation para salvar configuração de voz via nova arquitetura API Config
  const saveApiConfigMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/api-config", "POST", {
        entityType,
        entityId,
        openaiVoice: selectedVoice,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/api-config/${entityType}/${entityId}`] });
      toast({
        title: "Configurações salvas",
        description: "Configuração de voz salva com sucesso",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Falha ao salvar configurações",
        variant: "destructive",
      });
    },
  });

  // Mutations para WhatsApp QR
  const connectWhatsAppMutation = useMutation({
    mutationFn: () => apiRequest("/api/whatsapp-qr/reconnect", "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-qr/status"] });
      toast({
        title: "Gerando QR Code...",
        description: "Aguarde alguns segundos para o QR Code aparecer",
      });
      
      // Atualiza status após um delay para permitir geração do QR
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-qr/status"] });
      }, 3000);
    },
    onError: () => {
      toast({
        title: "Erro ao conectar",
        description: "Falha ao inicializar conexão WhatsApp",
        variant: "destructive",
      });
    },
  });

  const disconnectWhatsAppMutation = useMutation({
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

  const testWhatsAppMutation = useMutation({
    mutationFn: (data: { phoneNumber: string; message: string }) => {
      console.log('🧪 Iniciando teste WhatsApp com dados:', data);
      return apiRequest("/api/whatsapp-qr/test", "POST", data);
    },
    onSuccess: (response) => {
      console.log('✅ Teste WhatsApp bem-sucedido:', response);
      toast({
        title: "Mensagem enviada",
        description: "Teste do WhatsApp realizado com sucesso",
      });
    },
    onError: (error) => {
      console.error('❌ Erro no teste WhatsApp:', error);
      toast({
        title: "Erro no teste",
        description: error instanceof Error ? error.message : "Falha ao enviar mensagem de teste",
        variant: "destructive",
      });
    },
  });

  // Mutations para WhatsApp Manager (conexões por cliente)
  const createConnectionMutation = useMutation({
    mutationFn: (data: { clientId: string; clientName: string }) =>
      apiRequest("/api/whatsapp/connect", "POST", data),
    onSuccess: () => {
      toast({
        title: "Conexão criada",
        description: "QR Code sendo gerado... Aguarde alguns segundos"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/connections"] });
      setSelectedClientId("");
      setSelectedClientName("");
      
      // Atualizações periódicas para capturar o QR Code quando gerado
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/connections"] });
      }, 2000);
      
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/connections"] });
      }, 5000);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar conexão",
        description: error.message || "Erro interno do servidor",
        variant: "destructive"
      });
    }
  });

  const disconnectConnectionMutation = useMutation({
    mutationFn: (connectionId: string) =>
      apiRequest(`/api/whatsapp/disconnect/${connectionId}`, "POST"),
    onSuccess: () => {
      toast({
        title: "Conexão desconectada",
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

  const deleteConnectionMutation = useMutation({
    mutationFn: (connectionId: string) =>
      apiRequest(`/api/whatsapp/connections/${connectionId}`, "DELETE"),
    onSuccess: () => {
      toast({
        title: "Conexão removida",
        description: "Conexão WhatsApp removida permanentemente"
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

  const sendTestMessageMutation = useMutation({
    mutationFn: (data: { connectionId: string; phoneNumber: string; message: string }) =>
      apiRequest(`/api/whatsapp/test/${data.connectionId}`, "POST", {
        phoneNumber: data.phoneNumber,
        message: data.message
      }),
    onSuccess: () => {
      toast({
        title: "Mensagem enviada",
        description: "Teste enviado com sucesso"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro no teste",
        description: error.message || "Falha ao enviar mensagem",
        variant: "destructive"
      });
    }
  });

  // Testar chave OpenAI
  const testOpenAI = async () => {
    if (!openaiApiKey.trim()) {
      toast({
        title: "Chave obrigatória",
        description: "Insira uma chave da API OpenAI para testar",
        variant: "destructive",
      });
      return;
    }

    setTestStatus('testing');
    try {
      const response = await apiRequest("/api/test-openai", "POST", { apiKey: openaiApiKey });
      const data = await response.json();
      
      if (data.success) {
        setTestStatus('success');
        toast({
          title: "Chave válida",
          description: data.message,
        });
      } else {
        setTestStatus('error');
        toast({
          title: "Chave inválida",
          description: data.message || "Falha na validação da chave API",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setTestStatus('error');
      toast({
        title: "Erro no teste",
        description: error.message || "Falha ao testar chave API",
        variant: "destructive",
      });
    }
  };

  // Preview de voz
  const playVoicePreview = async () => {
    if (isPlayingVoice) return;
    
    setIsPlayingVoice(true);
    try {
      const response = await apiRequest("/api/preview-tts", "POST", {
        text: "Esta é uma prévia da voz selecionada para as entrevistas.",
        voice: selectedVoice,
      });
      
      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsPlayingVoice(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      }
    } catch (error) {
      setIsPlayingVoice(false);
      toast({
        title: "Erro no preview",
        description: "Não foi possível reproduzir o preview da voz",
        variant: "destructive",
      });
    }
  };

  if (configLoading || voiceLoading || whatsappLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Configurações da API
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isMaster ? "Configure as APIs do sistema" : "Configure sua voz para entrevistas"}
          </p>
        </div>
      </div>

      {/* Configurações Master - OpenAI */}
      {isMaster && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Configurações OpenAI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="openaiKey">Chave da API OpenAI</Label>
                <div className="flex gap-2">
                  <Input
                    id="openaiKey"
                    type="password"
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="flex-1"
                  />
                  <Button
                    onClick={testOpenAI}
                    disabled={testStatus === 'testing' || !openaiApiKey.trim()}
                    size="sm"
                    variant="outline"
                  >
                    {testStatus === 'testing' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : testStatus === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : testStatus === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      'Testar'
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openaiModel">Modelo GPT</Label>
                <Select value={openaiModel} onValueChange={setOpenaiModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o (Recomendado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() => saveConfigMutation.mutate()}
              disabled={saveConfigMutation.isPending}
              className="w-full md:w-auto"
            >
              {saveConfigMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Configurações OpenAI
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Configurações de Voz (Master e Cliente) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Configuração de Voz TTS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="voice">Voz para Entrevistas</Label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nova">Nova (Feminina - Recomendada)</SelectItem>
                  <SelectItem value="shimmer">Shimmer (Feminina)</SelectItem>
                  <SelectItem value="alloy">Alloy (Neutro)</SelectItem>
                  <SelectItem value="onyx">Onyx (Masculina)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={playVoicePreview}
                disabled={isPlayingVoice}
                variant="outline"
                className="w-full"
              >
                {isPlayingVoice ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Volume2 className="h-4 w-4 mr-2" />
                )}
                {isPlayingVoice ? "Reproduzindo..." : "Preview da Voz"}
              </Button>
            </div>
          </div>

          <Button
            onClick={() => saveApiConfigMutation.mutate()}
            disabled={saveApiConfigMutation.isPending}
            className="w-full md:w-auto"
          >
            {saveApiConfigMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Configuração de Voz
          </Button>
        </CardContent>
      </Card>



      {/* Seção de Gerenciamento de Conexões WhatsApp por Cliente (apenas para Master) */}
      {isMaster && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Gerenciamento de Conexões WhatsApp por Cliente
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Gerencie conexões WhatsApp específicas para cada cliente. Cada cliente pode ter sua própria sessão de WhatsApp isolada.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Criar Nova Conexão */}
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border">
              <h3 className="font-medium flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Criar Nova Conexão
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientSelect">Cliente *</Label>
                  <Select 
                    value={selectedClientId} 
                    onValueChange={(value) => {
                      setSelectedClientId(value);
                      const client = clients.find(c => c.id.toString() === value);
                      setSelectedClientName(client?.companyName || "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.companyName} ({client.cnpj})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={() => {
                      if (!selectedClientId || !selectedClientName) {
                        toast({
                          title: "Cliente obrigatório",
                          description: "Selecione um cliente para criar a conexão",
                          variant: "destructive"
                        });
                        return;
                      }
                      createConnectionMutation.mutate({
                        clientId: selectedClientId,
                        clientName: selectedClientName
                      });
                    }}
                    disabled={createConnectionMutation.isPending || !selectedClientId}
                    className="w-full"
                  >
                    {createConnectionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <QrCode className="h-4 w-4 mr-2" />
                    )}
                    Criar Conexão
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista de Conexões Existentes */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Conexões Ativas ({connections.length})
              </h3>

              {connections.length === 0 ? (
                <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed">
                  <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Nenhuma conexão WhatsApp
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Crie conexões WhatsApp específicas para seus clientes
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {connections.map((connection) => (
                    <div key={connection.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{connection.clientName}</h4>
                            <Badge 
                              variant={connection.status === 'connected' ? 'default' : 
                                      connection.status === 'connecting' ? 'secondary' : 'destructive'}
                              className="flex items-center gap-1"
                            >
                              {connection.status === 'connected' ? (
                                <Wifi className="h-3 w-3" />
                              ) : connection.status === 'connecting' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <WifiOff className="h-3 w-3" />
                              )}
                              {connection.status === 'connected' ? 'Conectado' : 
                               connection.status === 'connecting' ? 'Conectando' : 'Desconectado'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>ID: {connection.id}</p>
                            {connection.phoneNumber && (
                              <p>Telefone: {connection.phoneNumber}</p>
                            )}
                            {connection.lastConnection && (
                              <p>Última conexão: {new Date(connection.lastConnection).toLocaleString('pt-BR')}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {connection.status === 'connected' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => disconnectConnectionMutation.mutate(connection.id)}
                              disabled={disconnectConnectionMutation.isPending}
                            >
                              {disconnectConnectionMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <WifiOff className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteConnectionMutation.mutate(connection.id)}
                            disabled={deleteConnectionMutation.isPending}
                          >
                            {deleteConnectionMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* QR Code específico para este cliente quando conectando ou desconectado */}
                      {(connection.status === 'connecting' || connection.status === 'disconnected') && connection.qrCode && (
                        <div className="mt-4 pt-4 border-t space-y-4">
                          <div className="flex flex-col items-center space-y-4 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <div className="text-center">
                              <QrCode className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                              <h5 className="font-medium text-yellow-900 dark:text-yellow-100">
                                QR Code para {connection.clientName}
                              </h5>
                              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                                Escaneie este código para conectar o WhatsApp deste cliente
                              </p>
                            </div>
                            
                            <div className="bg-white p-3 rounded-lg border-2 border-yellow-300">
                              <img 
                                src={connection.qrCode} 
                                alt={`QR Code WhatsApp - ${connection.clientName}`}
                                className="w-48 h-48 mx-auto"
                              />
                            </div>
                            
                            <div className="text-center text-xs text-yellow-700 dark:text-yellow-300">
                              <p className="mb-1 font-medium">Como conectar:</p>
                              <p>WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho</p>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Gerar novo QR Code para este cliente específico
                                createConnectionMutation.mutate({
                                  clientId: connection.clientId,
                                  clientName: connection.clientName
                                });
                              }}
                              disabled={createConnectionMutation.isPending}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Novo QR
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Botão para conectar quando desconectado sem QR */}
                      {connection.status === 'disconnected' && !connection.qrCode && (
                        <div className="mt-4 pt-4 border-t">
                          <Button
                            size="sm"
                            onClick={() => {
                              // Gerar QR Code para este cliente específico
                              createConnectionMutation.mutate({
                                clientId: connection.clientId,
                                clientName: connection.clientName
                              });
                            }}
                            disabled={createConnectionMutation.isPending}
                            className="w-full"
                          >
                            {createConnectionMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <QrCode className="h-4 w-4 mr-2" />
                            )}
                            Gerar QR Code para {connection.clientName}
                          </Button>
                        </div>
                      )}

                      {/* Teste de Mensagem para Conexão Específica */}
                      {connection.status === 'connected' && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          <h5 className="text-sm font-medium">Teste de Mensagem</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Input
                                placeholder="5511999999999"
                                value={managerTestPhone}
                                onChange={(e) => setManagerTestPhone(e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Input
                                placeholder="Mensagem de teste..."
                                value={managerTestMessage}
                                onChange={(e) => setManagerTestMessage(e.target.value)}
                                className="text-sm"
                              />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!managerTestPhone || !managerTestMessage) {
                                toast({
                                  title: "Campos obrigatórios",
                                  description: "Preencha o telefone e a mensagem",
                                  variant: "destructive"
                                });
                                return;
                              }
                              sendTestMessageMutation.mutate({
                                connectionId: connection.id,
                                phoneNumber: managerTestPhone,
                                message: managerTestMessage
                              });
                            }}
                            disabled={sendTestMessageMutation.isPending}
                            className="w-full md:w-auto"
                          >
                            {sendTestMessageMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Enviar Teste
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}