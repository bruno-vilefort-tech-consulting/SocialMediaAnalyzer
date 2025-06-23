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
import { Bot, Settings, CheckCircle, AlertCircle, Loader2, Save, Volume2 } from "lucide-react";
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

export default function ApiConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isMaster = user?.role === 'master';

  // Estados locais
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [gptModel, setGptModel] = useState("gpt-4o-mini");
  const [selectedVoice, setSelectedVoice] = useState("nova");
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

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

  // Carregar dados existentes
  useEffect(() => {
    if (masterSettings) {
      setOpenaiApiKey(masterSettings.openaiApiKey || "");
      setGptModel(masterSettings.gptModel || "gpt-4o-mini");
    }
  }, [masterSettings]);

  useEffect(() => {
    if (apiConfig?.openaiVoice) {
      console.log('🎵 Voz carregada do apiConfig:', apiConfig.openaiVoice);
      setSelectedVoice(apiConfig.openaiVoice);
    } else if (voiceSetting?.voice) {
      console.log('🎵 Voz carregada do voiceSetting (legacy):', voiceSetting.voice);
      setSelectedVoice(voiceSetting.voice);
    }
  }, [apiConfig, voiceSetting]);

  // Mutations
  const saveMasterConfigMutation = useMutation({
    mutationFn: () => apiRequest("/api/master-settings", "POST", {
      openaiApiKey,
      gptModel,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master-settings"] });
      toast({
        title: "Configurações salvas",
        description: "Configurações OpenAI atualizadas com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Falha ao salvar as configurações",
        variant: "destructive",
      });
    },
  });

  const saveApiConfigMutation = useMutation({
    mutationFn: () => apiRequest(`/api/api-config/${entityType}/${entityId}`, "POST", {
      openaiVoice: selectedVoice,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/api-config/${entityType}/${entityId}`] });
      toast({
        title: "Configuração salva",
        description: "Voz para TTS atualizada com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Falha ao salvar a configuração de voz",
        variant: "destructive",
      });
    },
  });

  const playVoicePreview = async () => {
    setIsPlayingVoice(true);
    
    try {
      const response = await fetch('/api/tts/preview', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: "Olá! Esta é uma prévia da voz selecionada para as entrevistas.",
          voice: selectedVoice
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsPlayingVoice(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = () => {
          setIsPlayingVoice(false);
          URL.revokeObjectURL(audioUrl);
          toast({
            title: "Erro na reprodução",
            description: "Não foi possível reproduzir a prévia da voz",
            variant: "destructive"
          });
        };
        
        await audio.play();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Erro ao reproduzir preview:', error);
      toast({
        title: "Erro na prévia",
        description: "Falha ao gerar preview da voz",
        variant: "destructive"
      });
      setIsPlayingVoice(false);
    }
  };

  if (configLoading || apiConfigLoading || voiceLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Configurações</h1>
      </div>

      {/* Configurações OpenAI (Masters apenas) */}
      {isMaster && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Configurações OpenAI
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure as credenciais e modelo do OpenAI para todo o sistema
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openaiApiKey">Chave da API OpenAI</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="openaiApiKey"
                  type="password"
                  placeholder="sk-..."
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  className="flex-1"
                />
                {masterSettings?.openaiApiKey && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Configurado
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gptModel">Modelo GPT</Label>
              <Select value={gptModel} onValueChange={setGptModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Recomendado)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => saveMasterConfigMutation.mutate()}
              disabled={saveMasterConfigMutation.isPending}
              className="w-full md:w-auto"
            >
              {saveMasterConfigMutation.isPending ? (
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
    </div>
  );
}