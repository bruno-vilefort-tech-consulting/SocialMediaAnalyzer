import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Eye, Calendar, Users, CheckCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Report {
  id: string;
  selectionName: string;
  selectionId: string;
  clientId: number;
  clientName: string;
  totalCandidates: number;
  jobName: string;
  createdAt: any;
  generatedAt: any;
  candidateListName: string;
  completedInterviews: number;
}

interface ReportCandidate {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  status: string;
  totalScore: number;
  category?: string;
  createdAt: any;
  completedAt?: any;
  originalCandidateId: string;
  reportId: string;
}

interface ReportResponse {
  id: string;
  questionNumber: number;
  questionText: string;
  transcription: string;
  audioFile: string;
  score: number;
  recordingDuration: number;
  aiAnalysis?: string;
}

const ReportsHistoryPage: React.FC = () => {
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('candidatos');
  const [currentView, setCurrentView] = useState<'reports' | 'candidates' | 'candidateDetail'>('reports');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<ReportCandidate | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ['/api/reports'],
    queryFn: () => apiRequest('/api/reports', 'GET')
  });

  // Buscar candidatos de um relatório específico
  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ['/api/reports', selectedReport?.id, 'candidates'],
    queryFn: () => apiRequest(`/api/reports/${selectedReport?.id}/candidates`, 'GET'),
    enabled: !!selectedReport && currentView === 'candidates'
  });

  // Buscar respostas de um candidato específico
  const { data: responses = [], isLoading: responsesLoading } = useQuery({
    queryKey: ['/api/reports/candidates', selectedCandidate?.id, 'responses'],
    queryFn: () => apiRequest(`/api/reports/candidates/${selectedCandidate?.id}/responses`),
    enabled: !!selectedCandidate && currentView === 'candidateDetail'
  });

  // Mutação para deletar relatório
  const deleteReportMutation = useMutation({
    mutationFn: (reportId: string) => apiRequest(`/api/reports/${reportId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      toast({
        title: "Relatório deletado",
        description: "O relatório foi removido com sucesso.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: "Não foi possível deletar o relatório.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteReport = (reportId: string) => {
    deleteReportMutation.mutate(reportId);
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return 'Data não disponível';
    
    let date: Date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp._seconds) {
      date = new Date(timestamp._seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'completed': { label: 'Completa', variant: 'default' as const },
      'invited': { label: 'Convidado', variant: 'secondary' as const },
      'in_progress': { label: 'Em andamento', variant: 'outline' as const },
      'expired': { label: 'Expirado', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'outline' as const };
    
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const categoryConfig = {
      'melhor': { label: 'Melhor', variant: 'default' as const },
      'mediano': { label: 'Mediano', variant: 'secondary' as const },
      'em_duvida': { label: 'Em dúvida', variant: 'outline' as const },
      'nao': { label: 'Não', variant: 'destructive' as const },
    };

    const config = categoryConfig[category as keyof typeof categoryConfig] || { label: category, variant: 'outline' as const };
    
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar relatórios</h2>
          <p className="text-gray-600">Não foi possível carregar os dados dos relatórios.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-600">
            Visualize e analise os dados dos candidatos
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="candidatos">Candidatos</TabsTrigger>
          <TabsTrigger value="analise">Análise</TabsTrigger>
          <TabsTrigger value="selecionados">Selecionados</TabsTrigger>
        </TabsList>

        <TabsContent value="candidatos">
          {/* VIEW: Lista de Relatórios */}
          {currentView === 'reports' && (
            <>
              {reports.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum relatório encontrado</h3>
                    <p className="text-gray-600">
                      Os relatórios são gerados automaticamente quando você envia uma seleção via WhatsApp.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {Array.isArray(reports) && reports.length > 0 ? reports
                    .sort((a: Report, b: Report) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((report: Report) => (
                      <Card key={report.id} className="border border-gray-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg font-semibold text-gray-900">
                                {report.selectionName}
                              </CardTitle>
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                <span>{report.jobName}</span>
                                <span>•</span>
                                <span>{report.clientName}</span>
                                <span>•</span>
                                <span>{report.candidateListName}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedReport(report);
                                  setCurrentView('candidates');
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Ver Detalhes
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Deletar Relatório</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja deletar este relatório? Esta ação não pode ser desfeita.
                                      Todos os dados do relatório, incluindo candidatos e respostas, serão permanentemente removidos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteReport(report.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Deletar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-6 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              <span>{report.totalCandidates} candidatos</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              <span>{report.completedInterviews} completadas</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>{formatDateTime(report.createdAt)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )) : (
                      <Card>
                        <CardContent className="py-8 text-center">
                          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {Array.isArray(reports) ? 'Nenhum relatório encontrado' : 'Erro ao carregar relatórios'}
                          </h3>
                          <p className="text-gray-600">
                            {Array.isArray(reports) 
                              ? 'Ainda não há relatórios gerados. Eles aparecerão automaticamente após enviar seleções.'
                              : 'Houve um problema ao carregar os dados dos relatórios.'
                            }
                          </p>
                        </CardContent>
                      </Card>
                    )}
                </div>
              )}
            </>
          )}

          {/* VIEW: Lista de Candidatos */}
          {currentView === 'candidates' && selectedReport && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentView('reports')}
                >
                  ← Voltar aos Relatórios
                </Button>
                <h2 className="text-xl font-semibold">{selectedReport.selectionName}</h2>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Candidatos da Seleção</CardTitle>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{selectedReport.jobName}</span>
                    <span>•</span>
                    <span>{selectedReport.clientName}</span>
                    <span>•</span>
                    <span>{selectedReport.candidateListName}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {candidatesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {candidates.map((candidate: ReportCandidate) => (
                        <Card 
                          key={candidate.id} 
                          className="cursor-pointer hover:shadow-md transition-shadow border"
                          onClick={() => {
                            setSelectedCandidate(candidate);
                            setCurrentView('candidateDetail');
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="space-y-2">
                              <h3 className="font-medium">{candidate.name}</h3>
                              <p className="text-sm text-gray-600">{candidate.email}</p>
                              <p className="text-sm text-gray-600">{candidate.whatsapp}</p>
                              <div className="flex items-center justify-between">
                                {getStatusBadge(candidate.status)}
                                <span className="text-sm font-medium">Score: {candidate.totalScore}%</span>
                              </div>
                              {candidate.category && getCategoryBadge(candidate.category)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* VIEW: Detalhes do Candidato */}
          {currentView === 'candidateDetail' && selectedCandidate && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentView('candidates')}
                >
                  ← Voltar aos Candidatos
                </Button>
                <h2 className="text-xl font-semibold">Entrevista de {selectedCandidate.name}</h2>
              </div>

              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Informações do Candidato</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Nome</p>
                        <p className="font-medium">{selectedCandidate.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium">{selectedCandidate.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">WhatsApp</p>
                        <p className="font-medium">{selectedCandidate.whatsapp}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Score Total</p>
                        <p className="font-medium">{selectedCandidate.totalScore}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Respostas da Entrevista</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {responsesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {responses.map((response: ReportResponse) => (
                          <div key={response.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h6 className="font-medium">Pergunta {response.questionNumber}</h6>
                              <Badge variant="outline">Score: {response.score}%</Badge>
                            </div>
                            <p className="text-sm text-gray-700 mb-3">{response.questionText}</p>
                            {response.transcription && (
                              <div className="bg-gray-50 p-3 rounded mb-3">
                                <p className="text-sm"><strong>Transcrição:</strong></p>
                                <p className="text-sm">{response.transcription}</p>
                              </div>
                            )}
                            {response.audioFile && (
                              <div className="mt-2">
                                <audio controls className="w-full" preload="metadata">
                                  <source src={`/uploads/${response.audioFile}`} type="audio/ogg" />
                                  <source src={`/${response.audioFile}`} type="audio/ogg" />
                                  Seu navegador não suporta o elemento de áudio.
                                </audio>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analise">
          <Card>
            <CardContent className="py-8 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Análise de Dados</h3>
              <p className="text-gray-600">
                Esta aba conterá análises detalhadas dos candidatos.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="selecionados">
          <Card>
            <CardContent className="py-8 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Candidatos Selecionados</h3>
              <p className="text-gray-600">
                Esta aba mostrará os candidatos selecionados e aprovados.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsHistoryPage;