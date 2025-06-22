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
import { Bot, Settings, CheckCircle, AlertCircle, Loader2, Save, Volume2, MessageSquare, QrCode, Smartphone, Send, RefreshCw, Trash2, Phone, Wifi, WifiOff, PhoneOff, X } from "lucide-react";
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

  // Evolution API endpoints
  const evolutionEndpoint = '/api/evolution/status';
  const whatsappEndpoint = '/api/whatsapp-client/status'; // Fallback para Baileys
  
  // Preferir Evolution API, fallback para Baileys
  const { data: evolutionStatus } = useQuery({
    queryKey: [evolutionEndpoint],
    queryFn: () => apiRequest(evolutionEndpoint),
    refetchInterval: 5000,
    staleTime: 4000,
    retry: 1
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
  
  // DEBUG: Log completo dos dados recebidos
  console.log('🔍 [QR DEBUG] Evolution Status completo:', evolutionStatus);
  console.log('🔍 [QR DEBUG] QR Code existe:', !!evolutionStatus?.qrCode);
  console.log('🔍 [QR DEBUG] QR Code length:', evolutionStatus?.qrCode?.length);
  
  // SEMPRE usar Evolution API 
  const activeWhatsappStatus = evolutionStatus;
  


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

      {/* WhatsApp Connection per Client */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            WhatsApp {user?.clientId && `(Cliente: ${user.clientId})`}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Conexão WhatsApp individual por cliente para envio de entrevistas
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Método de Conexão:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  activeWhatsappStatus?.method === 'evolution' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {activeWhatsappStatus?.method === 'evolution' ? 'Evolution API' : 'Baileys (Legacy)'}
                </span>
              </div>
              {activeWhatsappStatus?.instanceId && (
                <span className="text-xs text-muted-foreground">
                  ID: {activeWhatsappStatus.instanceId}
                </span>
              )}
            </div>

            {activeWhatsappStatus?.isConnected ? (
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-green-900 dark:text-green-100">WhatsApp Conectado</h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {activeWhatsappStatus.phoneNumber ? `Telefone: ${activeWhatsappStatus.phoneNumber}` : 'Conexão ativa'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      const disconnectUrl = activeWhatsappStatus?.method === 'evolution' ? '/api/evolution/disconnect' : '/api/whatsapp-client/disconnect';
                      fetch(disconnectUrl, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                          'Content-Type': 'application/json'
                        }
                      }).then(() => {
                        queryClient.invalidateQueries({ queryKey: [evolutionEndpoint] });
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
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">WhatsApp Desconectado</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Conecte seu WhatsApp para enviar entrevistas
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={async () => {
                        try {
                          console.log('🔗 Tentando conectar via Evolution API...');
                          
                          const response = await fetch('/api/evolution/connect', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                              'Content-Type': 'application/json'
                            }
                          });
                          
                          const data = await response.json();
                          console.log('🔗 Evolution Connect Response:', data);
                          
                          if (data.success) {
                            // Atualizar queries imediatamente
                            queryClient.invalidateQueries({ queryKey: [evolutionEndpoint] });
                            queryClient.invalidateQueries({ queryKey: [whatsappEndpoint] });
                            
                            // Refetch com delay menor para garantir atualização
                            setTimeout(() => {
                              queryClient.refetchQueries({ queryKey: [evolutionEndpoint] });
                              queryClient.refetchQueries({ queryKey: [whatsappEndpoint] });
                              
                              // Forçar re-render do QR Code
                              setQrCodeKey(prev => prev + 1);
                            }, 500);
                            
                            toast({ 
                              title: "QR Code gerado com sucesso!",
                              description: data.message 
                            });
                          } else {
                            toast({ 
                              title: "Erro na conexão", 
                              description: data.message,
                              variant: "destructive" 
                            });
                          }
                        } catch (error) {
                          console.error('WhatsApp Connect Error:', error);
                          toast({ 
                            title: "Erro na requisição", 
                            description: "Verifique a conexão",
                            variant: "destructive" 
                          });
                        }
                      }}
                      variant="default"
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      Gerar QR Code
                    </Button>

                    {activeWhatsappStatus?.qrCode && (
                      <Button
                        onClick={async () => {
                          console.log('🔄 [DEBUG] Iniciando atualização de QR Code...');
                          console.log('🔄 [DEBUG] ActiveWhatsappStatus atual:', activeWhatsappStatus);
                          
                          try {
                            // Mostrar feedback imediato
                            toast({
                              title: "Atualizando QR Code...",
                              description: "Desconectando sessão atual..."
                            });
                            
                            console.log('🔄 [DEBUG] Enviando disconnect...');
                            
                            // Desconectar primeiro
                            const disconnectResponse = await fetch('/api/evolution/disconnect', {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                                'Content-Type': 'application/json'
                              }
                            });
                            
                            const disconnectData = await disconnectResponse.json();
                            console.log('🔄 [DEBUG] Disconnect response:', disconnectData);
                            
                            // Limpar cache imediatamente após disconnect
                            console.log('🔄 [DEBUG] Invalidando queries após disconnect...');
                            queryClient.invalidateQueries({ queryKey: [evolutionEndpoint] });
                            queryClient.invalidateQueries({ queryKey: [whatsappEndpoint] });
                            
                            // Aguardar um pouco e reconectar
                            console.log('🔄 [DEBUG] Aguardando 2 segundos antes de reconectar...');
                            setTimeout(async () => {
                              try {
                                console.log('🔄 [DEBUG] Enviando connect...');
                                
                                const connectResponse = await fetch('/api/evolution/connect', {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                                    'Content-Type': 'application/json'
                                  }
                                });
                                
                                const connectData = await connectResponse.json();
                                console.log('🔄 [DEBUG] Connect response:', connectData);
                                
                                if (connectData.success) {
                                  console.log('🔄 [DEBUG] Novo QR Code recebido, invalidando cache...');
                                  
                                  // Invalidar e forçar refetch
                                  queryClient.invalidateQueries({ queryKey: [evolutionEndpoint] });
                                  queryClient.invalidateQueries({ queryKey: [whatsappEndpoint] });
                                  
                                  // Forçar atualização imediata
                                  setTimeout(() => {
                                    console.log('🔄 [DEBUG] Forçando refetch das queries...');
                                    queryClient.refetchQueries({ queryKey: [evolutionEndpoint] });
                                    queryClient.refetchQueries({ queryKey: [whatsappEndpoint] });
                                    
                                    // Forçar re-render do QR Code
                                    setQrCodeKey(prev => prev + 1);
                                  }, 200);
                                  
                                  toast({
                                    title: "QR Code atualizado!",
                                    description: "Novo QR Code gerado com sucesso"
                                  });
                                } else {
                                  console.error('🔄 [DEBUG] Falha na reconexão:', connectData);
                                  toast({
                                    title: "Erro na reconexão",
                                    description: connectData.message || "Falha ao gerar novo QR Code",
                                    variant: "destructive"
                                  });
                                }
                              } catch (connectError) {
                                console.error('🔄 [DEBUG] Erro no connect:', connectError);
                                toast({
                                  title: "Erro na reconexão",
                                  description: "Falha ao conectar novamente",
                                  variant: "destructive"
                                });
                              }
                            }, 2000);
                            
                          } catch (error) {
                            console.error('🔄 [DEBUG] Erro geral na atualização:', error);
                            toast({
                              title: "Erro ao atualizar",
                              description: "Falha na comunicação com o servidor",
                              variant: "destructive"
                            });
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="border-blue-600 text-blue-600 hover:bg-blue-50"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Atualizar QR
                      </Button>
                    )}
                  </div>
                </div>

                {/* QR Code Display - DEBUG + FORÇAR EXIBIÇÃO */}
                {(() => {
                  console.log('🔍 [QR DEBUG] Verificando condição render:', {
                    evolutionStatusExists: !!evolutionStatus,
                    qrCodeExists: !!evolutionStatus?.qrCode,
                    qrCodeValue: evolutionStatus?.qrCode?.substring(0, 100)
                  });
                  return evolutionStatus?.qrCode;
                })() && (
                  <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-center space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300 flex-1">
                          <QrCode className="h-5 w-5" />
                          <span className="font-medium">Escaneie o QR Code com seu WhatsApp (Evolution API)</span>
                        </div>
                        
                        <Button
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/evolution/disconnect', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                                  'Content-Type': 'application/json'
                                }
                              });
                              
                              const data = await response.json();
                              
                              queryClient.invalidateQueries({ queryKey: [evolutionEndpoint] });
                              queryClient.invalidateQueries({ queryKey: [whatsappEndpoint] });
                              
                              toast({
                                title: "Desconectado",
                                description: "WhatsApp desconectado com sucesso"
                              });
                            } catch (error) {
                              toast({
                                title: "Erro ao desconectar",
                                description: "Tente novamente",
                                variant: "destructive"
                              });
                            }
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex justify-center">
                        <QRCodeRenderer key={`qr-${qrCodeKey}-${evolutionStatus?.qrCode?.length || 0}`} qrCode={evolutionStatus?.qrCode || ''} />
                      </div>
                      
                      <div className="text-sm text-blue-600 dark:text-blue-400">
                        <p>1. Abra o WhatsApp no seu celular</p>
                        <p>2. Toque em Menu ou Configurações e selecione "Dispositivos conectados"</p>
                        <p>3. Toque em "Conectar um dispositivo"</p>
                        <p>4. Aponte seu telefone para esta tela para capturar o código</p>
                        <p className="text-xs text-orange-600 mt-2">Se o QR Code não funcionar, clique em "Atualizar QR" para gerar um novo</p>
                      </div>
                    </div>
                  </div>
                )}
                

              </div>
            )}

            {/* Teste de Envio WhatsApp */}
            {activeWhatsappStatus?.isConnected && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border">
                <h4 className="font-medium flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Teste de Envio
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="testPhone">Número de Teste</Label>
                    <Input
                      id="testPhone"
                      placeholder="11987654321 ou 5511987654321"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="testMessage">Mensagem de Teste</Label>
                    <Input
                      id="testMessage"
                      placeholder="Mensagem de teste..."
                      value={whatsappMessage}
                      onChange={(e) => setWhatsappMessage(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                
                <Button
                  onClick={async () => {
                    if (!whatsappPhone.trim() || !whatsappMessage.trim()) {
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha o número e a mensagem de teste",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    try {
                      // Usar Evolution API se disponível, senão Baileys
                      const testUrl = activeWhatsappStatus?.method === 'evolution' ? '/api/evolution/test' : '/api/whatsapp-client/test';
                      
                      const response = await fetch(testUrl, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          phoneNumber: whatsappPhone,
                          message: whatsappMessage
                        })
                      });
                      
                      const data = await response.json();
                      
                      if (data.success) {
                        toast({ 
                          title: "Sucesso!", 
                          description: "Mensagem de teste enviada com sucesso!" 
                        });
                        // Limpar campos após envio bem-sucedido
                        setWhatsappPhone('');
                        setWhatsappMessage('');
                      } else {
                        toast({ 
                          title: "Erro ao enviar", 
                          description: data.message || "Falha ao enviar mensagem de teste",
                          variant: "destructive" 
                        });
                      }
                    } catch (error) {
                      console.error('Erro ao enviar mensagem teste:', error);
                      toast({ 
                        title: "Erro de conexão", 
                        description: "Falha na comunicação com o servidor",
                        variant: "destructive" 
                      });
                    }
                  }}
                  className="w-full md:w-auto"
                  disabled={!whatsappPhone.trim() || !whatsappMessage.trim()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Teste
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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