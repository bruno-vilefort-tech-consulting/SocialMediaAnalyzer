import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Users, Clock, CheckCircle2, Play, Volume2, AlertTriangle, Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Interview {
  id: string;
  selectionId?: string | number;
  selectionName?: string;
  candidateName: string;
  candidatePhone: string;
  jobName: string;
  status: string;
  startTime: string;
  endTime?: string;
  responses: Array<{
    questionText: string;
    responseText: string;
    audioFile: string;
    timestamp: string;
  }>;
  totalQuestions: number;
  answeredQuestions: number;
}

interface Selection {
  id: number;
  jobId: string;
  jobName: string;
  candidateCount: number;
  status: string;
  createdAt: { seconds: number; nanoseconds: number };
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [debugMode, setDebugMode] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');

  const { data: selections = [], isLoading: selectionsLoading } = useQuery({
    queryKey: ['/api/selections'],
  });

  const { data: interviews = [], isLoading: interviewsLoading } = useQuery({
    queryKey: ['/api/interview-responses'],
    retry: 1,
  });

  console.log('🔍 DEBUG RELATÓRIOS - Seleções recebidas:', selections);
  console.log('🔍 DEBUG RELATÓRIOS - Entrevistas recebidas:', interviews);
  console.log('🔍 DEBUG RELATÓRIOS - Total entrevistas:', Array.isArray(interviews) ? interviews.length : 0);

  const isLoading = selectionsLoading || interviewsLoading;

  // Processar entrevistas por seleção com debug detalhado
  const processedSelections = (selections || []).map((selection: Selection) => {
    console.log(`🔍 DEBUG - Processando seleção: ${selection.jobName} (ID: ${selection.id})`);
    
    const selectionInterviews = (interviews || []).filter((interview: Interview) => {
      const matchSelectionId = interview.selectionId === selection.id || interview.selectionId === selection.id.toString();
      const matchJobName = interview.jobName === selection.jobName || interview.selectionName === selection.jobName;
      const matchFaxina = (selection.jobName === 'Faxineira GM' && (interview.jobName === 'Faxina' || interview.jobName === 'Faxineira GM'));
      
      const matches = matchSelectionId || matchJobName || matchFaxina;
      
      if (debugMode) {
        console.log(`  📋 Entrevista ${interview.id}:`);
        console.log(`    - candidateName: "${interview.candidateName}"`);
        console.log(`    - jobName: "${interview.jobName}"`);
        console.log(`    - status: "${interview.status}"`);
        console.log(`    - selectionId: "${interview.selectionId}"`);
        console.log(`    - matches: ${matches}`);
      }
      
      return matches;
    });
    
    const completed = selectionInterviews.filter(interview => interview.status === 'completed');
    const inProgress = selectionInterviews.filter(interview => interview.status === 'in_progress');
    const pending = selectionInterviews.filter(interview => interview.status === 'pending');
    
    console.log(`✅ Seleção ${selection.jobName}: ${completed.length} completed, ${inProgress.length} in_progress, ${pending.length} pending`);
    
    return {
      ...selection,
      interviews: selectionInterviews,
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      pendingCount: pending.length,
      totalResponses: selectionInterviews.reduce((acc, interview) => acc + (interview.responses?.length || 0), 0)
    };
  });

  const handlePlayAudio = (audioFile: string) => {
    console.log('🎵 Reproduzindo áudio:', audioFile);
    setAudioUrl(`/uploads/${audioFile}`);
  };

  const handleViewInterview = (interview: Interview) => {
    console.log('👁️ Visualizando entrevista:', interview);
    setSelectedInterview(interview);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando relatórios das entrevistas...</p>
        </div>
      </div>
    );
  }

  // Estatísticas gerais
  const totalInterviews = interviews.length;
  const totalCompleted = interviews.filter((i: Interview) => i.status === 'completed').length;
  const totalInProgress = interviews.filter((i: Interview) => i.status === 'in_progress').length;
  const totalResponses = interviews.reduce((acc: number, interview: Interview) => acc + (interview.responses?.length || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios de Entrevistas</h1>
          <p className="text-gray-600 mt-1">
            Visualize os resultados das entrevistas realizadas via WhatsApp
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setDebugMode(!debugMode)}
          size="sm"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          {debugMode ? 'Ocultar' : 'Mostrar'} Debug
        </Button>
      </div>

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <FileText className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{totalInterviews}</p>
              <p className="text-gray-600 text-sm">Total de Entrevistas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <CheckCircle2 className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{totalCompleted}</p>
              <p className="text-gray-600 text-sm">Finalizadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <Clock className="h-8 w-8 text-yellow-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{totalInProgress}</p>
              <p className="text-gray-600 text-sm">Em Andamento</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <Volume2 className="h-8 w-8 text-purple-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{totalResponses}</p>
              <p className="text-gray-600 text-sm">Respostas de Áudio</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {debugMode && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-800">Debug - Dados Recebidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Seleções:</strong> {selections.length} encontradas</p>
              <p><strong>Entrevistas Firebase:</strong> {interviews.length} encontradas</p>
              <p><strong>Entrevistas Completed:</strong> {totalCompleted}</p>
              <p><strong>Primeira entrevista completed:</strong> {interviews.find((i: Interview) => i.status === 'completed')?.candidateName || 'Nenhuma'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seleções com Entrevistas */}
      {processedSelections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma seleção encontrada
            </h3>
            <p className="text-gray-600 text-center mb-4">
              Crie seleções e realize entrevistas para ver os relatórios aqui.
            </p>
            <Link href="/selecoes">
              <Button>Criar Primeira Seleção</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {processedSelections.map((selection) => (
            <Card key={selection.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selection.jobName}</CardTitle>
                    <CardDescription>
                      Criada em {new Date(selection.createdAt.seconds * 1000).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  </div>
                  <Badge variant={selection.status === 'active' ? 'default' : 'secondary'}>
                    {selection.status === 'active' ? 'Ativa' : 'Finalizada'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-600">
                      <strong>{selection.candidateCount}</strong> candidatos
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600">
                      <strong>{selection.completedCount}</strong> finalizadas
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-gray-600">
                      <strong>{selection.inProgressCount}</strong> em andamento
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-purple-500" />
                    <span className="text-sm text-gray-600">
                      <strong>{selection.totalResponses}</strong> respostas
                    </span>
                  </div>
                </div>

                {/* Tabela de Entrevistas */}
                {selection.interviews.length > 0 ? (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Entrevistas Realizadas</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidato</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Respostas</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selection.interviews.map((interview: Interview) => (
                          <TableRow key={interview.id}>
                            <TableCell className="font-medium">
                              {interview.candidateName || 'Nome não informado'}
                            </TableCell>
                            <TableCell>{interview.candidatePhone || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant={
                                interview.status === 'completed' ? 'default' :
                                interview.status === 'in_progress' ? 'secondary' : 'outline'
                              }>
                                {interview.status === 'completed' ? 'Finalizada' :
                                 interview.status === 'in_progress' ? 'Em Andamento' : 'Pendente'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {interview.responses?.length || 0} / {interview.totalQuestions || 0}
                            </TableCell>
                            <TableCell>
                              {interview.startTime ? new Date(interview.startTime).toLocaleDateString('pt-BR') : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewInterview(interview)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {interview.responses?.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePlayAudio(interview.responses[0].audioFile)}
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>Nenhuma entrevista realizada ainda</p>
                  </div>
                )}

                <div className="flex justify-end mt-6">
                  <Link href={`/relatorios/${selection.id}`}>
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Ver Relatório Detalhado
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Detalhes da Entrevista */}
      {selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Entrevista - {selectedInterview.candidateName}</CardTitle>
                  <CardDescription>
                    {selectedInterview.jobName} | {selectedInterview.candidatePhone}
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setSelectedInterview(null)}>
                  Fechar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="font-medium">Respostas da Entrevista</h4>
                {selectedInterview.responses?.length > 0 ? (
                  selectedInterview.responses.map((response, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-2">
                        <p className="font-medium text-sm text-gray-700">
                          Pergunta {index + 1}: {response.questionText}
                        </p>
                        <p className="text-gray-600">{response.responseText}</p>
                        {response.audioFile && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePlayAudio(response.audioFile)}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Reproduzir Áudio
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))
                ) : (
                  <p className="text-gray-500">Nenhuma resposta encontrada</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Player de Áudio */}
      {audioUrl && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border">
          <audio controls autoPlay src={audioUrl} className="w-64">
            Seu navegador não suporta o elemento de áudio.
          </audio>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setAudioUrl('')}
            className="mt-2 w-full"
          >
            Fechar Player
          </Button>
        </div>
      )}
    </div>
  );
}