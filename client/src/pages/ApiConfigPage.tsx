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
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${whatsappStatus?.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className="font-medium">
                  Status: {whatsappStatus?.isConnected ? 'Conectado' : 'Desconectado'}
                </p>
                {whatsappStatus?.phone && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Telefone: {whatsappStatus.phone}
                  </p>
                )}
                {whatsappStatus?.lastConnection && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Última conexão: {new Date(whatsappStatus.lastConnection).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
            
            <Badge variant={whatsappStatus?.isConnected ? "default" : "destructive"}>
              {whatsappStatus?.isConnected ? 'Online' : 'Offline'}
            </Badge>
          </div>

          {!whatsappStatus?.isConnected && (
            <div className="text-center space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Conecte seu WhatsApp para enviar entrevistas automáticas
              </p>
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
            </div>
          )}

          {whatsappStatus?.isConnected && (
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-600 font-medium">WhatsApp Conectado</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pronto para enviar entrevistas automáticas via WhatsApp
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}