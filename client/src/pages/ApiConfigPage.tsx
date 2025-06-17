import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Bot, Settings, CheckCircle, AlertCircle, Loader2, Save, Volume2, MessageSquare, QrCode, Smartphone, Send, RefreshCw, Trash2, Phone, Wifi, WifiOff, PhoneOff } from "lucide-react";
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

  // Status WhatsApp QR - Usa endpoint específico baseado no tipo de usuário
  const whatsappEndpoint = isMaster ? "/api/whatsapp-qr/status" : "/api/client/whatsapp/status";
  const { data: whatsappStatus, isLoading: whatsappLoading, refetch: refetchWhatsAppStatus } = useQuery<WhatsAppStatus>({
    queryKey: [whatsappEndpoint],
    refetchInterval: 15000, // Reduzido para 15 segundos para diminuir refresh
    refetchOnWindowFocus: false, // Desabilitado para evitar refresh desnecessário
    refetchOnMount: true,
    staleTime: 10000, // Cache por 10 segundos
  });

  // Estados para configurações master
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o");
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Estado para configuração de voz (cliente)
  const [selectedVoice, setSelectedVoice] = useState<string>("nova");
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  // Inicializar valores das configurações carregadas
  React.useEffect(() => {
    if (isMaster && masterSettings) {
      setOpenaiApiKey(masterSettings.openaiApiKey || "");
      setOpenaiModel(masterSettings.gptModel || "gpt-4o");
    }
  }, [isMaster, masterSettings]);

  // Inicializar configuração de voz baseada na nova arquitetura
  React.useEffect(() => {
    if (apiConfig?.openaiVoice) {
      setSelectedVoice(apiConfig.openaiVoice);
      console.log('🎵 Voz carregada do apiConfig:', apiConfig.openaiVoice);
    } else if (!isMaster && voiceSetting?.voice) {
      // Fallback para compatibilidade com sistema antigo
      setSelectedVoice(voiceSetting.voice);
      console.log('🎵 Voz carregada do voiceSetting (fallback):', voiceSetting.voice);
    }
  }, [apiConfig, voiceSetting, isMaster]);

  // Estados para teste WhatsApp
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Esta é uma mensagem de teste do sistema de entrevistas.");
  


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
      console.log('💾 Salvando configuração de voz:', {
        entityType,
        entityId,
        selectedVoice,
        isMaster,
        userClientId: user?.clientId
      });
      
      return await apiRequest("/api/api-config", "POST", {
        entityType,
        entityId,
        openaiVoice: selectedVoice,
      });
    },
    onSuccess: (data) => {
      console.log('✅ Configuração salva com sucesso:', data);
      queryClient.invalidateQueries({ queryKey: [`/api/api-config/${entityType}/${entityId}`] });
      
      // Também invalidar configurações antigas para compatibilidade
      if (!isMaster && user?.clientId) {
        queryClient.invalidateQueries({ queryKey: [`/api/client-voice-settings/${user.clientId}`] });
      }
      
      toast({
        title: "Configurações salvas",
        description: `Voz "${selectedVoice}" configurada com sucesso`,
      });
    },
    onError: (error) => {
      console.error('❌ Erro ao salvar configuração:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Falha ao salvar configurações",
        variant: "destructive",
      });
    },
  });

  // Mutations para WhatsApp QR - Usa endpoints específicos baseado no tipo de usuário
  const connectEndpoint = isMaster ? "/api/whatsapp-qr/reconnect" : "/api/client/whatsapp/connect";
  const disconnectEndpoint = isMaster ? "/api/whatsapp-qr/disconnect" : "/api/client/whatsapp/disconnect";
  const testEndpoint = isMaster ? "/api/whatsapp-qr/test" : "/api/client/whatsapp/test";

  const connectWhatsAppMutation = useMutation({
    mutationFn: () => apiRequest(connectEndpoint, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [whatsappEndpoint] });
      toast({
        title: "Gerando QR Code...",
        description: "Aguarde alguns segundos para o QR Code aparecer",
      });
      
      // Atualiza status após um delay para permitir geração do QR
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [whatsappEndpoint] });
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
    mutationFn: () => apiRequest(disconnectEndpoint, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [whatsappEndpoint] });
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
      return apiRequest(testEndpoint, "POST", data);
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



  // Estados para WhatsApp do próprio cliente
  const [clientWhatsappStatus, setClientWhatsappStatus] = useState<WhatsAppStatus>({ 
    isConnected: false, 
    qrCode: null 
  });
  const [clientTestPhone, setClientTestPhone] = useState("");
  const [clientTestMessage, setClientTestMessage] = useState("Olá! Esta é uma mensagem de teste do sistema de entrevistas.");

  // Query para buscar status WhatsApp do cliente
  const { data: clientWhatsappConfig, refetch: refetchClientWhatsapp } = useQuery({
    queryKey: [`/api/api-config/client/${user?.clientId}`],
    enabled: user?.role === 'client' && !!user?.clientId,
    refetchInterval: 15000, // Verifica a cada 15 segundos
  });

  // Mutation para conectar WhatsApp do cliente
  const connectClientWhatsappMutation = useMutation({
    mutationFn: () => apiRequest(`/api/whatsapp-qr/connect-client`, "POST"),
    onSuccess: () => {
      toast({
        title: "Conectando WhatsApp",
        description: "QR Code sendo gerado... Aguarde alguns segundos"
      });
      setTimeout(() => refetchClientWhatsapp(), 2000);
      setTimeout(() => refetchClientWhatsapp(), 5000);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao conectar",
        description: error.message || "Erro interno do servidor",
        variant: "destructive"
      });
    }
  });

  // Mutation para desconectar WhatsApp do cliente
  const disconnectClientWhatsappMutation = useMutation({
    mutationFn: () => apiRequest(`/api/whatsapp-qr/disconnect-client`, "POST"),
    onSuccess: () => {
      toast({
        title: "WhatsApp desconectado",
        description: "Conexão removida com sucesso"
      });
      refetchClientWhatsapp();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao desconectar",
        description: error.message || "Erro interno do servidor",
        variant: "destructive"
      });
    }
  });

  // Mutation para enviar teste WhatsApp do cliente
  const sendClientTestMutation = useMutation({
    mutationFn: (data: { phoneNumber: string; message: string }) =>
      apiRequest(`/api/whatsapp-qr/test-client`, "POST", data),
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

  // Mutation para enviar teste WhatsApp via WhatsApp Manager (master)
  const sendTestMessageMutation = useMutation({
    mutationFn: (data: { connectionId: string; phoneNumber: string; message: string }) =>
      apiRequest(`/api/whatsapp/send/${data.connectionId}`, "POST", {
        phoneNumber: data.phoneNumber,
        message: data.message
      }),
    onSuccess: () => {
      toast({
        title: "Mensagem enviada",
        description: "Teste do WhatsApp Manager enviado com sucesso"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro no teste",
        description: error.message || "Falha ao enviar mensagem do WhatsApp Manager",
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
    console.log('🎵 Iniciando preview da voz:', selectedVoice);
    
    if (!selectedVoice) {
      toast({
        title: "Voz não selecionada",
        description: "Selecione uma voz antes do preview",
        variant: "destructive",
      });
      return;
    }
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

      {/* WhatsApp para Cliente - Interface idêntica ao Master */}
      {!isMaster && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              WhatsApp para Entrevistas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure e gerencie sua conexão WhatsApp para envio de convites de entrevista.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status da Conexão */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    clientWhatsappConfig?.whatsappQrConnected ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium">Status da Conexão</p>
                    <p className="text-sm text-muted-foreground">
                      {clientWhatsappConfig?.whatsappQrConnected ? 
                        `Conectado - ${clientWhatsappConfig.whatsappQrPhoneNumber || 'Número não identificado'}` : 
                        'Desconectado'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {clientWhatsappConfig?.whatsappQrConnected ? (
                    <Button
                      onClick={() => disconnectClientWhatsappMutation.mutate()}
                      disabled={disconnectClientWhatsappMutation.isPending}
                      variant="destructive"
                      size="sm"
                    >
                      {disconnectClientWhatsappMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <PhoneOff className="h-4 w-4 mr-2" />
                      )}
                      Desconectar
                    </Button>
                  ) : (
                    <Button
                      onClick={() => connectClientWhatsappMutation.mutate()}
                      disabled={connectClientWhatsappMutation.isPending}
                      size="sm"
                    >
                      {connectClientWhatsappMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <QrCode className="h-4 w-4 mr-2" />
                      )}
                      Conectar WhatsApp
                    </Button>
                  )}
                </div>
              </div>

              {/* QR Code quando não conectado */}
              {!clientWhatsappConfig?.whatsappQrConnected && (
                <div className="text-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border">
                  <QrCode className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-sm text-muted-foreground">
                    Clique em "Conectar WhatsApp" para gerar o QR Code
                  </p>
                </div>
              )}
            </div>

            {/* Teste de Mensagem */}
            {clientWhatsappConfig?.whatsappQrConnected && (
              <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Teste de Mensagem
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="testPhone">Número de Teste</Label>
                    <Input
                      id="clientTestPhone"
                      value={clientTestPhone}
                      onChange={(e) => setClientTestPhone(e.target.value)}
                      placeholder="5511999999999"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientTestMessage">Mensagem</Label>
                    <Input
                      id="clientTestMessage"
                      value={clientTestMessage}
                      onChange={(e) => setClientTestMessage(e.target.value)}
                      placeholder="Mensagem de teste"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => {
                    if (!clientTestPhone.trim() || !clientTestMessage.trim()) {
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha o número e a mensagem para enviar o teste",
                        variant: "destructive"
                      });
                      return;
                    }
                    sendClientTestMutation.mutate({
                      phoneNumber: clientTestPhone,
                      message: clientTestMessage
                    });
                  }}
                  disabled={sendClientTestMutation.isPending}
                  className="w-full md:w-auto"
                >
                  {sendClientTestMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar Teste
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}



      {/* Configurações WhatsApp para Cliente */}
      {!isMaster && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Configuração WhatsApp
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure sua conexão WhatsApp para envio de entrevistas automáticas
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status da Conexão WhatsApp */}
            <div className="space-y-4">
              {whatsappStatus?.isConnected ? (
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-green-900 dark:text-green-100">WhatsApp Conectado</h4>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {whatsappStatus.phone ? `Telefone: ${whatsappStatus.phone}` : 'Conexão ativa'}
                      </p>
                      {whatsappStatus.lastConnection && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Última conexão: {new Date(whatsappStatus.lastConnection).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => disconnectWhatsAppMutation.mutate()}
                    disabled={disconnectWhatsAppMutation.isPending}
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {disconnectWhatsAppMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <WifiOff className="h-4 w-4 mr-2" />
                    )}
                    Desconectar
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-yellow-100 dark:bg-yellow-900/50 rounded-full flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-yellow-900 dark:text-yellow-100">WhatsApp Desconectado</h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          Conecte seu WhatsApp para enviar entrevistas automáticas
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => connectWhatsAppMutation.mutate()}
                      disabled={connectWhatsAppMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
                    >
                      {connectWhatsAppMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Wifi className="h-4 w-4 mr-2" />
                      )}
                      Conectar
                    </Button>
                  </div>

                  {/* QR Code para Conexão */}
                  {whatsappStatus?.qrCode && (
                    <div className="flex flex-col items-center space-y-4 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="text-center">
                        <QrCode className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                        <h5 className="font-medium text-blue-900 dark:text-blue-100">
                          Escaneie o QR Code
                        </h5>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                          Use o WhatsApp do seu celular para escanear este código
                        </p>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg border">
                        <img 
                          src={whatsappStatus.qrCode} 
                          alt="QR Code WhatsApp" 
                          className="w-48 h-48 mx-auto"
                        />
                      </div>
                      
                      <div className="text-center">
                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                          1. Abra o WhatsApp no seu celular<br/>
                          2. Toque em ⋮ (menu) ou em Configurações<br/>
                          3. Selecione "Dispositivos conectados"<br/>
                          4. Toque em "Conectar um dispositivo"<br/>
                          5. Escaneie este código
                        </p>
                        
                        <Button
                          onClick={() => refetchWhatsAppStatus()}
                          variant="outline"
                          size="sm"
                          className="mt-2"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Atualizar Status
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Teste de Envio WhatsApp (apenas quando conectado) */}
            {whatsappStatus?.isConnected && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border">
                <h4 className="font-medium flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Teste de Envio
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="globalTestPhone">Número de Teste</Label>
                    <Input
                      id="globalTestPhone"
                      placeholder="5511999999999"
                      value={clientTestPhone}
                      onChange={(e) => setClientTestPhone(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="globalTestMessage">Mensagem de Teste</Label>
                    <Input
                      id="globalTestMessage"
                      placeholder="Mensagem de teste..."
                      value={clientTestMessage}
                      onChange={(e) => setClientTestMessage(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                
                <Button
                  onClick={() => {
                    if (!clientTestPhone.trim() || !clientTestMessage.trim()) {
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha o número e a mensagem de teste",
                        variant: "destructive"
                      });
                      return;
                    }
                    testWhatsAppMutation.mutate({
                      phoneNumber: clientTestPhone,
                      message: clientTestMessage
                    });
                  }}
                  disabled={testWhatsAppMutation.isPending}
                  className="w-full md:w-auto"
                >
                  {testWhatsAppMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar Teste
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}