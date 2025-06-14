import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Database, MessageCircle, Settings, Volume2, Mic, Brain, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  const { data: config, isLoading } = useQuery<ApiConfig>({
    queryKey: ["/api/config"],
  });

  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o");
  const [openaiVoice, setOpenaiVoice] = useState("nova");
  const [whatsappToken, setWhatsappToken] = useState("");
  const [whatsappPhoneId, setWhatsappPhoneId] = useState("");
  const [globalMonthlyLimit, setGlobalMonthlyLimit] = useState(1000);
  const [maxInterviewTime, setMaxInterviewTime] = useState(1800);
  const [maxFileSize, setMaxFileSize] = useState(52428800);
  const [testStatus, setTestStatus] = useState<{[key: string]: 'idle' | 'testing' | 'success' | 'error'}>({});

  // Load existing config when data is fetched
  useEffect(() => {
    if (config) {
      setOpenaiApiKey(config.openaiApiKey || "");
      setOpenaiModel(config.openaiModel || "gpt-4o");
      setOpenaiVoice(config.openaiVoice || "nova");
      setWhatsappToken(config.whatsappToken || "");
      setWhatsappPhoneId(config.whatsappPhoneId || "");
      setGlobalMonthlyLimit(config.globalMonthlyLimit || 1000);
      setMaxInterviewTime(config.maxInterviewTime || 1800);
      setMaxFileSize(config.maxFileSize || 52428800);
    }
  }, [config]);

  const saveConfigMutation = useMutation({
    mutationFn: (configData: any) => apiRequest("POST", "/api/config", configData),
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

  // Test OpenAI API
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: openaiApiKey }),
      });

      if (response.ok) {
        setTestStatus(prev => ({ ...prev, openai: 'success' }));
        toast({
          title: "Teste bem-sucedido",
          description: "API OpenAI configurada corretamente",
        });
      } else {
        throw new Error('API test failed');
      }
    } catch (error) {
      setTestStatus(prev => ({ ...prev, openai: 'error' }));
      toast({
        title: "Erro no teste",
        description: "Verifique a chave da API OpenAI",
        variant: "destructive",
      });
    }
  };

  const handleSaveConfig = () => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'testing':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações da API</h1>
          <p className="text-gray-600">Configure as integrações e limites do sistema</p>
        </div>
        <Button 
          onClick={handleSaveConfig}
          disabled={saveConfigMutation.isPending}
          className="gap-2"
        >
          <Settings className="w-4 h-4" />
          {saveConfigMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>

      {/* OpenAI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            Configurações OpenAI
            {config?.openaiApiKey && (
              <Badge variant="secondary" className="ml-auto">
                Configurado
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
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
                  variant="outline" 
                  onClick={testOpenAI}
                  disabled={!openaiApiKey || testStatus.openai === 'testing'}
                  className="gap-2"
                >
                  {getStatusIcon(testStatus.openai)}
                  Testar
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                Necessária para TTS, transcrição Whisper e análise de respostas
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="openai-model">Modelo ChatGPT</Label>
                <Select value={openaiModel} onValueChange={setOpenaiModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o (Recomendado)</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai-voice">Voz TTS</Label>
                <Select value={openaiVoice} onValueChange={setOpenaiVoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nova">Nova (Feminina)</SelectItem>
                    <SelectItem value="alloy">Alloy (Neutra)</SelectItem>
                    <SelectItem value="echo">Echo (Masculina)</SelectItem>
                    <SelectItem value="fable">Fable (Neutra)</SelectItem>
                    <SelectItem value="onyx">Onyx (Masculina)</SelectItem>
                    <SelectItem value="shimmer">Shimmer (Feminina)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
            <div className="text-center">
              <Volume2 className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-sm font-medium">Text-to-Speech</p>
              <p className="text-xs text-gray-600">Perguntas em áudio</p>
            </div>
            <div className="text-center">
              <Mic className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-sm font-medium">Whisper</p>
              <p className="text-xs text-gray-600">Transcrição de áudio</p>
            </div>
            <div className="text-center">
              <Brain className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-sm font-medium">Análise IA</p>
              <p className="text-xs text-gray-600">Avaliação automática</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Configurações WhatsApp Business
            {config?.whatsappToken && (
              <Badge variant="secondary" className="ml-auto">
                Configurado
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp-token">Token da API WhatsApp</Label>
              <Input
                id="whatsapp-token"
                type="password"
                placeholder="Token da Meta Business API"
                value={whatsappToken}
                onChange={(e) => setWhatsappToken(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp-phone">ID do Telefone WhatsApp</Label>
              <Input
                id="whatsapp-phone"
                placeholder="ID do número de telefone verificado"
                value={whatsappPhoneId}
                onChange={(e) => setWhatsappPhoneId(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Nota:</strong> Configure sua conta WhatsApp Business e obtenha as credenciais da API 
              através do Meta Business Manager para enviar convites automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* System Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-600" />
            Limites do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthly-limit">Limite Mensal Global</Label>
              <Input
                id="monthly-limit"
                type="number"
                value={globalMonthlyLimit}
                onChange={(e) => setGlobalMonthlyLimit(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-gray-500">Entrevistas por mês (todos os clientes)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interview-time">Tempo Máximo por Entrevista</Label>
              <Input
                id="interview-time"
                type="number"
                value={maxInterviewTime}
                onChange={(e) => setMaxInterviewTime(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-gray-500">Segundos (padrão: 1800 = 30min)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-size">Tamanho Máximo de Arquivo</Label>
              <Input
                id="file-size"
                type="number"
                value={Math.round(maxFileSize / 1024 / 1024)}
                onChange={(e) => setMaxFileSize((parseInt(e.target.value) || 0) * 1024 * 1024)}
              />
              <p className="text-xs text-gray-500">MB (padrão: 50MB)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Summary */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle>Status das Integrações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  <span className="text-sm font-medium">OpenAI</span>
                </div>
                <Badge variant={config.openaiApiKey ? "default" : "secondary"}>
                  {config.openaiApiKey ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">WhatsApp</span>
                </div>
                <Badge variant={config.whatsappToken ? "default" : "secondary"}>
                  {config.whatsappToken ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span className="text-sm font-medium">Sistema</span>
                </div>
                <Badge variant="default">Operacional</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}