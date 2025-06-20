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
  categorySelection?: string;
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

  // Mutação para salvar categoria do candidato
  const saveCategoryMutation = useMutation({
    mutationFn: ({ candidateId, reportId, selectionId, category }: { 
      candidateId: string, 
      reportId: string, 
      selectionId: string, 
      category: string 
    }) => {
      console.log(`💾 [FRONTEND] Salvando categoria:`, { candidateId, reportId, selectionId, category });
      return apiRequest('/api/reports/candidate-category', 'POST', { 
        candidateId, 
        reportId, 
        selectionId, 
        category 
      });
    },
    onSuccess: () => {
      // Invalidar múltiplas queries para garantir atualização
      queryClient.invalidateQueries({ queryKey: ['/api/reports', selectedReport?.id, 'candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/candidate-categories', selectedReport?.selectionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      toast({
        title: "Categoria salva",
        description: "A categoria do candidato foi salva com sucesso.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error('❌ [FRONTEND] Erro ao salvar categoria:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a categoria.",
        variant: "destructive",
      });
    },
  });

  // Mutação para remover categoria do candidato
  const removeCategoryMutation = useMutation({
    mutationFn: ({ candidateId, reportId, selectionId }: { 
      candidateId: string, 
      reportId: string, 
      selectionId: string
    }) => {
      console.log(`🗑️ [FRONTEND] Removendo categoria:`, { candidateId, reportId, selectionId });
      return apiRequest('/api/reports/candidate-category', 'DELETE', { 
        candidateId, 
        reportId, 
        selectionId
      });
    },
    onSuccess: () => {
      // Invalidar múltiplas queries para garantir atualização
      queryClient.invalidateQueries({ queryKey: ['/api/reports', selectedReport?.id, 'candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/candidate-categories', selectedReport?.selectionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      toast({
        title: "Categoria removida",
        description: "A categoria do candidato foi removida com sucesso.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error('❌ [FRONTEND] Erro ao remover categoria:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a categoria.",
        variant: "destructive",
      });
    },
  });

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

  // Buscar categorias dos candidatos para a seleção atual
  const { data: candidateCategories = [], refetch: refetchCategories } = useQuery({
    queryKey: ['/api/reports/candidate-categories', selectedReport?.selectionId],
    queryFn: () => apiRequest(`/api/reports/candidate-categories/${selectedReport?.selectionId}`, 'GET'),
    enabled: !!selectedReport && currentView === 'candidates',
    staleTime: 0, // Sempre refetch
    cacheTime: 0  // Não manter cache
  });

  // Combinar dados de candidatos com suas categorias
  const candidatesWithCategories = candidates.map((candidate: ReportCandidate) => {
    const category = candidateCategories.find((cat: any) => 
      cat.candidateId === parseInt(candidate.originalCandidateId)
    );
    
    console.log(`🔗 [DEBUG] Vinculando categoria para ${candidate.name}:`, {
      candidateId: candidate.originalCandidateId,
      categoryFound: !!category,
      categoryValue: category?.category || 'sem categoria',
      allCategories: candidateCategories.length
    });
    
    return {
      ...candidate,
      categorySelection: category?.category || ''
    };
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

  const getCategoryButtonClass = (category: string, selectedCategory?: string) => {
    const isSelected = selectedCategory === category;
    const baseClass = "px-3 py-1 text-xs rounded transition-colors";
    
    switch (category) {
      case 'melhor':
        return `${baseClass} ${isSelected ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-green-100'}`;
      case 'mediano':
        return `${baseClass} ${isSelected ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-orange-100'}`;
      case 'em_duvida':
        return `${baseClass} ${isSelected ? 'bg-gray-400 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;
      case 'nao_contratar':
        return `${baseClass} ${isSelected ? 'bg-red-400 text-white' : 'bg-gray-100 text-gray-700 hover:bg-red-100'}`;
      default:
        return `${baseClass} bg-gray-100 text-gray-700`;
    }
  };

  const handleCategorySelection = async (candidate: ReportCandidate, category: string) => {
    if (selectedReport) {
      console.log(`🎯 [FRONTEND] Clique na categoria:`, {
        candidateId: candidate.originalCandidateId,
        reportId: selectedReport.id,
        selectionId: selectedReport.selectionId,
        currentCategory: candidate.categorySelection,
        clickedCategory: category,
        isAlreadySelected: candidate.categorySelection === category
      });

      try {
        // Se já está selecionado, remove a categoria
        if (candidate.categorySelection === category) {
          await removeCategoryMutation.mutateAsync({
            candidateId: candidate.originalCandidateId,
            reportId: selectedReport.id,
            selectionId: selectedReport.selectionId
          });
        } else {
          // Senão, salva a nova categoria
          await saveCategoryMutation.mutateAsync({
            candidateId: candidate.originalCandidateId,
            reportId: selectedReport.id,
            selectionId: selectedReport.selectionId,
            category: category
          });
        }
        
        // Forçar refetch das categorias após sucesso
        setTimeout(() => {
          refetchCategories();
        }, 100);
        
      } catch (error) {
        console.error('❌ [FRONTEND] Erro ao processar categoria:', error);
      }
    }
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
        <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger 
            value="candidatos"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-blue-600 data-[state=inactive]:hover:bg-blue-100 transition-all duration-200 font-medium"
          >
            Candidatos
          </TabsTrigger>
          <TabsTrigger 
            value="analise"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-purple-600 data-[state=inactive]:hover:bg-purple-100 transition-all duration-200 font-medium"
          >
            Análise
          </TabsTrigger>
          <TabsTrigger 
            value="selecionados"
            className="data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-green-600 data-[state=inactive]:hover:bg-green-100 transition-all duration-200 font-medium"
          >
            Selecionados
          </TabsTrigger>
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
                    <div className="space-y-2">
                      {candidatesWithCategories.map((candidate: ReportCandidate) => (
                        <div 
                          key={candidate.id} 
                          className="cursor-pointer hover:bg-gray-50 transition-colors border rounded-lg p-3"
                          onClick={() => {
                            setSelectedCandidate(candidate);
                            setCurrentView('candidateDetail');
                          }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-6 flex-1">
                              <div className="flex-1">
                                <h3 className="font-medium text-sm">{candidate.name}</h3>
                                <p className="text-xs text-gray-600">{candidate.email}</p>
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-gray-600">{candidate.whatsapp}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(candidate.status)}
                                {candidate.category && getCategoryBadge(candidate.category)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">Pontuação: {candidate.totalScore}%</span>
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCategorySelection(candidate, 'melhor');
                                  }}
                                  className={getCategoryButtonClass('melhor', candidate.categorySelection)}
                                >
                                  Melhor
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCategorySelection(candidate, 'mediano');
                                  }}
                                  className={getCategoryButtonClass('mediano', candidate.categorySelection)}
                                >
                                  Mediano
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCategorySelection(candidate, 'em_duvida');
                                  }}
                                  className={getCategoryButtonClass('em_duvida', candidate.categorySelection)}
                                >
                                  Em Dúvida
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCategorySelection(candidate, 'nao_contratar');
                                  }}
                                  className={getCategoryButtonClass('nao_contratar', candidate.categorySelection)}
                                >
                                  Não Contratar
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
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
                        <p className="text-sm text-gray-600">Pontuação Total</p>
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
                              <Badge variant="outline">Pontuação: {response.score}%</Badge>
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