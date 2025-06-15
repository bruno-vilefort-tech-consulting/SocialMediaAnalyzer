import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Database, MessageCircle, Settings, Brain, CheckCircle, AlertCircle, Play, Loader2, Save, Volume2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ApiConfig {
  id?: number;
  openaiApiKey?: string;
  openaiModel?: string;
  openaiVoice?: string;
  whatsappToken?: string;
  whatsappPhoneId?: string;
  globalMonthlyLimit?: number;
  maxInterviewTime?: number;
  maxFileSize?: number;
  createdAt?: Date | null;
}

export default function ApiConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: config, isLoading } = useQuery<ApiConfig>({
    queryKey: ["/api/config"],
  });

  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-3.5-turbo");
  const [openaiVoice, setOpenaiVoice] = useState("nova"); // Padrão Nova
  const [whatsappToken, setWhatsappToken] = useState("");
  const [whatsappPhoneId, setWhatsappPhoneId] = useState("");
  const [globalMonthlyLimit, setGlobalMonthlyLimit] = useState(1000);
  const [maxInterviewTime, setMaxInterviewTime] = useState(1800);
  const [maxFileSize, setMaxFileSize] = useState(52428800);
  const [testStatus, setTestStatus] = useState<{[key: string]: 'idle' | 'testing' | 'success' | 'error'}>({});
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  // Load existing config when data is fetched
  useEffect(() => {
    if (config) {
      setOpenaiApiKey(config.openaiApiKey || "");
      setOpenaiModel(config.openaiModel || "gpt-3.5-turbo");
      setOpenaiVoice(config.openaiVoice || "nova");
      setWhatsappToken(config.whatsappToken || "");
      setWhatsappPhoneId(config.whatsappPhoneId || "");
      setGlobalMonthlyLimit(config.globalMonthlyLimit || 1000);
      setMaxInterviewTime(config.maxInterviewTime || 1800);
      setMaxFileSize(config.maxFileSize || 52428800);
    }
  }, [config]);

  const saveConfigMutation = useMutation({
    mutationFn: (configData: any) => apiRequest("/api/config", "POST", configData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      toast({
        title: "Configurações salvas",
        description: "As configurações foram salvas com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações",
        variant: "destructive",
      });
    },
  });

  // Voice options for OpenAI TTS - Vozes adequadas para português brasileiro
  const voiceOptions = [
    { value: "nova", label: "Nova - Feminina natural e clara" },
    { value: "shimmer", label: "Shimmer - Feminina suave e profissional" },
    { value: "alloy", label: "Alloy - Neutro versátil" },
    { value: "onyx", label: "Onyx - Masculina grave e autoridade" }
  ];

  // Model options for OpenAI (apenas para master)
  const modelOptions = [
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Econômico)" },
    { value: "gpt-4", label: "GPT-4 (Avançado)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo (Rápido)" },
    { value: "gpt-4o", label: "GPT-4o (Mais recente)" }
  ];

  // Test voice preview
  const playVoicePreview = async (voice: string) => {
    if (user?.role === 'master' && !openaiApiKey) {
      toast({
        title: "Erro",
        description: "Configure a chave da API OpenAI primeiro",
        variant: "destructive",
      });
      return;
    }

    setIsPlayingVoice(true);
    
    try {
      const response = await fetch('/api/tts-preview', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("auth_token")}`
        },
        body: JSON.stringify({ 
          apiKey: user?.role === 'master' ? openaiApiKey : undefined,
          voice: voice,
          text: "Olá! Esta é uma demonstração da voz que será usada nas entrevistas. Como você avalia a qualidade desta voz?"
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
        
        audio.onerror = () => {
          setIsPlayingVoice(false);
          URL.revokeObjectURL(audioUrl);
          toast({
            title: "Erro",
            description: "Falha ao reproduzir preview da voz",
            variant: "destructive",
          });
        };
        
        await audio.play();
      } else {
        const errorData = await response.json();
        setIsPlayingVoice(false);
        toast({
          title: "Erro no preview",
          description: errorData.message || "Falha ao gerar preview da voz",
          variant: "destructive",
        });
      }
    } catch (error) {
      setIsPlayingVoice(false);
      toast({
        title: "Erro",
        description: "Falha ao conectar com a API",
        variant: "destructive",
      });
    }
  };

  // Test OpenAI API (apenas master)
  const testOpenAI = async () => {
    if (!openaiApiKey) {
      toast({
        title: "Erro",
        description: "Configure a chave da API OpenAI primeiro",
        variant: "destructive",
      });
      return;
    }

    setTestStatus(prev => ({ ...prev, openai: 'testing' }));

    try {
      const response = await fetch('/api/test-openai', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("auth_token")}`
        },
        body: JSON.stringify({ apiKey: openaiApiKey, model: openaiModel }),
      });

      const result = await response.json();

      if (response.ok) {
        setTestStatus(prev => ({ ...prev, openai: 'success' }));
        toast({
          title: "Teste bem-sucedido",
          description: "API OpenAI configurada corretamente",
        });
      } else {
        setTestStatus(prev => ({ ...prev, openai: 'error' }));
        
        let errorMessage = "Falha no teste da API";
        if (result.message) {
          if (result.message.includes("invalid_api_key") || result.message.includes("Incorrect API key")) {
            errorMessage = "Chave da API inválida. Verifique se a chave está correta.";
          } else if (result.message.includes("quota") || result.message.includes("rate_limit")) {
            errorMessage = "Quota da API excedida. Verifique seu plano OpenAI.";
          } else if (result.message.includes("billing") || result.message.includes("payment")) {
            errorMessage = "Problema de cobrança. Verifique seu método de pagamento na OpenAI.";
          } else {
            errorMessage = result.message;
          }
        }
        
        toast({
          title: "Erro no teste da API",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      setTestStatus(prev => ({ ...prev, openai: 'error' }));
      toast({
        title: "Erro",
        description: "Falha ao conectar com a API OpenAI",
        variant: "destructive",
      });
    }
  };

  // Save API Key (apenas master)
  const saveApiKey = () => {
    const configData = {
      openaiApiKey,
      openaiModel,
      openaiVoice,
      whatsappToken,
      whatsappPhoneId,
      globalMonthlyLimit,
      maxInterviewTime,
      maxFileSize,
    };

    saveConfigMutation.mutate(configData);
  };

  // Save Voice Config (cliente)
  const saveVoiceConfig = () => {
    const configData = {
      openaiVoice,
    };

    saveConfigMutation.mutate(configData);
  };

  // Test WhatsApp API (apenas master)
  const testWhatsApp = async () => {
    if (!whatsappToken || !whatsappPhoneId) {
      toast({
        title: "Erro",
        description: "Configure as credenciais do WhatsApp primeiro",
        variant: "destructive",
      });
      return;
    }

    setTestStatus(prev => ({ ...prev, whatsapp: 'testing' }));

    try {
      const response = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("auth_token")}`
        },
        body: JSON.stringify({ 
          phoneNumber: "5511999999999", // Número de teste
          message: "Teste de configuração WhatsApp - Sistema de Entrevistas AI"
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTestStatus(prev => ({ ...prev, whatsapp: 'success' }));
        toast({
          title: "Teste WhatsApp bem-sucedido",
          description: "WhatsApp Business API configurado corretamente",
        });
      } else {
        setTestStatus(prev => ({ ...prev, whatsapp: 'error' }));
        toast({
          title: "Erro no teste WhatsApp",
          description: result.error || "Verifique as credenciais do WhatsApp Business API",
          variant: "destructive",
        });
      }
    } catch (error) {
      setTestStatus(prev => ({ ...prev, whatsapp: 'error' }));
      toast({
        title: "Erro",
        description: "Falha ao conectar com a API do WhatsApp",
        variant: "destructive",
      });
    }
  };

  const getTestStatusIcon = (status: string) => {
    switch (status) {
      case 'testing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Interface para CLIENTE - apenas configuração de voz
  if (user?.role === 'client') {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center space-x-2">
          <Volume2 className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Configurações de Voz</h1>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Volume2 className="h-5 w-5" />
              <CardTitle>Configurar Voz das Entrevistas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client-voice">Escolha a Voz TTS</Label>
              <div className="flex space-x-2">
                <Select value={openaiVoice} onValueChange={setOpenaiVoice}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {voiceOptions.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => playVoicePreview(openaiVoice)}
                  disabled={isPlayingVoice}
                >
                  {isPlayingVoice ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Clique no botão play para ouvir um preview da voz selecionada
              </p>
            </div>

            <Button 
              onClick={saveVoiceConfig}
              disabled={saveConfigMutation.isPending}
              className="w-full"
            >
              {saveConfigMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Salvar Configuração de Voz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Interface para MASTER - configuração completa
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center space-x-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Configurações da API</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OpenAI Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5" />
              <CardTitle>Configurações OpenAI</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-key">Chave da API OpenAI</Label>
              <div className="flex space-x-2">
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="sk-proj-..."
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveApiKey}
                  disabled={!openaiApiKey || saveConfigMutation.isPending}
                >
                  {saveConfigMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
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
                  {modelOptions.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openai-voice">Voz TTS</Label>
              <div className="flex space-x-2">
                <Select value={openaiVoice} onValueChange={setOpenaiVoice}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {voiceOptions.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => playVoicePreview(openaiVoice)}
                  disabled={isPlayingVoice || !openaiApiKey}
                >
                  {isPlayingVoice ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Clique no botão play para ouvir um preview da voz selecionada
              </p>
            </div>

            <Button 
              onClick={testOpenAI}
              disabled={testStatus.openai === 'testing' || !openaiApiKey}
              className="w-full"
            >
              {getTestStatusIcon(testStatus.openai)}
              <Bot className="mr-2 h-4 w-4" />
              Testar API OpenAI
            </Button>

            {testStatus.openai === 'success' && (
              <Badge variant="default" className="w-full justify-center bg-green-100 text-green-800">
                <CheckCircle className="mr-1 h-3 w-3" />
                API OpenAI funcionando corretamente
              </Badge>
            )}

            {testStatus.openai === 'error' && (
              <Badge variant="destructive" className="w-full justify-center">
                <AlertCircle className="mr-1 h-3 w-3" />
                Erro na configuração da API
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5" />
              <CardTitle>Configurações WhatsApp</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp-token">Token WhatsApp Business</Label>
              <Input
                id="whatsapp-token"
                type="password"
                placeholder="EAAG..."
                value={whatsappToken}
                onChange={(e) => setWhatsappToken(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp-phone">ID do Telefone</Label>
              <Input
                id="whatsapp-phone"
                placeholder="123456789"
                value={whatsappPhoneId}
                onChange={(e) => setWhatsappPhoneId(e.target.value)}
              />
            </div>

            <Button 
              onClick={testWhatsApp}
              disabled={testStatus.whatsapp === 'testing' || !whatsappToken || !whatsappPhoneId}
              className="w-full"
            >
              {getTestStatusIcon(testStatus.whatsapp)}
              <MessageCircle className="mr-2 h-4 w-4" />
              Testar WhatsApp Business API
            </Button>

            {testStatus.whatsapp === 'success' && (
              <Badge variant="default" className="w-full justify-center bg-green-100 text-green-800">
                <CheckCircle className="mr-1 h-3 w-3" />
                WhatsApp Business API funcionando corretamente
              </Badge>
            )}

            {testStatus.whatsapp === 'error' && (
              <Badge variant="destructive" className="w-full justify-center">
                <AlertCircle className="mr-1 h-3 w-3" />
                Erro na configuração do WhatsApp
              </Badge>
            )}

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Como configurar WhatsApp Business API:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Acesse o <a href="https://developers.facebook.com/" target="_blank" className="underline">Meta for Developers</a></li>
                <li>Crie um aplicativo e adicione o produto "WhatsApp Business"</li>
                <li>Configure o webhook: <code className="bg-blue-100 px-1 rounded">https://[seu-dominio]/api/whatsapp/webhook</code></li>
                <li>Copie o Token de Acesso e o ID do Número de Telefone</li>
                <li>Adicione o número no sandbox para testes</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* System Configuration */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <CardTitle>Configurações do Sistema</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthly-limit">Limite Mensal Global</Label>
              <Input
                id="monthly-limit"
                type="number"
                value={globalMonthlyLimit}
                onChange={(e) => setGlobalMonthlyLimit(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Número máximo de entrevistas por mês
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interview-time">Tempo Máximo (segundos)</Label>
              <Input
                id="interview-time"
                type="number"
                value={maxInterviewTime}
                onChange={(e) => setMaxInterviewTime(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Duração máxima de cada entrevista
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-size">Tamanho Máximo de Arquivo (bytes)</Label>
              <Input
                id="file-size"
                type="number"
                value={maxFileSize}
                onChange={(e) => setMaxFileSize(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Tamanho máximo para upload de áudio
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={saveApiKey}
          disabled={saveConfigMutation.isPending}
          size="lg"
        >
          {saveConfigMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Salvar Todas as Configurações
        </Button>
      </div>
    </div>
  );
}