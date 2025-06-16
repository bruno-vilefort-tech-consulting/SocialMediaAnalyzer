import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bot, Settings, CheckCircle, AlertCircle, Loader2, Save, Volume2, MessageSquare, QrCode, Smartphone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ApiConfig {
  id?: number;
  openaiApiKey?: string;
  openaiModel?: string;
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

export default function ApiConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isMaster = user?.role === 'master';

  // API Config para master
  const { data: config, isLoading: configLoading } = useQuery<ApiConfig>({
    queryKey: ["/api/config"],
    enabled: isMaster,
  });

  // Configurações de voz para cliente
  const { data: voiceSetting, isLoading: voiceLoading } = useQuery<ClientVoiceSetting>({
    queryKey: [`/api/client-voice-settings/${user?.clientId}`],
    enabled: !isMaster && !!user?.clientId,
  });

  // Status WhatsApp QR
  const { data: whatsappStatus, isLoading: whatsappLoading } = useQuery<WhatsAppStatus>({
    queryKey: ["/api/whatsapp-qr/status"],
  });

  // Estados para configurações master
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o");
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Estados para configurações cliente
  const [selectedVoice, setSelectedVoice] = useState("nova");
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  // Estados para WhatsApp
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Teste de conexão WhatsApp QR - Sistema de Entrevistas");

  // Vozes disponíveis otimizadas para português brasileiro
  const voices = [
    { value: "nova", label: "Nova (Feminina, Natural)" },
    { value: "shimmer", label: "Shimmer (Feminina, Suave)" },
    { value: "alloy", label: "Alloy (Neutro, Claro)" },
    { value: "onyx", label: "Onyx (Masculino, Profundo)" }
  ];

  // Modelos GPT disponíveis
  const gptModels = [
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Rápido)" },
    { value: "gpt-4", label: "GPT-4 (Equilibrado)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo (Avançado)" },
    { value: "gpt-4o", label: "GPT-4o (Mais Recente)" }
  ];

  // Carregar dados existentes
  useEffect(() => {
    if (config) {
      setOpenaiApiKey(config.openaiApiKey || "");
      setOpenaiModel(config.openaiModel || "gpt-4o");
    }
  }, [config]);

  useEffect(() => {
    if (voiceSetting) {
      setSelectedVoice(voiceSetting.voice || "nova");
    }
  }, [voiceSetting]);

  // Mutation para salvar configuração master
  const saveConfigMutation = useMutation({
    mutationFn: async (data: Partial<ApiConfig>) => {
      return await apiRequest("/api/config", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      toast({
        title: "Configuração salva",
        description: "Configurações OpenAI salvas com sucesso",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Erro ao salvar configurações",
        variant: "destructive",
      });
    },
  });

  // Mutation para salvar configuração de voz cliente
  const saveVoiceMutation = useMutation({
    mutationFn: async (data: Partial<ClientVoiceSetting>) => {
      return await apiRequest("/api/client-voice-settings", "POST", data);
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
        title: "Erro ao salvar voz",
        description: error.message || "Erro ao salvar configuração de voz",
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
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setTestStatus('error');
      toast({
        title: "Erro no teste",
        description: error.message || "Erro ao testar chave OpenAI",
        variant: "destructive",
      });
    }
  };

  // Preview de voz
  const playVoicePreview = async () => {
    if (!selectedVoice) return;
    
    setIsPlayingVoice(true);
    try {
      const response = await fetch('/api/preview-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: "Olá! Esta é uma demonstração da voz selecionada para as entrevistas.",
          voice: selectedVoice,
          userType: isMaster ? 'master' : 'client'
        }),
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
      } else {
        throw new Error('Erro ao gerar preview');
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

  // Conectar WhatsApp QR
  const connectWhatsAppMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/whatsapp-qr/connect", "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-qr/status"] });
      toast({
        title: "WhatsApp conectado",
        description: "Conexão WhatsApp QR estabelecida com sucesso",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro na conexão",
        description: error.message || "Erro ao conectar WhatsApp",
        variant: "destructive",
      });
    },
  });

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
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Configurações da API</h1>
      </div>

      {/* Configurações OpenAI - Apenas Master */}
      {isMaster && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Configurações OpenAI (Master)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="openai-key">Chave da API OpenAI</Label>
                <div className="flex gap-2">
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="sk-..."
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={testOpenAI}
                    disabled={testStatus === 'testing'}
                    variant="outline"
                    size="sm"
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
                <Label htmlFor="openai-model">Modelo GPT</Label>
                <Select value={openaiModel} onValueChange={setOpenaiModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gptModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() => saveConfigMutation.mutate({
                openaiApiKey,
                openaiModel,
              })}
              disabled={saveConfigMutation.isPending}
              className="w-full lg:w-auto"
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

      {/* Configurações de Voz - Cliente ou Master */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Configurações de Voz {isMaster ? "(Master)" : "(Cliente)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="voice-select">Voz para Entrevistas</Label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((voice) => (
                    <SelectItem key={voice.value} value={voice.value}>
                      {voice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Preview da Voz</Label>
              <Button
                onClick={playVoicePreview}
                disabled={isPlayingVoice}
                variant="outline"
                className="w-full"
              >
                {isPlayingVoice ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Reproduzindo...
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    Testar Voz
                  </>
                )}
              </Button>
            </div>
          </div>

          <Button
            onClick={() => saveVoiceMutation.mutate({
              clientId: user?.clientId || 0,
              voice: selectedVoice,
            })}
            disabled={saveVoiceMutation.isPending}
            className="w-full lg:w-auto"
          >
            {saveVoiceMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Configuração de Voz
          </Button>
        </CardContent>
      </Card>

      {/* WhatsApp QR Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status conectado */}
          {whatsappStatus?.isConnected && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100">
                      WhatsApp Conectado
                    </p>
                    {whatsappStatus.phone && (
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Número: +{whatsappStatus.phone}
                      </p>
                    )}
                    {whatsappStatus.lastConnection && (
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Conectado em: {new Date(whatsappStatus.lastConnection).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="default" className="bg-green-600">
                    Online
                  </Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => disconnectWhatsAppMutation.mutate()}
                    disabled={disconnectWhatsAppMutation.isPending}
                  >
                    Desconectar
                  </Button>
                </div>
              </div>

              {/* Seção de teste quando conectado */}
              <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Teste de Envio
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="testPhone" className="text-sm text-blue-800 dark:text-blue-200">
                      Telefone (com código país)
                    </Label>
                    <Input
                      id="testPhone"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="5511999999999"
                      className="bg-white dark:bg-gray-800"
                    />
                  </div>
                  <div>
                    <Label htmlFor="testMessage" className="text-sm text-blue-800 dark:text-blue-200">
                      Mensagem de teste
                    </Label>
                    <Input
                      id="testMessage"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Mensagem de teste..."
                      className="bg-white dark:bg-gray-800"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (!testPhone || !testMessage) {
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha o telefone e a mensagem",
                        variant: "destructive",
                      });
                      return;
                    }
                    testWhatsAppMutation.mutate({
                      phoneNumber: testPhone,
                      message: testMessage,
                    });
                  }}
                  disabled={testWhatsAppMutation.isPending}
                  size="sm"
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
            </div>
          )}

          {/* Status desconectado - aguardando QR */}
          {!whatsappStatus?.isConnected && whatsappStatus?.qrCode && (
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-4 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="text-center">
                  <QrCode className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                  <h3 className="font-medium text-yellow-900 dark:text-yellow-100">Escaneie o QR Code</h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                    Abra o WhatsApp no seu celular e escaneie o código abaixo
                  </p>
                </div>
                
                <div className="bg-white p-4 rounded-lg border-2 border-yellow-300">
                  <img 
                    src={whatsappStatus.qrCode} 
                    alt="QR Code WhatsApp" 
                    className="w-64 h-64 mx-auto"
                  />
                </div>
                
                <div className="text-center text-sm text-yellow-700 dark:text-yellow-300">
                  <p className="mb-2 font-medium">Como escanear:</p>
                  <ol className="text-left space-y-1 list-decimal list-inside">
                    <li>Abra o WhatsApp no celular</li>
                    <li>Toque em "Mais opções" (⋮) ou "Configurações"</li>
                    <li>Selecione "Aparelhos conectados"</li>
                    <li>Toque em "Conectar um aparelho"</li>
                    <li>Escaneie este QR Code</li>
                  </ol>
                </div>

                <Button
                  variant="outline"
                  onClick={() => connectWhatsAppMutation.mutate()}
                  disabled={connectWhatsAppMutation.isPending}
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Gerar Novo QR
                </Button>
              </div>
            </div>
          )}

          {/* Status desconectado - sem QR */}
          {!whatsappStatus?.isConnected && !whatsappStatus?.qrCode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-900 dark:text-red-100">
                      WhatsApp Desconectado
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Conecte seu WhatsApp para enviar entrevistas automáticas
                    </p>
                  </div>
                </div>
                <Badge variant="destructive">
                  Offline
                </Badge>
              </div>

              <div className="text-center space-y-4">
                <Button
                  onClick={() => connectWhatsAppMutation.mutate()}
                  disabled={connectWhatsAppMutation.isPending}
                  className="w-full lg:w-auto"
                >
                  {connectWhatsAppMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <QrCode className="h-4 w-4 mr-2" />
                  )}
                  Conectar WhatsApp
                </Button>
                
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Clique no botão acima para gerar um QR Code e conectar seu WhatsApp
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}