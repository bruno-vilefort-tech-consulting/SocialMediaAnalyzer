import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { FileText, Trash2, Calendar, Users, BarChart3, Star, Play, Pause, Volume2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Report {
  id: string;
  selectionId: string;
  selectionName: string;
  jobName: string;
  clientId: string;
  generatedAt: string;
  totalCandidates: number;
  completedInterviews: number;
  averageScore?: number;
  status: string;
  jobData: {
    title: string;
    description: string;
    questions: Array<{
      id: string;
      text: string;
      expectedAnswer: string;
      order: number;
    }>;
  };
  candidatesData: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    createdAt: string;
  }>;
  responseData: Array<{
    id: string;
    candidateId: string;
    questionId: string;
    questionText: string;
    transcription: string;
    audioUrl: string;
    score?: number;
    aiAnalysis?: string;
    timestamp: string;
    recordingDuration?: number;
  }>;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

interface Selection {
  id: string;
  name: string;
  clientId: string;
  status: string;
}

export default function IndependentReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
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

  // Buscar seleções para geração de relatórios
  const { data: selectionsData = [] } = useQuery({
    queryKey: ['/api/selections', selectedClientId],
    enabled: !!selectedClientId || user?.role === 'client'
  });

  // Buscar relatórios
  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['/api/reports', selectedClientId],
    enabled: !!selectedClientId || user?.role === 'client'
  });

  // Mutations
  const generateReportMutation = useMutation({
    mutationFn: (selectionId: string) => apiRequest(`/api/reports/generate/${selectionId}`, {
      method: 'POST'
    }),
    onSuccess: () => {
      toast({
        title: "Relatório gerado",
        description: "Relatório independente criado com sucesso"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao gerar relatório",
        variant: "destructive"
      });
    }
  });

  const deleteReportMutation = useMutation({
    mutationFn: (reportId: string) => apiRequest(`/api/reports/${reportId}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      toast({
        title: "Relatório deletado",
        description: "Relatório removido permanentemente"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar relatório",
        variant: "destructive"
      });
    }
  });

  // Controle de áudio
  const audioRefs = React.useRef<{ [key: string]: HTMLAudioElement }>({});

  const updateAudioState = (responseId: string, updates: Partial<typeof audioStates[string]>) => {
    setAudioStates(prev => ({
      ...prev,
      [responseId]: { ...prev[responseId], ...updates }
    }));
  };

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

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Organizar dados por candidato
  const organizeReportData = (report: Report) => {
    const candidatesWithResponses = report.candidatesData.map(candidate => {
      const candidateResponses = report.responseData.filter(r => 
        r.candidateId === candidate.id || 
        r.candidateId.includes(candidate.phone) ||
        r.candidateId.includes(candidate.id)
      );

      const totalScore = candidateResponses.reduce((sum, r) => sum + (r.score || 0), 0);
      const avgScore = candidateResponses.length > 0 ? totalScore / candidateResponses.length : 0;

      return {
        candidate,
        responses: candidateResponses,
        totalResponses: candidateResponses.length,
        averageScore: avgScore,
        status: candidateResponses.length >= report.jobData.questions.length ? 'completed' : 'partial'
      };
    });

    return candidatesWithResponses;
  };

  if (user?.role === 'master' && !selectedClientId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatórios Independentes</h1>
            <p className="text-muted-foreground">Gerencie relatórios permanentes de entrevistas</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecionar Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um cliente para ver seus relatórios" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client: Client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios Independentes</h1>
          <p className="text-muted-foreground">Relatórios permanentes preservados independentemente das seleções</p>
        </div>
        
        {user?.role === 'master' && (
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Trocar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client: Client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Seção de Geração de Relatórios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerar Novo Relatório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione uma seleção para gerar um relatório independente permanente
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectionsData.map((selection: Selection) => (
                <Card key={selection.id} className="border-dashed">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">{selection.name}</h4>
                      <Badge variant="outline">{selection.status}</Badge>
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => generateReportMutation.mutate(selection.id)}
                        disabled={generateReportMutation.isPending}
                      >
                        {generateReportMutation.isPending ? 'Gerando...' : 'Gerar Relatório'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Relatórios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Relatórios Gerados ({reports.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingReports ? (
            <div className="text-center py-8">Carregando relatórios...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum relatório encontrado</h3>
              <p className="text-muted-foreground">Gere seu primeiro relatório independente acima</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report: Report) => {
                const organizedData = organizeReportData(report);
                
                return (
                  <Card key={report.id} className="overflow-hidden">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {/* Cabeçalho do Relatório */}
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h3 className="text-xl font-semibold">{report.selectionName}</h3>
                            <p className="text-sm text-muted-foreground">{report.jobName}</p>
                            <p className="text-xs text-muted-foreground">
                              Gerado em {formatDate(report.generatedAt)}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                            >
                              {expandedReport === report.id ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-2" />
                                  Ocultar
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-2" />
                                  Ver Detalhes
                                </>
                              )}
                            </Button>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Deletar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja deletar permanentemente o relatório "{report.selectionName}"?
                                    Esta ação não pode ser desfeita e não afetará os dados originais da seleção.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteReportMutation.mutate(report.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Deletar Relatório
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        {/* Estatísticas Resumidas */}
                        <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                          <div className="text-center">
                            <div className="text-2xl font-bold">{report.totalCandidates}</div>
                            <div className="text-sm text-muted-foreground">Candidatos</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">{report.completedInterviews}</div>
                            <div className="text-sm text-muted-foreground">Entrevistas</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">
                              {report.averageScore ? report.averageScore.toFixed(1) : 'N/A'}
                            </div>
                            <div className="text-sm text-muted-foreground">Score Médio</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">{report.jobData.questions.length}</div>
                            <div className="text-sm text-muted-foreground">Perguntas</div>
                          </div>
                        </div>

                        {/* Detalhes Expandidos */}
                        {expandedReport === report.id && (
                          <div className="border-t pt-6 space-y-6">
                            {/* Informações do Job */}
                            <div>
                              <h4 className="text-lg font-semibold mb-3">Informações da Vaga</h4>
                              <Card>
                                <CardContent className="p-4">
                                  <h5 className="font-medium mb-2">{report.jobData.title}</h5>
                                  <p className="text-sm text-muted-foreground mb-4">{report.jobData.description}</p>
                                  
                                  <div className="space-y-2">
                                    <h6 className="font-medium">Perguntas da Entrevista:</h6>
                                    {report.jobData.questions.map((question, index) => (
                                      <div key={question.id} className="p-3 bg-muted/50 rounded-md">
                                        <p className="text-sm"><strong>Pergunta {index + 1}:</strong> {question.text}</p>
                                        {question.expectedAnswer && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            <strong>Resposta esperada:</strong> {question.expectedAnswer}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Candidatos e Respostas */}
                            <div>
                              <h4 className="text-lg font-semibold mb-3">Candidatos e Respostas</h4>
                              <div className="space-y-4">
                                {organizedData.map((item) => (
                                  <Card key={item.candidate.id}>
                                    <CardContent className="p-4">
                                      <div className="space-y-4">
                                        {/* Info do Candidato */}
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <h5 className="font-semibold">{item.candidate.name}</h5>
                                            <p className="text-sm text-muted-foreground">{item.candidate.email}</p>
                                            <p className="text-sm text-muted-foreground">{item.candidate.phone}</p>
                                          </div>
                                          <div className="text-right">
                                            <Badge variant={item.status === 'completed' ? 'default' : 'secondary'}>
                                              {item.totalResponses}/{report.jobData.questions.length} respostas
                                            </Badge>
                                            {item.averageScore > 0 && (
                                              <p className="text-sm mt-1">Score: {item.averageScore.toFixed(1)}</p>
                                            )}
                                          </div>
                                        </div>

                                        {/* Respostas */}
                                        {item.responses.length > 0 && (
                                          <div className="space-y-3">
                                            <h6 className="font-medium">Respostas:</h6>
                                            {item.responses.map((response, index) => {
                                              const responseId = `${report.id}_${response.id}`;
                                              const audioState = audioStates[responseId] || { 
                                                isPlaying: false, 
                                                currentTime: 0, 
                                                duration: 0, 
                                                progress: 0 
                                              };

                                              return (
                                                <Card key={response.id} className="bg-muted/25">
                                                  <CardContent className="p-3">
                                                    <div className="space-y-3">
                                                      <div>
                                                        <p className="text-sm font-medium">Pergunta {index + 1}</p>
                                                        <p className="text-sm">{response.questionText}</p>
                                                      </div>

                                                      <div>
                                                        <p className="text-sm font-medium mb-1">Transcrição</p>
                                                        <p className="text-sm text-muted-foreground">{response.transcription}</p>
                                                      </div>

                                                      {response.audioUrl && (
                                                        <div className="space-y-2">
                                                          <p className="text-sm font-medium">Áudio</p>
                                                          <div className="bg-blue-50 p-3 rounded-md space-y-2">
                                                            <div className="flex items-center gap-3">
                                                              <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => toggleAudio(response.audioUrl, responseId)}
                                                              >
                                                                {audioState.isPlaying ? (
                                                                  <Pause className="h-4 w-4" />
                                                                ) : (
                                                                  <Play className="h-4 w-4" />
                                                                )}
                                                              </Button>
                                                              
                                                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Volume2 className="h-4 w-4" />
                                                                <span>{formatTime(audioState.currentTime)} / {formatTime(audioState.duration)}</span>
                                                              </div>
                                                              
                                                              {response.score && (
                                                                <Badge variant="outline" className="ml-auto">
                                                                  Score: {response.score}/10
                                                                </Badge>
                                                              )}
                                                            </div>
                                                            
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
                                                      )}

                                                      {response.aiAnalysis && response.aiAnalysis !== 'Análise IA pendente' && (
                                                        <div>
                                                          <p className="text-sm font-medium mb-1">Análise IA</p>
                                                          <p className="text-sm text-muted-foreground">{response.aiAnalysis}</p>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </CardContent>
                                                </Card>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}