import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { FileText, ArrowLeft, Users, BarChart3, Star, CheckCircle, XCircle, Clock, Play, Pause, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

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

export default function NewReportsPage() {
  const { user } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedSelection, setSelectedSelection] = useState<Selection | null>(null);
  const [activeTab, setActiveTab] = useState('candidatos');
  const [expandedCandidate, setExpandedCandidate] = useState<number | null>(null);
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="candidatos" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Candidatos
          </TabsTrigger>
          <TabsTrigger value="analise" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Análise
          </TabsTrigger>
          <TabsTrigger value="selecionados" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Selecionados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="candidatos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Candidatos da Seleção</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCandidates ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              ) : sortedCandidates.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum candidato encontrado</h3>
                  <p className="text-muted-foreground">Esta seleção não possui candidatos.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedCandidates.map((item: InterviewCandidate) => {
                    const candidate = item.candidate;
                    const interview = item.interview;
                    const responses = item.responses;
                    
                    // Verificar quantas perguntas foram respondidas
                    const answeredQuestions = responses.filter(r => 
                      r.transcription && r.transcription !== 'Aguardando resposta via WhatsApp'
                    ).length;
                    const totalQuestions = responses.length;
                    
                    // Status visual baseado nas respostas
                    const getStatusIcon = () => {
                      if (answeredQuestions === totalQuestions && totalQuestions > 0) {
                        return <CheckCircle className="h-5 w-5 text-green-500" />;
                      } else if (answeredQuestions > 0) {
                        return <Clock className="h-5 w-5 text-yellow-500" />;
                      } else {
                        return <XCircle className="h-5 w-5 text-red-500" />;
                      }
                    };
                    
                    const getStatusText = () => {
                      if (answeredQuestions === totalQuestions && totalQuestions > 0) {
                        return 'Completo';
                      } else if (answeredQuestions > 0) {
                        return 'Parcial';
                      } else {
                        return 'Pendente';
                      }
                    };
                    
                    const getStatusColor = () => {
                      if (answeredQuestions === totalQuestions && totalQuestions > 0) {
                        return 'bg-green-50 border-green-200';
                      } else if (answeredQuestions > 0) {
                        return 'bg-yellow-50 border-yellow-200';
                      } else {
                        return 'bg-red-50 border-red-200';
                      }
                    };
                    
                    return (
                      <Card key={candidate.id} className={`hover:shadow-md transition-shadow ${getStatusColor()}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div>
                                  <h4 className="font-medium">{candidate.name}</h4>
                                  <p className="text-sm text-muted-foreground">{candidate.email}</p>
                                  <p className="text-sm text-muted-foreground">{candidate.phone}</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <div className="flex items-center gap-1 mb-1">
                                  {getStatusIcon()}
                                  <span className="text-sm font-medium">{getStatusText()}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {answeredQuestions}/{totalQuestions} respostas
                                </p>
                              </div>
                              
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setExpandedCandidate(expandedCandidate === item.candidate.id ? null : item.candidate.id)}
                              >
                                {expandedCandidate === item.candidate.id ? (
                                  <>
                                    <ChevronUp className="h-4 w-4 mr-2" />
                                    Ocultar Detalhes
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4 mr-2" />
                                    Ver Detalhes
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                        
                        {/* Detalhes expandidos inline */}
                        {expandedCandidate === item.candidate.id && (
                          <div className="border-t bg-gray-50 p-6">
                            <CandidateDetailsInline candidate={item} audioStates={audioStates} setAudioStates={setAudioStates} />
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analise" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise dos Resultados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Análise será implementada conforme suas especificações.
                </p>
              </div>
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
        const audio = new Audio(audioUrl);
        audioRefs.current[responseId] = audio;

        audio.addEventListener('loadedmetadata', () => {
          updateAudioState(responseId, { 
            duration: audio.duration,
            currentTime: 0,
            progress: 0,
            isPlaying: false 
          });
        });

        audio.addEventListener('timeupdate', () => {
          const progress = (audio.currentTime / audio.duration) * 100;
          updateAudioState(responseId, { 
            currentTime: audio.currentTime,
            progress: progress 
          });
        });

        audio.addEventListener('ended', () => {
          updateAudioState(responseId, { 
            isPlaying: false,
            currentTime: 0,
            progress: 0 
          });
        });

        audio.addEventListener('error', (e) => {
          console.error('Erro ao carregar áudio:', e);
          updateAudioState(responseId, { isPlaying: false });
        });
      }

      const audio = audioRefs.current[responseId];
      
      if (currentState?.isPlaying) {
        audio.pause();
        updateAudioState(responseId, { isPlaying: false });
      } else {
        audio.play();
        updateAudioState(responseId, { isPlaying: true });
      }
    } catch (error) {
      console.error('Erro ao reproduzir áudio:', error);
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
                  {/* Pergunta */}
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">
                      Pergunta {index + 1}
                    </h4>
                    <p className="font-medium">{response.questionText}</p>
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
                                Score: {response.score}/10
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

                  {/* Análise IA (se disponível) */}
                  {response.aiAnalysis && response.aiAnalysis !== 'Análise IA pendente' && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">
                        Análise IA
                      </h4>
                      <div className="bg-green-50 p-3 rounded-md">
                        <p className="text-sm">{response.aiAnalysis}</p>
                      </div>
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