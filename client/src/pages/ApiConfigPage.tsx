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
import { Bot, Settings, CheckCircle, AlertCircle, Loader2, Save, Volume2, MessageCircle, Wifi, WifiOff, RefreshCw, Power, Trash2 } from "lucide-react";
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
  qrCode?: string | null;
  phoneNumber?: string | null;
  instanceId?: string;
  lastConnection?: string | null;
  sessionPath?: string;
}

interface WhatsAppConnectionResponse {
  success: boolean;
  message: string;
  qrCode?: string;
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
  
  // Estados WhatsApp
  const [shouldShowQR, setShouldShowQR] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('Teste de conexão WhatsApp - Sistema de Entrevistas');

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

  // WhatsApp Status Query
  const { data: whatsappStatus, refetch: refetchWhatsAppStatus } = useQuery<WhatsAppStatus>({
    queryKey: [`/api/whatsapp-client/status`],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/whatsapp-client/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    },
    enabled: !isMaster, // Sempre ativo para clientes
    refetchInterval: 5000,
    staleTime: 0,
    retry: 1
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

  // WhatsApp Mutations
  const connectWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/whatsapp-client/connect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json() as Promise<WhatsAppConnectionResponse>;
    },
    onMutate: () => {
      setIsConnecting(true);
      setShouldShowQR(true);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "WhatsApp conectando...",
          description: "Escaneie o QR Code para conectar",
        });
        refetchWhatsAppStatus();
      } else {
        toast({
          title: "Erro na conexão",
          description: data.message,
          variant: "destructive"
        });
      }
      setIsConnecting(false);
    },
    onError: () => {
      toast({
        title: "Erro na conexão",
        description: "Falha ao conectar WhatsApp",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  });

  const disconnectWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/whatsapp-client/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setShouldShowQR(false);
        toast({
          title: "WhatsApp desconectado",
          description: "Conexão WhatsApp encerrada com sucesso",
        });
        refetchWhatsAppStatus();
      }
    },
    onError: () => {
      toast({
        title: "Erro ao desconectar",
        description: "Falha ao desconectar WhatsApp",
        variant: "destructive"
      });
    }
  });

  const clearSessionMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/client/whatsapp/clear-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Sessão limpa",
          description: data.message,
        });
        setShouldShowQR(false);
        refetchWhatsAppStatus();
      }
    },
    onError: () => {
      toast({
        title: "Erro ao limpar",
        description: "Falha ao limpar sessão WhatsApp",
        variant: "destructive"
      });
    }
  });

  const sendTestMessageMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/whatsapp-client/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: whatsappPhone,
          message: whatsappMessage,
          clientId: user?.clientId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Mensagem enviada",
          description: "Mensagem de teste enviada com sucesso!",
        });
      } else {
        toast({
          title: "Erro no envio",
          description: data.message,
          variant: "destructive"
        });
      }
    },
    onError: () => {
      toast({
        title: "Erro no teste",
        description: "Falha ao enviar mensagem de teste",
        variant: "destructive"
      });
    }
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

      {/* Configurações WhatsApp (Clientes apenas) */}
      {!isMaster && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Conexão WhatsApp
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure a conexão WhatsApp para envio de entrevistas automáticas
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status da Conexão */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {whatsappStatus?.isConnected ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Wifi className="h-5 w-5" />
                    <span className="font-medium">Conectado</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <WifiOff className="h-5 w-5" />
                    <span className="font-medium">Desconectado</span>
                  </div>
                )}
                {whatsappStatus?.phoneNumber && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    {whatsappStatus.phoneNumber}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {whatsappStatus?.isConnected ? (
                  <>
                    <Button
                      onClick={() => clearSessionMutation.mutate()}
                      disabled={clearSessionMutation.isPending}
                      variant="secondary"
                      size="sm"
                    >
                      {clearSessionMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Limpar Sessão
                    </Button>
                    <Button
                      onClick={() => disconnectWhatsAppMutation.mutate()}
                      disabled={disconnectWhatsAppMutation.isPending}
                      variant="outline"
                      size="sm"
                    >
                      {disconnectWhatsAppMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Power className="h-4 w-4 mr-2" />
                      )}
                      Desconectar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => connectWhatsAppMutation.mutate()}
                      disabled={isConnecting || connectWhatsAppMutation.isPending}
                      size="sm"
                    >
                      {isConnecting || connectWhatsAppMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <MessageCircle className="h-4 w-4 mr-2" />
                      )}
                      Conectar WhatsApp
                    </Button>
                    
                    {shouldShowQR && whatsappStatus?.qrCode && (
                      <Button
                        onClick={() => {
                          setShouldShowQR(false);
                          setTimeout(() => {
                            connectWhatsAppMutation.mutate();
                          }, 500);
                        }}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Atualizar QR
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => clearSessionMutation.mutate()}
                      disabled={clearSessionMutation.isPending}
                      variant="secondary"
                      size="sm"
                    >
                      {clearSessionMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Limpar Sessão
                    </Button>
                  </>
                )}
              </div>
            </div>



            {/* QR Code */}
            {whatsappStatus?.qrCode && !whatsappStatus?.isConnected && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">Escaneie o QR Code</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Abra o WhatsApp no seu celular, vá em "Dispositivos conectados" e escaneie este código
                  </p>
                  
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-lg shadow-lg border-2 border-gray-200">
                      <img 
                        src={whatsappStatus.qrCode} 
                        alt="QR Code WhatsApp" 
                        width={256}
                        height={256}
                        style={{ 
                          width: '256px',
                          height: '256px',
                          display: 'block'
                        }}
                      />
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    QR Code expira em 90 segundos. Se não funcionar, clique em "Atualizar QR"
                  </p>
                </div>
              </div>
            )}

            {/* Casos quando QR Code NÃO aparece */}
            {!whatsappStatus?.qrCode && (
              <div className="p-4 bg-red-100 border border-red-400 rounded">
                <p className="text-red-800">QR Code não encontrado nos dados</p>
              </div>
            )}

            {whatsappStatus?.isConnected && (
              <div className="p-4 bg-blue-100 border border-blue-400 rounded">
                <p className="text-blue-800">WhatsApp já está conectado</p>
              </div>
            )}

            {/* Teste de Mensagem */}
            {whatsappStatus?.isConnected && (
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <h4 className="font-medium">Teste de Conexão</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="testPhone">Número de Teste</Label>
                    <Input
                      id="testPhone"
                      placeholder="5511999999999"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="testMessage">Mensagem</Label>
                    <Input
                      id="testMessage"
                      value={whatsappMessage}
                      onChange={(e) => setWhatsappMessage(e.target.value)}
                    />
                  </div>
                </div>
                
                <Button
                  onClick={() => sendTestMessageMutation.mutate()}
                  disabled={sendTestMessageMutation.isPending || !whatsappPhone}
                  className="w-full"
                >
                  {sendTestMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <MessageCircle className="h-4 w-4 mr-2" />
                  )}
                  Enviar Mensagem de Teste
                </Button>
              </div>
            )}

            {/* Informações Técnicas */}
            {whatsappStatus && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Instance ID:</strong> {whatsappStatus.instanceId || 'N/A'}</p>
                <p><strong>Última Conexão:</strong> {
                  whatsappStatus.lastConnection 
                    ? typeof whatsappStatus.lastConnection === 'string' 
                      ? new Date(whatsappStatus.lastConnection).toLocaleString('pt-BR')
                      : 'Data inválida'
                    : 'Nunca'
                }</p>
                <p><strong>Sessão:</strong> {whatsappStatus.sessionPath || 'N/A'}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}