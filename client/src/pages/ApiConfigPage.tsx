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

// Componente simples para renderizar QR Code
const QRCodeRenderer = ({ qrCode }: { qrCode: string }) => {
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  
  useEffect(() => {
    if (qrCode) {
      // Usar biblioteca qrcode para gerar imagem
      import('qrcode').then(QRCode => {
        QRCode.toDataURL(qrCode, { width: 256, margin: 2 })
          .then(url => setQrCodeImage(url))
          .catch(err => console.error('Erro ao gerar QR Code:', err));
      });
    }
  }, [qrCode]);

  if (!qrCodeImage) {
    return (
      <div className="w-48 h-48 bg-gray-100 flex items-center justify-center rounded">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <img 
      src={qrCodeImage} 
      alt="QR Code WhatsApp" 
      className="w-48 h-48 mx-auto"
    />
  );
};

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
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 10000,
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(whatsappEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    }
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

  // Estados para novo painel WhatsApp com clientId
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("Olá! Esta é uma mensagem de teste do sistema de entrevistas.");
  
  // Phone login states
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [verifyCodeInput, setVerifyCodeInput] = useState('');

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

      {/* Novo Painel WhatsApp com ClientId */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            WhatsApp {user?.clientId && `(Cliente: ${user.clientId})`}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure sua conexão WhatsApp para envio automático de entrevistas
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
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
                  </div>
                </div>
                <Button
                  onClick={() => {
                    fetch('/api/client/whatsapp/disconnect', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                        'Content-Type': 'application/json'
                      }
                    }).then(() => {
                      queryClient.invalidateQueries({ queryKey: [whatsappEndpoint] });
                      toast({ title: "WhatsApp desconectado" });
                    });
                  }}
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <WifiOff className="h-4 w-4 mr-2" />
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
                        Escolha o método de conexão preferido
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setShowPhoneLogin(false);
                        fetch('/api/client/whatsapp/connect', {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                            'Content-Type': 'application/json'
                          }
                        }).then(() => {
                          queryClient.invalidateQueries({ queryKey: [whatsappEndpoint] });
                          toast({ title: "Conectando WhatsApp..." });
                        });
                      }}
                      variant="outline"
                      size="sm"
                      className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      QR Code
                    </Button>
                    

                  </div>
                </div>

                {/* QR Code Section - mostra quando QR disponível e não está em modo telefone */}
                {whatsappStatus?.qrCode && !showPhoneLogin && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center space-y-4 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                        <QrCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-center">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">QR Code Gerado</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                          Escaneie com seu WhatsApp para conectar
                        </p>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                        <QRCodeRenderer qrCode={whatsappStatus.qrCode} />
                      </div>
                      
                      <div className="text-center text-xs text-blue-600 dark:text-blue-400 max-w-sm">
                        <p className="mb-2 font-medium">Como conectar:</p>
                        <ol className="text-left space-y-1">
                          <li>1. Abra WhatsApp no celular</li>
                          <li>2. Toque em ⋮ → "Aparelhos conectados"</li>
                          <li>3. Toque em "Conectar um aparelho"</li>
                          <li>4. Escaneie este código</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Phone Number Login Section */}
            {showPhoneLogin && !whatsappStatus?.isConnected && (
              <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Conectar via Número de Telefone
                </h4>
                
                {!verificationCode ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="phoneNumber">Número do WhatsApp</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder="Ex: +5511987654321"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Formato: +55 (código do país) + DDD + número
                      </p>
                    </div>
                    
                    <Button 
                      onClick={() => {
                        if (!phoneNumber) {
                          toast({
                            title: "Erro",
                            description: "Digite um número de telefone",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        fetch('/api/client/whatsapp/request-code', {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ phoneNumber })
                        })
                        .then(res => res.json())
                        .then(data => {
                          if (data.success) {
                            setVerificationCode(data.code);
                            toast({
                              title: "Código Enviado",
                              description: `Código: ${data.code} (demo)`,
                            });
                          } else {
                            toast({
                              title: "Erro",
                              description: data.message,
                              variant: "destructive"
                            });
                          }
                        })
                        .catch(() => {
                          toast({
                            title: "Erro",
                            description: "Erro ao solicitar código",
                            variant: "destructive"
                          });
                        });
                      }}
                      disabled={!phoneNumber}
                      className="w-full"
                    >
                      Enviar Código SMS
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="verifyCode">Código de Verificação</Label>
                      <Input
                        id="verifyCode"
                        type="text"
                        placeholder="Ex: 12345678"
                        value={verifyCodeInput}
                        onChange={(e) => setVerifyCodeInput(e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Digite o código de 8 dígitos recebido: <strong>{verificationCode}</strong>
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                          if (!verifyCodeInput) {
                            toast({
                              title: "Erro",
                              description: "Digite o código de verificação",
                              variant: "destructive"
                            });
                            return;
                          }
                          
                          fetch('/api/client/whatsapp/verify-code', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ phoneNumber, code: verifyCodeInput })
                          })
                          .then(res => res.json())
                          .then(data => {
                            if (data.success) {
                              setShowPhoneLogin(false);
                              setVerificationCode(null);
                              setVerifyCodeInput('');
                              setPhoneNumber('');
                              queryClient.invalidateQueries({ queryKey: [whatsappEndpoint] });
                              toast({
                                title: "Conectado",
                                description: "WhatsApp conectado com sucesso!"
                              });
                            } else {
                              toast({
                                title: "Erro",
                                description: data.message,
                                variant: "destructive"
                              });
                            }
                          })
                          .catch(() => {
                            toast({
                              title: "Erro",
                              description: "Erro ao verificar código",
                              variant: "destructive"
                            });
                          });
                        }}
                        disabled={!verifyCodeInput}
                        className="flex-1"
                      >
                        Conectar
                      </Button>
                      
                      <Button 
                        onClick={() => {
                          setVerificationCode(null);
                          setVerifyCodeInput('');
                        }}
                        variant="outline"
                      >
                        Voltar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mostrar status conectado */}
            {whatsappStatus?.isConnected && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-green-900 dark:text-green-100">WhatsApp Conectado</h4>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {whatsappStatus.phone ? `Número: ${whatsappStatus.phone}` : 'Pronto para enviar mensagens'}
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => {
                      fetch('/api/client/whatsapp/disconnect', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                          'Content-Type': 'application/json'
                        }
                      }).then(() => {
                        queryClient.invalidateQueries({ queryKey: [whatsappEndpoint] });
                        toast({ title: "Desconectando WhatsApp..." });
                      });
                    }}
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Desconectar
                  </Button>
                </div>
              </div>
            )}

            {/* Teste de Envio WhatsApp (apenas quando conectado) */}
            {whatsappStatus?.isConnected && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border">
                <h4 className="font-medium flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Teste de Envio
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatsappPhone">Número de Teste</Label>
                    <Input
                      id="whatsappPhone"
                      placeholder="11987654321 ou 5511987654321"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="whatsappMessage">Mensagem de Teste</Label>
                    <Input
                      id="whatsappMessage"
                      placeholder="Mensagem de teste..."
                      value={whatsappMessage}
                      onChange={(e) => setWhatsappMessage(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                
                <Button
                  onClick={() => {
                    if (!whatsappPhone.trim() || !whatsappMessage.trim()) {
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha o número e a mensagem de teste",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    fetch('/api/client/whatsapp/test', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        phoneNumber: whatsappPhone,
                        message: whatsappMessage
                      })
                    })
                    .then(res => res.json())
                    .then(data => {
                      if (data.success) {
                        toast({ title: "Mensagem enviada com sucesso!" });
                      } else {
                        toast({ 
                          title: "Erro ao enviar", 
                          description: data.message,
                          variant: "destructive" 
                        });
                      }
                    })
                    .catch(() => {
                      toast({ 
                        title: "Erro ao enviar", 
                        variant: "destructive" 
                      });
                    });
                  }}
                  className="w-full md:w-auto"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Teste
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}