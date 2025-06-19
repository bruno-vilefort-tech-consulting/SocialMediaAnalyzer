import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Calendar, FileText, User, Building, ChevronRight, Play, Pause, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  createdAt: string;
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
  completedAt: string | null;
}

interface ReportResponse {
  id: string;
  reportId: string;
  reportCandidateId: string;
  questionNumber: number;
  questionText: string;
  transcription: string;
  audioFile: string;
  score: number;
  recordingDuration: number;
  aiAnalysis: string;
}

const ReportsHistoryPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<ReportCandidate | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['/api/reports'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/reports', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }
      return response.json();
    }
  });

  const { data: candidates } = useQuery({
    queryKey: ['/api/reports', selectedReport?.id, 'candidates'],
    queryFn: async () => {
      if (!selectedReport) return [];
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reports/${selectedReport.id}/candidates`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch candidates');
      }
      return response.json();
    },
    enabled: !!selectedReport
  });

  const { data: responses } = useQuery({
    queryKey: ['/api/reports/candidates', selectedCandidate?.id, 'responses'],
    queryFn: async () => {
      if (!selectedCandidate) return [];
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reports/candidates/${selectedCandidate.id}/responses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch responses');
      }
      return response.json();
    },
    enabled: !!selectedCandidate
  });

  const deleteReportMutation = useMutation({
    mutationFn: (reportId: string) => apiRequest(`/api/reports/${reportId}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      setSelectedReport(null);
      setSelectedCandidate(null);
      toast({
        title: "Sucesso",
        description: "Relatório deletado com sucesso",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao deletar relatório",
        variant: "destructive",
      });
    }
  });

  const playAudio = (audioFile: string) => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    if (playingAudio === audioFile) {
      setPlayingAudio(null);
      setCurrentAudio(null);
      return;
    }

    const audio = new Audio(`/uploads/${audioFile}`);
    audio.onended = () => {
      setPlayingAudio(null);
      setCurrentAudio(null);
    };
    audio.play();
    setCurrentAudio(audio);
    setPlayingAudio(audioFile);
  };

  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setPlayingAudio(null);
    }
  };

  // Auto-select the latest report when data loads
  React.useEffect(() => {
    if (reports && Array.isArray(reports) && reports.length > 0 && !selectedReport) {
      const latestReport = reports.sort((a: Report, b: Report) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      setSelectedReport(latestReport);
    }
  }, [reports, selectedReport]);

  // Auto-select the first candidate when candidates load
  React.useEffect(() => {
    if (candidates && Array.isArray(candidates) && candidates.length > 0 && !selectedCandidate) {
      setSelectedCandidate(candidates[0]);
    }
  }, [candidates, selectedCandidate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Histórico de Relatórios</h1>
          <p className="text-gray-600 mt-1">
            Visualize e gerencie relatórios de entrevistas independentes
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando relatórios...</p>
          </CardContent>
        </Card>
      ) : !Array.isArray(reports) || reports.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum relatório encontrado</h3>
            <p className="text-gray-600">
              Os relatórios aparecerão aqui após enviar seleções via WhatsApp.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-6">
          {/* Lista de Relatórios - Coluna Esquerda */}
          <div className="w-1/3 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Seleções</h2>
            {Array.isArray(reports) && reports
              .sort((a: Report, b: Report) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((report: Report) => (
                <Card 
                  key={report.id} 
                  className={`cursor-pointer border transition-all hover:shadow-md ${
                    selectedReport?.id === report.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                  onClick={() => {
                    setSelectedReport(report);
                    setSelectedCandidate(null);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{report.selectionName}</h3>
                        <p className="text-sm text-gray-600 mt-1">{report.jobName}</p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="secondary">{report.totalCandidates} candidatos</Badge>
                          <Badge variant="outline">{report.completedInterviews} completas</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{formatDateTime(report.createdAt)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Lista de Candidatos - Coluna Central */}
          <div className="w-1/3 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedReport ? 'Candidatos' : 'Selecione uma seleção'}
            </h2>
            
            {selectedReport && candidates ? (
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {candidates.map((candidate: ReportCandidate) => (
                    <Card 
                      key={candidate.id}
                      className={`cursor-pointer border transition-all hover:shadow-md ${
                        selectedCandidate?.id === candidate.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedCandidate(candidate)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{candidate.name}</h4>
                            <p className="text-sm text-gray-600">{candidate.email}</p>
                            <p className="text-sm text-gray-600">{candidate.whatsapp}</p>
                            <div className="flex items-center space-x-2 mt-2">
                              <Badge variant={candidate.status === 'completed' ? 'default' : 'secondary'}>
                                {candidate.status === 'completed' ? 'Completa' : 'Pendente'}
                              </Badge>
                              {candidate.status === 'completed' && (
                                <Badge variant="outline">Score: {candidate.totalScore}</Badge>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : selectedReport ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-gray-600">Carregando candidatos...</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <User className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Selecione uma seleção para ver os candidatos</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Respostas do Candidato - Coluna Direita */}
          <div className="w-1/3 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedCandidate ? 'Respostas' : 'Selecione um candidato'}
            </h2>
            
            {selectedCandidate && responses ? (
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {responses.map((response: ReportResponse) => (
                    <Card key={response.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <h5 className="font-medium text-gray-900">
                              Pergunta {response.questionNumber}
                            </h5>
                            <p className="text-sm text-gray-600 mt-1">
                              {response.questionText}
                            </p>
                          </div>
                          
                          {response.transcription && (
                            <div>
                              <h6 className="text-sm font-medium text-gray-900">Transcrição:</h6>
                              <p className="text-sm text-gray-700 mt-1">
                                {response.transcription}
                              </p>
                            </div>
                          )}
                          
                          {response.audioFile && (
                            <div>
                              <h6 className="text-sm font-medium text-gray-900 mb-2">Áudio:</h6>
                              <div className="flex items-center space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => playAudio(response.audioFile)}
                                  className="flex items-center space-x-1"
                                >
                                  {playingAudio === response.audioFile ? (
                                    <Pause className="w-3 h-3" />
                                  ) : (
                                    <Play className="w-3 h-3" />
                                  )}
                                  <span>
                                    {playingAudio === response.audioFile ? 'Pausar' : 'Reproduzir'}
                                  </span>
                                </Button>
                                
                                {playingAudio === response.audioFile && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={stopAudio}
                                    className="flex items-center space-x-1"
                                  >
                                    <Square className="w-3 h-3" />
                                    <span>Parar</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-4 text-sm">
                            <Badge variant="outline">Score: {response.score}</Badge>
                            {response.recordingDuration > 0 && (
                              <span className="text-gray-600">
                                Duração: {Math.round(response.recordingDuration)}s
                              </span>
                            )}
                          </div>
                          
                          {response.aiAnalysis && (
                            <div>
                              <h6 className="text-sm font-medium text-gray-900">Análise IA:</h6>
                              <p className="text-sm text-gray-700 mt-1">
                                {response.aiAnalysis}
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : selectedCandidate ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-gray-600">Carregando respostas...</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <FileText className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Selecione um candidato para ver as respostas</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Botão para deletar relatório selecionado */}
      {selectedReport && (
        <div className="fixed bottom-6 right-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="shadow-lg"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Relatório
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza de que deseja excluir o relatório "{selectedReport.selectionName}"? 
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteReportMutation.mutate(selectedReport.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
};

export default ReportsHistoryPage;