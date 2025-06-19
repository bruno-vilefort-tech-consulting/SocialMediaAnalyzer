import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Eye, Calendar, Users, CheckCircle } from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

interface Report {
  id: string;
  selectionId: string;
  selectionName: string;
  jobName: string;
  clientId: number;
  clientName: string;
  candidateListName: string;
  totalCandidates: number;
  completedInterviews: number;
  createdAt: any;
  generatedAt: any;
}

interface ReportCandidate {
  id: string;
  reportId: string;
  originalCandidateId: string;
  name: string;
  email: string;
  whatsapp: string;
  status: string;
  totalScore: number;
  category?: string;
  completedAt?: any;
}

interface ReportResponse {
  id: string;
  reportId: string;
  reportCandidateId: string;
  questionNumber: number;
  questionText: string;
  transcription?: string;
  audioFile?: string;
  score: number;
  recordingDuration: number;
  aiAnalysis?: string;
}

const ReportsHistoryPage: React.FC = () => {
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar todos os relatórios
  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ['/api/reports'],
    queryFn: () => apiRequest('/api/reports', 'GET')
  });

  // Buscar candidatos de um relatório específico
  const { data: candidates = [] } = useQuery({
    queryKey: ['/api/reports', expandedReport, 'candidates'],
    queryFn: () => apiRequest(`/api/reports/${expandedReport}/candidates`, 'GET'),
    enabled: !!expandedReport
  });

  // Buscar respostas de um candidato específico
  const { data: responses = [] } = useQuery({
    queryKey: ['/api/reports/candidates', expandedCandidate, 'responses'],
    queryFn: () => apiRequest(`/api/reports/candidates/${expandedCandidate}/responses`),
    enabled: !!expandedCandidate
  });

  // Mutação para deletar relatório
  const deleteReportMutation = useMutation({
    mutationFn: (reportId: string) => apiRequest(`/api/reports/${reportId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      setExpandedReport(null);
      setExpandedCandidate(null);
      toast({
        title: "Sucesso",
        description: "Relatório deletado com sucesso"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar relatório",
        variant: "destructive"
      });
    }
  });

  const handleDeleteReport = (reportId: string) => {
    deleteReportMutation.mutate(reportId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completo</Badge>;
      case 'invited':
        return <Badge variant="secondary">Convidado</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const getCategoryBadge = (category?: string) => {
    if (!category) return null;
    
    const colors = {
      'Melhor': 'bg-green-100 text-green-800',
      'Mediano': 'bg-yellow-100 text-yellow-800',
      'Em dúvida': 'bg-orange-100 text-orange-800',
      'Não': 'bg-red-100 text-red-800'
    };
    
    return <Badge className={colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>{category}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Histórico de Relatórios</h1>
          <p className="text-gray-600">
            Visualize e gerencie todos os relatórios de entrevistas já realizadas
          </p>
        </div>
      </div>

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
                        onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {expandedReport === report.id ? 'Ocultar Detalhes' : 'Ver Detalhes'}
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

                  {/* Detalhes Expandidos Inline */}
                  {expandedReport === report.id && (
                    <div className="mt-6 space-y-4 border-t pt-4">
                      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm text-gray-600">Vaga</p>
                          <p className="font-medium">{report.jobName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Cliente</p>
                          <p className="font-medium">{report.clientName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Lista de Candidatos</p>
                          <p className="font-medium">{report.candidateListName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Gerado em</p>
                          <p className="font-medium">{formatDateTime(report.createdAt)}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold">Candidatos ({candidates.length})</h4>
                        <div className="grid gap-3">
                          {candidates.map((candidate: ReportCandidate) => (
                            <div key={candidate.id} className="border rounded-lg">
                              <div className="flex items-center justify-between p-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <div>
                                      <p className="font-medium">{candidate.name}</p>
                                      <p className="text-sm text-gray-600">{candidate.email}</p>
                                    </div>
                                    {getStatusBadge(candidate.status)}
                                    {candidate.category && getCategoryBadge(candidate.category)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium">Score: {candidate.totalScore}%</p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-1"
                                    onClick={() => setExpandedCandidate(expandedCandidate === candidate.id ? null : candidate.id)}
                                  >
                                    {expandedCandidate === candidate.id ? 'Ocultar' : 'Ver Respostas'}
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Respostas Expandidas Inline */}
                              {expandedCandidate === candidate.id && (
                                <div className="border-t bg-gray-50 p-4 space-y-4">
                                  <h5 className="font-semibold">Respostas de {candidate.name}</h5>
                                  {responses.map((response: ReportResponse) => (
                                    <div key={response.id} className="border rounded-lg p-4 bg-white">
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
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
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
    </div>
  );
};

export default ReportsHistoryPage;