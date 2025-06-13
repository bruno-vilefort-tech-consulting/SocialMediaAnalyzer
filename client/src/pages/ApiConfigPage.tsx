import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Database, MessageCircle, Settings } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ApiConfig } from "@shared/schema";

export default function ApiConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery<ApiConfig>({
    queryKey: ["/api/config"],
  });

  const [openaiConfig, setOpenaiConfig] = useState({
    apiKey: "",
    model: "tts-1",
    voice: "nova"
  });

  const [firebaseConfig, setFirebaseConfig] = useState({
    projectId: "",
    serviceAccount: ""
  });

  const [whatsappConfig, setWhatsappConfig] = useState({
    token: "",
    phoneId: ""
  });

  const [systemLimits, setSystemLimits] = useState({
    globalMonthlyLimit: 10000,
    maxInterviewTime: 1800,
    maxFileSize: 52428800
  });

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

  const handleSaveConfig = (section: string) => {
    let configData: any = {};

    switch (section) {
      case "openai":
        configData = {
          openaiApiKey: openaiConfig.apiKey,
          openaiModel: openaiConfig.model,
          openaiVoice: openaiConfig.voice
        };
        break;
      case "firebase":
        configData = {
          firebaseProjectId: firebaseConfig.projectId,
          firebaseServiceAccount: JSON.parse(firebaseConfig.serviceAccount || "{}")
        };
        break;
      case "whatsapp":
        configData = {
          whatsappToken: whatsappConfig.token,
          whatsappPhoneId: whatsappConfig.phoneId
        };
        break;
      case "limits":
        configData = systemLimits;
        break;
    }

    saveConfigMutation.mutate(configData);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Configurações de API</h2>
          <p className="text-slate-600">Gerenciar credenciais e configurações dos serviços externos</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-slate-200 rounded mb-4"></div>
                <div className="space-y-4">
                  <div className="h-4 bg-slate-200 rounded"></div>
                  <div className="h-10 bg-slate-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Configurações de API</h2>
        <p className="text-slate-600">Gerenciar credenciais e configurações dos serviços externos</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OpenAI Config */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <Bot className="text-green-600" />
              </div>
              <div>
                <CardTitle>OpenAI</CardTitle>
                <p className="text-sm text-slate-500">TTS, Whisper e ChatGPT</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="openai-key">API Key</Label>
              <Input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={openaiConfig.apiKey}
                onChange={(e) => setOpenaiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="openai-model">Modelo TTS</Label>
              <select 
                id="openai-model"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                value={openaiConfig.model}
                onChange={(e) => setOpenaiConfig(prev => ({ ...prev, model: e.target.value }))}
              >
                <option value="tts-1">tts-1</option>
                <option value="tts-1-hd">tts-1-hd</option>
              </select>
            </div>
            <div>
              <Label htmlFor="openai-voice">Voz</Label>
              <select 
                id="openai-voice"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                value={openaiConfig.voice}
                onChange={(e) => setOpenaiConfig(prev => ({ ...prev, voice: e.target.value }))}
              >
                <option value="nova">nova</option>
                <option value="alloy">alloy</option>
                <option value="echo">echo</option>
              </select>
            </div>
            <Button 
              onClick={() => handleSaveConfig("openai")}
              disabled={saveConfigMutation.isPending}
              className="w-full"
            >
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>
        
        {/* Firebase Config */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                <Database className="text-orange-600" />
              </div>
              <div>
                <CardTitle>Firebase</CardTitle>
                <p className="text-sm text-slate-500">Database e Storage</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="firebase-project">Project ID</Label>
              <Input
                id="firebase-project"
                placeholder="maximus-interview-system"
                value={firebaseConfig.projectId}
                onChange={(e) => setFirebaseConfig(prev => ({ ...prev, projectId: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="firebase-service">Service Account Key</Label>
              <Textarea
                id="firebase-service"
                rows={4}
                placeholder="{ ... }"
                value={firebaseConfig.serviceAccount}
                onChange={(e) => setFirebaseConfig(prev => ({ ...prev, serviceAccount: e.target.value }))}
              />
            </div>
            <Button 
              onClick={() => handleSaveConfig("firebase")}
              disabled={saveConfigMutation.isPending}
              className="w-full"
            >
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>
        
        {/* WhatsApp Config */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <MessageCircle className="text-green-600" />
              </div>
              <div>
                <CardTitle>WhatsApp Business</CardTitle>
                <p className="text-sm text-slate-500">Envio de convites</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="whatsapp-token">Token</Label>
              <Input
                id="whatsapp-token"
                type="password"
                placeholder="EAAT..."
                value={whatsappConfig.token}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, token: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="whatsapp-phone">Phone Number ID</Label>
              <Input
                id="whatsapp-phone"
                placeholder="123456789"
                value={whatsappConfig.phoneId}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, phoneId: e.target.value }))}
              />
            </div>
            <Button 
              onClick={() => handleSaveConfig("whatsapp")}
              disabled={saveConfigMutation.isPending}
              className="w-full"
            >
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>
        
        {/* System Limits */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <Settings className="text-purple-600" />
              </div>
              <div>
                <CardTitle>Limites do Sistema</CardTitle>
                <p className="text-sm text-slate-500">Configurações globais</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="global-limit">Limite Global Mensal</Label>
              <Input
                id="global-limit"
                type="number"
                placeholder="10000"
                value={systemLimits.globalMonthlyLimit}
                onChange={(e) => setSystemLimits(prev => ({ ...prev, globalMonthlyLimit: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <Label htmlFor="max-time">Tempo Máximo de Entrevista (min)</Label>
              <Input
                id="max-time"
                type="number"
                placeholder="30"
                value={systemLimits.maxInterviewTime / 60}
                onChange={(e) => setSystemLimits(prev => ({ ...prev, maxInterviewTime: parseInt(e.target.value) * 60 }))}
              />
            </div>
            <div>
              <Label htmlFor="max-file">Tamanho Máximo de Arquivo (MB)</Label>
              <Input
                id="max-file"
                type="number"
                placeholder="50"
                value={systemLimits.maxFileSize / 1048576}
                onChange={(e) => setSystemLimits(prev => ({ ...prev, maxFileSize: parseInt(e.target.value) * 1048576 }))}
              />
            </div>
            <Button 
              onClick={() => handleSaveConfig("limits")}
              disabled={saveConfigMutation.isPending}
              className="w-full"
            >
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
