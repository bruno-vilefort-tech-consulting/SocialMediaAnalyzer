import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FileText, ArrowLeft, Users, BarChart3, Star, CheckCircle, XCircle, Clock, Trash2, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Report {
  id: string;
  name: string;
  originalSelectionId: number;
  clientId: number;
  status: string;
  createdAt: string;
  jobData: {
    id: string;
    name: string;
    description?: string;
    questions: Array<{
      id: number;
      text: string;
      perfectAnswer?: string;
    }>;
  };
  candidatesData: Array<{
    id: number;
    name: string;
    email: string;
    phone: string;
    whatsapp: string;
  }>;
  responseData: Array<{
    candidateId: number;
    questionId: number;
    questionText: string;
    transcription: string;
    audioFile?: string;
    score?: number;
    aiAnalysis?: any;
    recordingDuration?: number;
  }>;
  totalCandidates: number;
  totalQuestions: number;
  completedInterviews: number;
  avgScore?: number;
}

interface Selection {
  id: number;
  name: string;
  status: string;
  clientId: number;
  jobName?: string;
}

export default function IndependentReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'master';
  
  const [selectedClientId, setSelectedClientId] = React.useState<string>('');
  const [selectedReport, setSelectedReport] = React.useState<Report | null>(null);
  const [activeTab, setActiveTab] = React.useState('candidatos');

  // Buscar clientes (apenas para masters)
  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients'],
    enabled: isMaster
  });

  // Buscar seleções disponíveis para gerar relatórios
  const { data: selections = [] } = useQuery({
    queryKey: ['/api/selections', selectedClientId],
    queryFn: () => apiRequest('/api/selections' + (selectedClientId ? `?clientId=${selectedClientId}` : '')),
    enabled: isMaster ? !!selectedClientId : true
  });

  // Buscar relatórios independentes
  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['/api/reports', selectedClientId],
    queryFn: () => apiRequest('/api/reports' + (selectedClientId ? `?clientId=${selectedClientId}` : '')),
    enabled: isMaster ? !!selectedClientId : true
  });

  // Mutation para gerar relatório
  const generateReportMutation = useMutation({
    mutationFn: (selectionId: number) => apiRequest(`/api/reports/generate/${selectionId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      toast({
        title: "Relatório gerado com sucesso!",
        description: "O relatório independente foi criado e salvo.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message || "Ocorreu um erro ao gerar o relatório.",
        variant: "destructive",
      });
    }
  });

  // Mutation para deletar relatório
  const deleteReportMutation = useMutation({
    mutationFn: (reportId: string) => apiRequest(`/api/reports/${reportId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      toast({
        title: "Relatório deletado",
        description: "O relatório foi removido permanentemente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar relatório",
        description: error.message || "Ocorreu um erro ao deletar o relatório.",
        variant: "destructive",
      });
    }
  });

  // Se usuário for master mas não selecionou cliente
  if (isMaster && !selectedClientId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <FileText className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Relatórios Independentes</h1>
            <p className="text-muted-foreground">Sistema de relatórios preservados independentemente das seleções</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecionar Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um cliente para visualizar relatórios" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se não selecionou relatório específico, mostrar lista
  if (!selectedReport) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FileText className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Relatórios Independentes</h1>
              <p className="text-muted-foreground">
                Sistema de relatórios preservados independentemente das seleções
              </p>
            </div>
          </div>

          {isMaster && (
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client: any) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Seção para gerar novos relatórios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Gerar Novo Relatório
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione uma seleção abaixo para gerar um relatório independente que será preservado mesmo se a seleção original for deletada.
              </p>
              
              {selections.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma seleção encontrada</h3>
                  <p className="text-muted-foreground">Crie seleções primeiro para gerar relatórios.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {selections.map((selection: Selection) => (
                    <div key={selection.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{selection.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Vaga: {selection.jobName || 'Não identificada'} • Status: {selection.status}
                        </p>
                      </div>
                      
                      <Button
                        onClick={() => generateReportMutation.mutate(selection.id)}
                        disabled={generateReportMutation.isPending}
                        size="sm"
                      >
                        {generateReportMutation.isPending ? 'Gerando...' : 'Gerar Relatório'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de relatórios existentes */}
        <Card>
          <CardHeader>
            <CardTitle>Relatórios Salvos</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingReports ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum relatório encontrado</h3>
                <p className="text-muted-foreground">Gere relatórios das seleções para visualizá-los aqui.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report: Report) => (
                  <Card 
                    key={report.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-300"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1" onClick={() => setSelectedReport(report)}>
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{report.name}</h3>
                            <Badge variant={report.status === 'enviado' ? 'default' : 'secondary'}>
                              {report.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Vaga: {report.jobData.name} • {report.totalCandidates} candidatos • {report.completedInterviews} entrevistas completas
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Criado em: {new Date(report.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline"
                            onClick={() => setSelectedReport(report)}
                          >
                            Ver Relatório
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="icon">
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deletar Relatório</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja deletar o relatório "{report.name}"? 
                                  Esta ação não pode ser desfeita e o relatório será removido permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteReportMutation.mutate(report.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Confirmar Exclusão
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mostrar relatório específico com dados preservados
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button 
          variant="ghost" 
          onClick={() => setSelectedReport(null)}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{selectedReport.name}</h1>
          <p className="text-muted-foreground">
            Relatório Independente • Vaga: {selectedReport.jobData.name}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="candidatos" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Candidatos ({selectedReport.totalCandidates})
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
              <CardTitle>Candidatos do Relatório</CardTitle>
              <p className="text-sm text-muted-foreground">
                Dados preservados independentemente da seleção original
              </p>
            </CardHeader>
            <CardContent>
              {selectedReport.candidatesData.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum candidato encontrado</h3>
                  <p className="text-muted-foreground">Este relatório não possui candidatos.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedReport.candidatesData.map((candidate) => {
                    // Buscar respostas deste candidato
                    const candidateResponses = selectedReport.responseData.filter(
                      r => r.candidateId === candidate.id
                    );
                    
                    const answeredQuestions = candidateResponses.filter(r => 
                      r.transcription && r.transcription !== 'Aguardando resposta'
                    ).length;
                    const totalQuestions = selectedReport.jobData.questions.length;
                    
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
                                  <p className="text-sm text-muted-foreground">{candidate.whatsapp}</p>
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
                            </div>
                          </div>
                        </CardContent>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{selectedReport.totalCandidates}</div>
                  <div className="text-sm text-muted-foreground">Candidatos</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{selectedReport.completedInterviews}</div>
                  <div className="text-sm text-muted-foreground">Entrevistas Completas</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{selectedReport.totalQuestions}</div>
                  <div className="text-sm text-muted-foreground">Perguntas</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{selectedReport.avgScore || 0}</div>
                  <div className="text-sm text-muted-foreground">Score Médio</div>
                </div>
              </div>
              
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Análises detalhadas serão implementadas conforme necessário.
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
                  Sistema de selecionados será implementado conforme necessário.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}