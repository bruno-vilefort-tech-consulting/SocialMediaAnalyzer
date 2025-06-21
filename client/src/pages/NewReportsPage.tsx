import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { FileText, ArrowLeft, Users, BarChart3, Star, CheckCircle, XCircle, Clock, Play, Pause, Volume2, ChevronDown, ChevronUp, ThumbsUp, Meh, AlertTriangle, ThumbsDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';

interface Selection {
  id: number;
  name: string;
  status: string;
  createdAt: any;
  jobName?: string;
  clientId: number;
}

interface InterviewCandidate {
  candidate: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  interview: {
    id: string;
    status: string;
    createdAt: any;
    completedAt?: any;
    totalScore: number;
  };
  responses: InterviewResponse[];
  calculatedScore: number;
}

interface InterviewResponse {
  id: string;
  questionId: number;
  questionText: string;
  transcription: string;
  audioUrl?: string;
  score?: number;
  recordingDuration?: number;
  aiAnalysis?: any;
}

// Constantes de categorização de candidatos
const CANDIDATE_CATEGORIES = ['Melhor', 'Mediano', 'Em dúvida', 'Não'] as const;

export default function NewReportsPage() {
  const { user } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedSelection, setSelectedSelection] = useState<Selection | null>(null);
  const [activeTab, setActiveTab] = useState('analise');
  const [expandedCandidate, setExpandedCandidate] = useState<number | null>(null);
  const [candidateCategories, setCandidateCategories] = useState<{ [key: string]: string }>({});
  const [audioStates, setAudioStates] = useState<{ [key: string]: { 
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    progress: number;
  } }>({});

  // Buscar clientes (apenas para masters)
  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients'],
    enabled: user?.role === 'master'
  });

  // Buscar seleções
  const { data: selectionsData = [], isLoading: loadingSelections } = useQuery({
    queryKey: ['/api/selections', selectedClientId],
    enabled: !!selectedClientId || user?.role === 'client'
  });

  // Ordenar seleções da mais nova para a mais velha
  const selections = [...selectionsData].sort((a, b) => {
    const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt);
    const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt);
    return dateB.getTime() - dateA.getTime(); // Mais nova primeiro
  });

  // Buscar candidatos da seleção com status de entrevista
  const { data: interviewCandidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['selection-interview-candidates', selectedSelection?.id],
    queryFn: async () => {
      if (!selectedSelection) return [];
      
      try {
        const res = await apiRequest(`/api/selections/${selectedSelection.id}/interview-candidates`, 'GET');
        const response = await res.json();
        
        // Garantir que sempre retornamos um array
        if (Array.isArray(response)) {
          return response;
        } else {
          return [];
        }
      } catch (error) {
        console.error('Error fetching interview candidates:', error);
        return [];
      }
    },
    enabled: !!selectedSelection
  });

  // Definir cliente padrão para usuários cliente
  React.useEffect(() => {
    if (user?.role === 'client' && user.clientId) {
      setSelectedClientId(user.clientId.toString());
    }
  }, [user]);

  // Query para buscar categorias dos candidatos quando uma seleção é escolhida
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/candidate-categories', selectedSelection?.id],
    queryFn: async () => {
      if (!selectedSelection) return [];
      const response = await apiRequest(`/api/candidate-categories?selectionId=${selectedSelection.id}`, 'GET');
      return response || [];
    },
    enabled: !!selectedSelection
  });

  // Função para obter categoria do candidato diretamente dos dados carregados
  const getCandidateCategory = (candidateId: number): string | undefined => {
    if (!selectedSelection) return undefined;
    
    // Verificar primeiro no estado local (para resposta imediata após clique)
    const localKey = `selection_${selectedSelection.id}_${candidateId}`;
    const localCategory = candidateCategories[localKey];
    
    // Verificar nos dados carregados do Firebase (se disponível e é array)
    if (Array.isArray(categories) && categories.length > 0) {
      const categoryData = categories.find((cat: any) => 
        cat.candidateId === candidateId.toString() && 
        cat.reportId === `selection_${selectedSelection.id}`
      );
      return categoryData?.category || localCategory;
    }
    
    return localCategory;
  };

  // Mutation para salvar categoria do candidato
  const setCategoryMutation = useMutation({
    mutationFn: async ({ reportId, candidateId, category }: { reportId: string; candidateId: string; category: string }) => {
      return apiRequest('/api/candidate-categories', 'POST', { 
        reportId, 
        candidateId, 
        category, 
        clientId: user?.clientId 
      });
    },
    onSuccess: (data, variables) => {
      // Atualizar estado local imediatamente para resposta visual rápida
      const key = `${variables.reportId}_${variables.candidateId}`;
      setCandidateCategories(prev => ({
        ...prev,
        [key]: variables.category
      }));
      
      // Invalidar consulta para recarregar dados do banco
      queryClient.invalidateQueries({
        queryKey: ['/api/candidate-categories', selectedSelection?.id]
      });
    },
    onError: (error) => {
      console.error('❌ Erro ao salvar categoria:', error);
    }
  });

  // Função para definir categoria do candidato
  const setCategory = (candidateId: number, category: string) => {
    const reportId = `selection_${selectedSelection?.id}`;
    
    setCategoryMutation.mutate({ 
      reportId, 
      candidateId: candidateId.toString(), 
      category 
    });
  };

  // Ordenar candidatos alfabeticamente
  const sortedCandidates = [...(interviewCandidates || [])].sort((a, b) => 
    a.candidate.name.localeCompare(b.candidate.name)
  );

  // Se nenhuma seleção foi escolhida, mostrar lista de seleções
  if (!selectedSelection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        </div>

        {user?.role === 'master' && (
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente para visualizar relatórios" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.nomeEmpresa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {selectedClientId && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Seleções Disponíveis</h2>
            
            {loadingSelections ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : selections.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma seleção encontrada</h3>
                  <p className="text-muted-foreground text-center">
                    Não há seleções disponíveis para análise.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {selections.map((selection: Selection) => (
                  <Card 
                    key={selection.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-300"
                    onClick={() => setSelectedSelection(selection)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{selection.name}</h3>
                            <Badge variant={selection.status === 'enviado' ? 'default' : 'secondary'}>
                              {selection.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Vaga: {selection.jobName || 'Não identificada'}
                          </p>
                        </div>
                        
                        <Button variant="outline">
                          Ver Relatório
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Mostrar relatório da seleção com abas
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button 
          variant="outline" 
          onClick={() => setSelectedSelection(null)}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{selectedSelection.name}</h1>
          <p className="text-muted-foreground">
            ID: {selectedSelection.id} • Vaga: {selectedSelection.jobName || 'Não identificada'}
          </p>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="analise" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Análise
          </TabsTrigger>
          <TabsTrigger value="selecionados" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Selecionados
          </TabsTrigger>
        </TabsList>



        <TabsContent value="analise" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise dos Resultados</CardTitle>
              <p className="text-sm text-muted-foreground">
                Candidatos ordenados por pontuação (maior para menor)
              </p>
            </CardHeader>
            <CardContent>
              {loadingCandidates ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Carregando análise...</p>
                </div>
              ) : interviewCandidates.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum candidato encontrado</h3>
                  <p className="text-muted-foreground">
                    Ainda não há candidatos que receberam convites para esta seleção.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Cabeçalho da tabela */}
                  <div className="grid grid-cols-5 gap-4 p-3 bg-gray-50 rounded-lg font-medium text-sm text-muted-foreground">
                    <div>Nome do Candidato</div>
                    <div>Status da Entrevista</div>
                    <div>Respostas Completas</div>
                    <div className="text-center">Avaliação</div>
                    <div className="text-center">Pontuação Final</div>
                  </div>
                  
                  {/* Lista de candidatos ordenada por pontuação */}
                  {interviewCandidates
                    .map(candidate => {
                      // Calcular pontuação média baseada nas respostas
                      const responsesWithScore = candidate.responses.filter(r => r.score !== null && r.score !== undefined);
                      const averageScore = responsesWithScore.length > 0 
                        ? responsesWithScore.reduce((sum, r) => sum + (r.score || 0), 0) / responsesWithScore.length
                        : 0;
                      
                      return {
                        ...candidate,
                        calculatedScore: averageScore
                      };
                    })
                    .sort((a, b) => b.calculatedScore - a.calculatedScore) // Ordenar do maior para menor
                    .map((candidate) => {
                      const totalQuestions = candidate.responses.length;
                      const completedResponses = candidate.responses.filter(r => 
                        r.transcription && r.transcription !== 'Aguardando resposta via WhatsApp'
                      ).length;
                      const isCompleted = totalQuestions > 0 && completedResponses === totalQuestions;
                      
                      return (
                        <Card key={candidate.candidate.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-0">
                            <div 
                              className="grid grid-cols-5 gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => setExpandedCandidate(expandedCandidate === candidate.candidate.id ? null : candidate.candidate.id)}
                            >
                              {/* Coluna 1: Nome do Candidato */}
                              <div className="col-span-1">
                                <p className="font-medium">{candidate.candidate.name}</p>
                                <p className="text-sm text-muted-foreground">{candidate.candidate.email}</p>
                              </div>
                              
                              {/* Coluna 2: Status da Entrevista */}
                              <div className="col-span-1 flex items-center gap-2">
                                {isCompleted ? (
                                  <Badge variant="default" className="bg-green-100 text-green-800">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Finalizada
                                  </Badge>
                                ) : completedResponses > 0 ? (
                                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Em andamento
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-red-50 text-red-700">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Não iniciada
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Coluna 3: Respostas Completas */}
                              <div className="col-span-1 flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {completedResponses}/{totalQuestions}
                                </span>
                                {totalQuestions > 0 && (
                                  <Progress 
                                    value={(completedResponses / totalQuestions) * 100} 
                                    className="w-16 h-2"
                                  />
                                )}
                              </div>
                              
                              {/* Coluna 4: Avaliação (4 Botões de Categorização) */}
                              <div className="col-span-1">
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="sm"
                                    variant={getCandidateCategory(candidate.candidate.id) === 'Melhor' ? 'default' : 'outline'}
                                    className={`h-7 px-1.5 ${getCandidateCategory(candidate.candidate.id) === 'Melhor' ? 'bg-green-600 hover:bg-green-700 text-white' : 'hover:bg-green-50'}`}
                                    onClick={() => setCategory(candidate.candidate.id, 'Melhor')}
                                    disabled={setCategoryMutation.isPending}
                                    title="Melhor"
                                  >
                                    <ThumbsUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={getCandidateCategory(candidate.candidate.id) === 'Mediano' ? 'default' : 'outline'}
                                    className={`h-7 px-1.5 ${getCandidateCategory(candidate.candidate.id) === 'Mediano' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'hover:bg-yellow-50'}`}
                                    onClick={() => setCategory(candidate.candidate.id, 'Mediano')}
                                    disabled={setCategoryMutation.isPending}
                                    title="Mediano"
                                  >
                                    <Meh className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={getCandidateCategory(candidate.candidate.id) === 'Em dúvida' ? 'default' : 'outline'}
                                    className={`h-7 px-1.5 ${getCandidateCategory(candidate.candidate.id) === 'Em dúvida' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'hover:bg-orange-50'}`}
                                    onClick={() => setCategory(candidate.candidate.id, 'Em dúvida')}
                                    disabled={setCategoryMutation.isPending}
                                    title="Em dúvida"
                                  >
                                    <AlertTriangle className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={getCandidateCategory(candidate.candidate.id) === 'Não' ? 'default' : 'outline'}
                                    className={`h-7 px-1.5 ${getCandidateCategory(candidate.candidate.id) === 'Não' ? 'bg-red-600 hover:bg-red-700 text-white' : 'hover:bg-red-50'}`}
                                    onClick={() => setCategory(candidate.candidate.id, 'Não')}
                                    disabled={setCategoryMutation.isPending}
                                    title="Não"
                                  >
                                    <ThumbsDown className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              {/* Coluna 5: Pontuação Final */}
                              <div className="col-span-1 text-center">
                                <div>
                                  {candidate.calculatedScore > 0 ? (
                                    <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${
                                      candidate.calculatedScore >= 80 ? 'bg-green-100 text-green-800' :
                                      candidate.calculatedScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                      candidate.calculatedScore >= 40 ? 'bg-orange-100 text-orange-800' :
                                      'bg-red-100 text-red-800'
                                    }`}>
                                      {candidate.calculatedScore.toFixed(1)}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">
                                      Sem pontuação
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Detalhes expandidos inline */}
                            {expandedCandidate === candidate.candidate.id && (
                              <div className="border-t bg-gray-50 p-6">
                                <CandidateDetailsInline candidate={candidate} audioStates={audioStates} setAudioStates={setAudioStates} />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="selecionados" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Candidatos Selecionados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Sistema de selecionados será implementado conforme suas especificações.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Componente de Detalhes Inline do Candidato
interface CandidateDetailsInlineProps {
  candidate: InterviewCandidate;
  audioStates: { [key: string]: { 
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    progress: number;
  } };
  setAudioStates: React.Dispatch<React.SetStateAction<{ [key: string]: { 
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    progress: number;
  } }>>;
}

function CandidateDetailsInline({ candidate, audioStates, setAudioStates }: CandidateDetailsInlineProps) {
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // Atualizar estado do áudio
  const updateAudioState = (responseId: string, updates: Partial<typeof audioStates[string]>) => {
    setAudioStates(prev => ({
      ...prev,
      [responseId]: { ...prev[responseId], ...updates }
    }));
  };

  // Controlar reprodução do áudio
  const toggleAudio = (audioUrl: string, responseId: string) => {
    try {
      console.log(`🎵 [AUDIO_DEBUG] Tentando reproduzir: ${audioUrl}`);
      const currentState = audioStates[responseId];
      
      // Parar todos os outros áudios
      Object.keys(audioRefs.current).forEach(id => {
        if (id !== responseId && audioRefs.current[id]) {
          audioRefs.current[id].pause();
          updateAudioState(id, { isPlaying: false });
        }
      });

      // Criar novo player se não existir
      if (!audioRefs.current[responseId]) {
        console.log(`🎵 [AUDIO_DEBUG] Criando novo player para: ${responseId}`);
        const audio = new Audio();
        
        // Configurações importantes para compatibilidade
        audio.crossOrigin = 'anonymous';
        audio.preload = 'auto';
        
        // Tentar múltiplos formatos se necessário
        audio.volume = 1.0;
        
        audioRefs.current[responseId] = audio;

        audio.addEventListener('loadstart', () => {
          console.log(`🎵 [AUDIO_DEBUG] Iniciando carregamento: ${audioUrl}`);
        });

        audio.addEventListener('loadedmetadata', () => {
          console.log(`🎵 [AUDIO_DEBUG] Metadata carregada - Duration: ${audio.duration}s`);
          updateAudioState(responseId, { 
            duration: audio.duration,
            currentTime: 0,
            progress: 0,
            isPlaying: false 
          });
        });

        audio.addEventListener('canplay', () => {
          console.log(`🎵 [AUDIO_DEBUG] Áudio pronto para reprodução`);
        });

        audio.addEventListener('timeupdate', () => {
          const progress = (audio.currentTime / audio.duration) * 100;
          updateAudioState(responseId, { 
            currentTime: audio.currentTime,
            progress: progress 
          });
        });

        audio.addEventListener('ended', () => {
          console.log(`🎵 [AUDIO_DEBUG] Reprodução finalizada`);
          updateAudioState(responseId, { 
            isPlaying: false,
            currentTime: 0,
            progress: 0 
          });
        });

        audio.addEventListener('error', (e) => {
          console.error('🎵 [AUDIO_ERROR] Erro ao carregar áudio:', e);
          console.error('🎵 [AUDIO_ERROR] URL:', audioUrl);
          console.error('🎵 [AUDIO_ERROR] Error code:', audio.error?.code);
          console.error('🎵 [AUDIO_ERROR] Error message:', audio.error?.message);
          console.error('🎵 [AUDIO_ERROR] Network state:', audio.networkState);
          console.error('🎵 [AUDIO_ERROR] Ready state:', audio.readyState);
          
          // Tentar URL alternativa ou conversão
          if (audioUrl.includes('.ogg')) {
            console.log('🎵 [AUDIO_ERROR] Tentando URL direta...');
            const directUrl = audioUrl.replace('/uploads/', '/uploads/');
            audio.src = directUrl;
          }
          
          updateAudioState(responseId, { isPlaying: false });
        });

        // Definir URL após configurar eventos
        audio.src = audioUrl;
      }

      const audio = audioRefs.current[responseId];
      
      if (currentState?.isPlaying) {
        console.log(`🎵 [AUDIO_DEBUG] Pausando áudio`);
        audio.pause();
        updateAudioState(responseId, { isPlaying: false });
      } else {
        console.log(`🎵 [AUDIO_DEBUG] Iniciando reprodução`);
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(`🎵 [AUDIO_DEBUG] Reprodução iniciada com sucesso`);
              updateAudioState(responseId, { isPlaying: true });
            })
            .catch(error => {
              console.error('🎵 [AUDIO_ERROR] Erro ao iniciar reprodução:', error);
              updateAudioState(responseId, { isPlaying: false });
            });
        } else {
          updateAudioState(responseId, { isPlaying: true });
        }
      }
    } catch (error) {
      console.error('🎵 [AUDIO_ERROR] Erro geral ao reproduzir áudio:', error);
      updateAudioState(responseId, { isPlaying: false });
    }
  };

  // Controlar posição da timeline
  const seekAudio = (responseId: string, percentage: number) => {
    const audio = audioRefs.current[responseId];
    if (audio && audio.duration) {
      const newTime = (percentage / 100) * audio.duration;
      audio.currentTime = newTime;
      updateAudioState(responseId, { 
        currentTime: newTime,
        progress: percentage 
      });
    }
  };

  // Formatar tempo
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Informações do Candidato */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-white rounded-lg border">
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground">Nome</h4>
          <p className="font-medium">{candidate.candidate.name}</p>
        </div>
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground">Email</h4>
          <p className="text-sm">{candidate.candidate.email}</p>
        </div>
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground">Telefone</h4>
          <p className="text-sm">{candidate.candidate.phone}</p>
        </div>
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground">Status</h4>
          <Badge variant={candidate.interview.status === 'completed' ? 'default' : 'secondary'}>
            {candidate.interview.status}
          </Badge>
        </div>
      </div>

      {/* Respostas da Entrevista */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Respostas da Entrevista</h3>
        
        {candidate.responses.map((response, index) => {
          const responseId = response.id.toString();
          const audioState = audioStates[responseId] || { 
            isPlaying: false, 
            currentTime: 0, 
            duration: 0, 
            progress: 0 
          };

          return (
            <Card key={response.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Pergunta com Pontuação no topo direito */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">
                        Pergunta {index + 1}
                      </h4>
                      <p className="font-medium">{response.questionText}</p>
                    </div>
                    {/* Pontuação 0-100 no topo direito */}
                    {response.score !== null && response.score !== undefined && (
                      <div className="ml-4 flex-shrink-0">
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                          response.score >= 80 ? 'bg-green-100 text-green-800' :
                          response.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          response.score >= 40 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {response.score}/100
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Transcrição */}
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">
                      Transcrição
                    </h4>
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-sm leading-relaxed">
                        {response.transcription && response.transcription !== 'Aguardando resposta via WhatsApp' 
                          ? response.transcription 
                          : 'Aguardando resposta via WhatsApp'}
                      </p>
                    </div>
                  </div>

                  {/* Player de Áudio com Timeline */}
                  {response.audioUrl && response.audioUrl !== "" ? (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground">
                        Áudio da Resposta
                      </h4>
                      
                      {/* Controles do Player */}
                      <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                        <div className="flex items-center gap-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAudio(response.audioUrl!, responseId)}
                            className="flex items-center gap-2"
                          >
                            {audioState.isPlaying ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                            {audioState.isPlaying ? 'Pausar' : 'Reproduzir'}
                          </Button>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Volume2 className="h-4 w-4" />
                            <span>{formatTime(audioState.currentTime)} / {formatTime(audioState.duration)}</span>
                          </div>
                          
                          {response.score && (
                            <div className="ml-auto">
                              <Badge variant="outline">
                                Score: {response.score}/100
                              </Badge>
                            </div>
                          )}
                        </div>
                        
                        {/* Timeline */}
                        <div className="space-y-2">
                          <div 
                            className="w-full h-2 bg-gray-200 rounded-full cursor-pointer relative"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const percentage = ((e.clientX - rect.left) / rect.width) * 100;
                              seekAudio(responseId, percentage);
                            }}
                          >
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all duration-100"
                              style={{ width: `${audioState.progress || 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-md">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-muted-foreground">
                        Aguardando resposta de áudio via WhatsApp
                      </span>
                    </div>
                  )}

                  
                </div>
              </CardContent>
            </Card>
          );
        })}

        {candidate.responses.length === 0 && (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma resposta encontrada</h3>
            <p className="text-muted-foreground">
              Este candidato ainda não respondeu às perguntas da entrevista.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}