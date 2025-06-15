import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle, Clock, Calendar, Phone, Mail, FileText, User, Briefcase, ChevronRight, Play, Pause, Square, Volume2 } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { useAudioRecorder } from "@/hooks/useAudio";

interface Selection {
  id: number;
  name: string;
  jobName?: string;
  status: string;
  createdAt: { seconds: number };
  deadline?: string;
}

interface Interview {
  id: string;
  selectionId: number;
  selectionName: string;
  candidateId: number;
  candidateName: string;
  candidatePhone: string;
  jobName: string;
  status: 'pending' | 'in_progress' | 'completed';
  responses: any[];
  totalQuestions: number;
  answeredQuestions: number;
}

interface Response {
  questionId: number;
  questionText: string;
  responseText?: string;
  audioFile?: string;
  timestamp: string;
}

export default function ReportsPage() {
  const [selectedSelection, setSelectedSelection] = useState<number | null>(null);
  const { playAudio: playAudioHook, pauseAudio, stopAudio, isPlaying, currentAudioUrl } = useAudioRecorder();
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  const { data: selections = [] } = useQuery({
    queryKey: ['/api/selections'],
  });

  const { data: interviews = [] } = useQuery({
    queryKey: ['/api/interview-responses'],
  });

  // Filtrar seleções válidas e calcular estatísticas
  const validSelections = Array.isArray(selections) ? selections.filter((selection: any) => 
    selection && selection.name && selection.id
  ) : [];

  const validInterviews = Array.isArray(interviews) ? interviews.filter((interview: Interview) => 
    interview && interview.candidateName && interview.candidatePhone
  ) : [];

  const getSelectionStats = (selectionId: number) => {
    const selectionInterviews = validInterviews.filter(interview => 
      interview.selectionId === selectionId
    );
    
    const completed = selectionInterviews.filter(i => i.status === 'completed').length;
    const inProgress = selectionInterviews.filter(i => i.status === 'in_progress').length;
    const pending = selectionInterviews.filter(i => i.status === 'pending').length;
    
    return { completed, inProgress, pending, total: selectionInterviews.length };
  };

  const getSelectionCandidates = (selectionId: number) => {
    // Filtrar apenas entrevistas da seleção específica e do Daniel Braga/Moreira
    return validInterviews.filter(interview => {
      const isCorrectSelection = interview.selectionId === selectionId;
      const isDanielCandidate = interview.candidateName && 
        (interview.candidateName.includes('Daniel') || 
         interview.candidatePhone === '11984316526' ||
         interview.candidatePhone === '5511984316526');
      
      return isCorrectSelection && isDanielCandidate;
    });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Data não disponível';
    
    let date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
  };

  const handlePlayAudio = (audioFile: string) => {
    if (audioFile) {
      // Garantir que o caminho do áudio está correto
      let audioUrl = audioFile;
      if (!audioFile.startsWith('http') && !audioFile.startsWith('/uploads/')) {
        audioUrl = `/uploads/${audioFile}`;
      }
      console.log('🎵 Reproduzindo áudio:', audioUrl);
      playAudioHook(audioUrl);
    }
  };

  // Vista: Lista de seleções
  if (!selectedSelection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Relatórios de Entrevistas</h1>
            <p className="text-muted-foreground">Acompanhe o progresso das seleções e entrevistas</p>
          </div>
        </div>

        {/* Lista horizontal de seleções - uma linha por seleção */}
        <div className="space-y-3">
          {validSelections.map((selection: any) => {
            const stats = getSelectionStats(selection.id);
            
            return (
              <Card 
                key={selection.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedSelection(selection.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between w-full">
                    {/* Nome da vaga */}
                    <div className="flex items-center space-x-4 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-lg truncate">
                          {selection.jobName || selection.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Criado em {formatDate(selection.createdAt)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Status */}
                    <div className="flex items-center space-x-6">
                      <Badge variant={selection.status === 'enviado' ? 'default' : 'secondary'}>
                        {selection.status}
                      </Badge>
                      
                      {/* Estatísticas inline */}
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="font-medium">{stats.completed}</span>
                          <span className="text-muted-foreground">Finalizadas</span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="font-medium">{stats.inProgress}</span>
                          <span className="text-muted-foreground">Em andamento</span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                          <span className="font-medium">{stats.pending}</span>
                          <span className="text-muted-foreground">Pendentes</span>
                        </div>
                        
                        <div className="flex items-center space-x-1 border-l pl-4 ml-4">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{stats.total}</span>
                          <span className="text-muted-foreground">Total</span>
                        </div>
                      </div>
                      
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {validSelections.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma seleção encontrada</h3>
              <p className="text-muted-foreground text-center">
                Crie uma nova seleção para começar a acompanhar entrevistas.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Vista: Lista de candidatos da seleção
  if (selectedSelection && !selectedCandidate) {
    const selection = validSelections.find((s: any) => s.id === selectedSelection);
    const candidates = getSelectionCandidates(selectedSelection);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => setSelectedSelection(null)}
              className="flex items-center space-x-2"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              <span>Voltar</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {selection?.jobName || selection?.name}
              </h1>
              <p className="text-muted-foreground">
                {candidates.length} candidatos entrevistados
              </p>
            </div>
          </div>
        </div>

        {/* Lista de candidatos */}
        <div className="grid gap-4">
          {candidates.map((interview: Interview) => (
            <Card 
              key={interview.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedCandidate(interview.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-lg">{interview.candidateName}</h3>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Phone className="h-4 w-4" />
                          <span>{interview.candidatePhone}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <FileText className="h-4 w-4" />
                          <span>{interview.answeredQuestions}/{interview.totalQuestions} respostas</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <Badge 
                      variant={
                        interview.status === 'completed' ? 'default' :
                        interview.status === 'in_progress' ? 'secondary' : 'outline'
                      }
                    >
                      {interview.status === 'completed' ? 'Finalizada' :
                       interview.status === 'in_progress' ? 'Em andamento' : 'Pendente'}
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {candidates.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum candidato encontrado</h3>
              <p className="text-muted-foreground text-center">
                Ainda não há entrevistas realizadas para esta seleção.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Vista: Detalhes do candidato com respostas
  if (selectedCandidate) {
    const interview = validInterviews.find(i => i.id === selectedCandidate);
    const selection = validSelections.find((s: any) => s.id === selectedSelection);
    
    if (!interview) {
      return (
        <div className="space-y-6">
          <Button 
            variant="outline" 
            onClick={() => setSelectedCandidate(null)}
            className="flex items-center space-x-2"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            <span>Voltar</span>
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Entrevista não encontrada</h3>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => setSelectedCandidate(null)}
              className="flex items-center space-x-2"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              <span>Voltar</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {interview.candidateName}
              </h1>
              <p className="text-muted-foreground">
                {selection?.jobName || selection?.name} • {interview.candidatePhone}
              </p>
            </div>
          </div>
          
          <Badge 
            variant={
              interview.status === 'completed' ? 'default' :
              interview.status === 'in_progress' ? 'secondary' : 'outline'
            }
            className="text-sm px-3 py-1"
          >
            {interview.status === 'completed' ? 'Entrevista Finalizada' :
             interview.status === 'in_progress' ? 'Em Andamento' : 'Pendente'}
          </Badge>
        </div>

        {/* Informações do candidato */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Informações do Candidato</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nome</label>
              <p className="text-lg">{interview.candidateName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Telefone</label>
              <p className="text-lg">{interview.candidatePhone}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Progresso</label>
              <p className="text-lg">{interview.answeredQuestions}/{interview.totalQuestions} respostas</p>
            </div>
          </CardContent>
        </Card>

        {/* Respostas da entrevista */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Respostas da Entrevista</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {interview.responses && interview.responses.length > 0 ? (
              interview.responses.map((response: Response, index: number) => (
                <div key={index} className="border rounded-lg p-4 space-y-3 bg-white dark:bg-gray-900">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-blue-600 dark:text-blue-400 mb-2">
                        Pergunta {(response.questionId || 0) + 1}
                      </h4>
                      <p className="text-base mb-3 font-medium">{response.questionText}</p>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-sm text-blue-900 dark:text-blue-100">Resposta do Daniel</h5>
                      {response.audioFile && (
                        <div className="flex items-center space-x-2">
                          {!isPlaying || currentAudioUrl !== (response.audioFile.startsWith('/uploads/') ? response.audioFile : `/uploads/${response.audioFile}`) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePlayAudio(response.audioFile!)}
                              className="flex items-center space-x-2 bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-700"
                            >
                              <Play className="h-4 w-4" />
                              <span>Play</span>
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={pauseAudio}
                                className="flex items-center space-x-2 bg-orange-100 hover:bg-orange-200 border-orange-300 text-orange-700"
                              >
                                <Pause className="h-4 w-4" />
                                <span>Pause</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={stopAudio}
                                className="flex items-center space-x-2 bg-red-100 hover:bg-red-200 border-red-300 text-red-700"
                              >
                                <Square className="h-4 w-4" />
                                <span>Stop</span>
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {response.responseText ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Transcrição:</p>
                        <p className="text-sm leading-relaxed bg-white dark:bg-gray-800 p-3 rounded border italic">
                          "{response.responseText}"
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-blue-600 dark:text-blue-300 italic">
                        Aguardando transcrição...
                      </p>
                    )}
                    
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-3 flex items-center space-x-2">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(response.timestamp).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma resposta encontrada</h3>
                <p className="text-muted-foreground">
                  Esta entrevista ainda não possui respostas registradas.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}