import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Play, CheckCircle2, Clock, User, MessageSquare } from "lucide-react";
import { Link } from "wouter";

interface InterviewResponse {
  id: string;
  interviewId: string;
  candidateName: string;
  candidatePhone: string;
  status: string;
  responses: Array<{
    questionText: string;
    responseText: string;
    audioUrl?: string;
    timestamp: string;
  }>;
  totalQuestions: number;
  answeredQuestions: number;
}

export default function InterviewDetailsPage() {
  const [match, params] = useRoute("/relatorios/:selectionId");
  const [selectedCandidate, setSelectedCandidate] = useState<InterviewResponse | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const selectionId = params?.selectionId;

  const { data: selection } = useQuery({
    queryKey: [`/api/selections/${selectionId}`],
    enabled: !!selectionId,
  });

  const { data: interviews = [], isLoading } = useQuery({
    queryKey: [`/api/selections/${selectionId}/results`],
    enabled: !!selectionId,
  });

  console.log("📊 Dados da seleção:", { selectionId, interviews: interviews?.length, firstInterview: interviews?.[0] });

  const playAudio = (audioUrl: string) => {
    if (currentAudio) {
      currentAudio.pause();
    }
    
    const audio = new Audio(`/uploads/${audioUrl}`);
    setCurrentAudio(audio);
    audio.play().catch(error => {
      console.error('Erro ao reproduzir áudio:', error);
    });
  };

  const getCompletionStatus = (interview: InterviewResponse) => {
    const percentage = (interview.answeredQuestions / interview.totalQuestions) * 100;
    if (percentage === 100) return { text: "Completa", color: "bg-green-500", variant: "default" as const };
    if (percentage > 0) return { text: "Parcial", color: "bg-yellow-500", variant: "secondary" as const };
    return { text: "Não iniciada", color: "bg-gray-500", variant: "outline" as const };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!selection) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Seleção não encontrada</h2>
        <p className="text-gray-600 mb-4">A seleção solicitada não existe ou você não tem acesso a ela.</p>
        <Link href="/relatorios">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar aos Relatórios
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/relatorios">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{selection.jobName}</h1>
          <p className="text-gray-600">Relatório detalhado das entrevistas</p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{interviews.length}</p>
                <p className="text-sm text-gray-600">Total Candidatos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {interviews.filter((i: InterviewResponse) => i.status === 'completed').length}
                </p>
                <p className="text-sm text-gray-600">Completas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  {interviews.filter((i: InterviewResponse) => i.status !== 'completed').length}
                </p>
                <p className="text-sm text-gray-600">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {interviews.reduce((acc: number, i: InterviewResponse) => acc + i.answeredQuestions, 0)}
                </p>
                <p className="text-sm text-gray-600">Respostas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Candidatos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Candidatos</CardTitle>
          <CardDescription>
            Clique no nome do candidato para ver os detalhes da entrevista
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Respostas</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.map((interview: any) => {
                // Usar dados reais do Firebase em vez da interface InterviewResponse
                const candidateName = interview.candidate?.name || 'Nome não disponível';
                const candidatePhone = interview.candidate?.whatsapp || interview.candidate?.phone || 'Telefone não disponível';
                const interviewStatus = interview.interview?.status || 'pending';
                const responsesCount = interview.responses?.length || 0;
                
                const statusText = interviewStatus === 'completed' ? 'Completa' : 
                                 interviewStatus === 'in_progress' ? 'Em andamento' : 'Pendente';
                const statusVariant = interviewStatus === 'completed' ? 'default' : 
                                     interviewStatus === 'in_progress' ? 'secondary' : 'outline';
                
                return (
                  <TableRow key={interview.interview?.id || Math.random()}>
                    <TableCell className="font-medium">{candidateName}</TableCell>
                    <TableCell>{candidatePhone}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant}>{statusText}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${interviewStatus === 'completed' ? 'bg-green-500' : interviewStatus === 'in_progress' ? 'bg-yellow-500' : 'bg-gray-400'}`}
                            style={{ width: `${interviewStatus === 'completed' ? 100 : responsesCount > 0 ? 50 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {interview.answeredQuestions}/{interview.totalQuestions}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{interview.responses.length} respostas</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedCandidate(interview)}
                            disabled={interview.responses.length === 0}
                          >
                            Ver Detalhes
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Entrevista - {interview.candidateName}</DialogTitle>
                            <DialogDescription>
                              Respostas detalhadas da entrevista
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedCandidate && (
                            <div className="space-y-6">
                              {selectedCandidate.responses.map((response, index) => (
                                <Card key={index}>
                                  <CardHeader>
                                    <CardTitle className="text-lg">
                                      Pergunta {index + 1}
                                    </CardTitle>
                                    <CardDescription className="text-base">
                                      {response.questionText}
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="font-medium text-gray-900 mb-2">Resposta:</h4>
                                        <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                                          {response.responseText || "Sem transcrição disponível"}
                                        </p>
                                      </div>
                                      
                                      {response.audioUrl && (
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => playAudio(response.audioUrl!)}
                                          >
                                            <Play className="h-4 w-4 mr-2" />
                                            Ouvir Áudio
                                          </Button>
                                          <span className="text-sm text-gray-500">
                                            {new Date(response.timestamp).toLocaleString('pt-BR')}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                              
                              {selectedCandidate.responses.length === 0 && (
                                <div className="text-center py-8">
                                  <p className="text-gray-500">Nenhuma resposta registrada para este candidato.</p>
                                </div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {interviews.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhuma entrevista encontrada para esta seleção.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}