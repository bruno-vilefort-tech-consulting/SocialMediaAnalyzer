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

// Componente simples para renderizar QR Code
const QRCodeRenderer = ({ qrCode }: { qrCode: string }) => {
  console.log('🔍 [QR DEBUG] QRCodeRenderer chamado:', {
    hasQrCode: !!qrCode,
    qrCodeLength: qrCode?.length,
    isDataUrl: qrCode?.startsWith('data:image/'),
    preview: qrCode?.substring(0, 50) + '...'
  });

  // Se o qrCode já é uma data URL, usar diretamente
  if (qrCode && qrCode.startsWith('data:image/')) {
    console.log('✅ Exibindo QR Code direto (data URL)');
    return (
      <div className="flex justify-center">
        <img 
          src={qrCode} 
          alt="QR Code WhatsApp" 
          className="w-64 h-64 border-2 border-gray-300 rounded-lg shadow-lg"
          onLoad={() => console.log('✅ [FRONTEND] QR Code image carregada com sucesso')}
          onError={(e) => console.error('❌ [FRONTEND] Erro ao carregar QR Code:', e)}
        />
      </div>
    );
  }

  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  
  useEffect(() => {
    if (qrCode && !qrCode.startsWith('data:image/')) {
      console.log('🔄 Gerando QR Code a partir de string...');
      // Apenas se não for uma data URL, gerar QR Code
      import('qrcode').then(QRCode => {
        QRCode.toDataURL(qrCode, { 
          width: 256, 
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
          .then(url => {
            console.log('✅ QR Code gerado com sucesso');
            setQrCodeImage(url);
          })
          .catch(err => console.error('❌ Erro ao gerar QR Code:', err));
      });
    }
  }, [qrCode]);

  if (!qrCodeImage && qrCode && !qrCode.startsWith('data:image/')) {
    return (
      <div className="w-64 h-64 bg-gray-100 flex items-center justify-center rounded-lg border-2 border-gray-300">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Gerando QR Code...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <img 
        src={qrCodeImage || qrCode} 
        alt="QR Code WhatsApp" 
        className="w-64 h-64 border-2 border-gray-300 rounded-lg shadow-lg"
      />
    </div>
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



  const { data: whatsappStatus, isLoading: whatsappLoading, refetch: refetchWhatsAppStatus } = useQuery<WhatsAppStatus>({
    queryKey: [whatsappEndpoint],
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 10000,
    enabled: false, // Desabilitar Baileys - usar apenas Evolution API
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

  // Estado local para forçar re-render do QR Code
  const [qrCodeKey, setQrCodeKey] = useState(0);
  
  // Evolution API Debug melhorado
  useEffect(() => {
    console.log('🔍 [QR DEBUG] Evolution Status completo:', evolutionStatus);
    console.log('🔍 [QR DEBUG] Tipo do evolutionStatus:', typeof evolutionStatus);
    console.log('🔍 [QR DEBUG] QR Code existe:', !!evolutionStatus?.qrCode);
    console.log('🔍 [QR DEBUG] QR Code length:', evolutionStatus?.qrCode?.length || null);
    
    if (evolutionStatus) {
      console.log('🔍 [QR DEBUG] Todas as propriedades do evolutionStatus:');
      Object.keys(evolutionStatus).forEach(key => {
        const value = evolutionStatus[key];
        console.log(`  - ${key}:`, typeof value, typeof value === 'string' ? value.substring(0, 50) + '...' : value);
      });
    }
  }, [evolutionStatus]);
  
  // FORÇAR EXIBIÇÃO DO QR CODE NO CONSOLE
  if (evolutionStatus?.qrCode) {
    console.log('📱 [QR CONSOLE] QR CODE COMPLETO:', evolutionStatus.qrCode);
    console.log('📱 [QR CONSOLE] QR CODE PREVIEW (primeiros 200 chars):', evolutionStatus.qrCode.substring(0, 200));
  } else {
    console.log('❌ [QR CONSOLE] QR Code não encontrado no evolutionStatus');
    console.log('🔍 [QR CONSOLE] Verificando se existe em outras propriedades...');
    console.log('🔍 [QR CONSOLE] evolutionStatus keys:', Object.keys(evolutionStatus || {}));
  }
  
  // SEMPRE usar Evolution API 
  const activeWhatsappStatus = evolutionStatus;
  
  // Só mostrar QR Code se usuário clicou para conectar OU já está conectado
  const shouldDisplayQR = shouldShowQR && (activeWhatsappStatus?.qrCode || activeWhatsappStatus?.isConnected);
  


  // Estados para configurações master
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o");
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Estado para configuração de voz (cliente)
  const [selectedVoice, setSelectedVoice] = useState<string>("nova");
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  
  // Estados para teste WhatsApp
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('Teste de conexão WhatsApp');

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

  const [showPhoneLogin, setShowPhoneLogin] = useState(false);


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

  // Phone login states (únicos)
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


    </div>
  );
}