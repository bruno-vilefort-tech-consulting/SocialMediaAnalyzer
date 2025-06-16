import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bot, Settings, CheckCircle, AlertCircle, Loader2, Save, Volume2, MessageSquare, QrCode, Smartphone, Send, RefreshCw } from "lucide-react";
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
    mutationFn: (data: { phoneNumber: string; message: string }) => 
      apiRequest("/api/whatsapp-qr/test", "POST", data),
    onSuccess: () => {
      toast({
        title: "Mensagem enviada",
        description: "Teste do WhatsApp realizado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro no teste",
        description: "Falha ao enviar mensagem de teste",
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