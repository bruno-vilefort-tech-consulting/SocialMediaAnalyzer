import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Mic, 
  Play, 
  Pause, 
  Square, 
  ArrowRight, 
  ArrowLeft, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Volume2
} from "lucide-react";
import { useAudioRecorder, formatDuration } from "@/hooks/useAudio";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InterviewData {
  interview: {
    id: number;
    status: string;
    token: string;
  };
  selection: {
    name: string;
    deadline: string;
  };
  job: {
    title: string;
    description: string;
  };
  questions: Array<{
    id: number;
    questionText: string;
    maxTime: number;
    order: number;
  }>;
}

export default function InterviewPage() {
  const [, params] = useRoute("/interview/:token?");
  const token = params?.token;
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Map<number, File>>(new Map());
  const [timeLeft, setTimeLeft] = useState(0);
  const [isQuestionPlaying, setIsQuestionPlaying] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  
  const { toast } = useToast();
  const { isRecording, duration, audioBlob, startRecording, stopRecording, playAudio } = useAudioRecorder();

  const { data: interviewData, isLoading, error } = useQuery<InterviewData>({
    queryKey: ["/api/interview", token],
    enabled: !!token,
  });

  const startInterviewMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/interview/${token}/start`),
    onSuccess: () => {
      setShowWelcome(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao iniciar entrevista",
        variant: "destructive",
      });
    },
  });

  const saveResponseMutation = useMutation({
    mutationFn: ({ questionId, audioFile }: { questionId: number; audioFile: File }) => {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('questionId', questionId.toString());
      
      return fetch(`/api/interview/${token}/response`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
    },
    onSuccess: () => {
      toast({
        title: "Resposta salva",
        description: "Sua resposta foi gravada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao salvar resposta",
        variant: "destructive",
      });
    },
  });

  const completeInterviewMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/interview/${token}/complete`),
    onSuccess: () => {
      setShowComplete(true);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao finalizar entrevista",
        variant: "destructive",
      });
    },
  });

  // Timer effect for question time limit
  useEffect(() => {
    if (timeLeft > 0 && !showWelcome && !showComplete && !isRecording) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, showWelcome, showComplete, isRecording]);

  // Set initial time when question changes
  useEffect(() => {
    if (interviewData?.questions && !showWelcome && !showComplete) {
      const currentQuestion = interviewData.questions[currentQuestionIndex];
      if (currentQuestion) {
        setTimeLeft(currentQuestion.maxTime);
      }
    }
  }, [currentQuestionIndex, interviewData, showWelcome, showComplete]);

  const handleStartInterview = () => {
    startInterviewMutation.mutate();
  };

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      toast({
        title: "Erro de gravação",
        description: "Não foi possível acessar o microfone. Verifique as permissões.",
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = () => {
    stopRecording();
    
    if (audioBlob && interviewData?.questions) {
      const currentQuestion = interviewData.questions[currentQuestionIndex];
      const audioFile = new File([audioBlob], `response_${currentQuestion.id}.webm`, {
        type: 'audio/webm',
      });
      
      setResponses(prev => new Map(prev.set(currentQuestion.id, audioFile)));
      saveResponseMutation.mutate({
        questionId: currentQuestion.id,
        audioFile,
      });
    }
  };

  const handleNextQuestion = () => {
    if (interviewData?.questions && currentQuestionIndex < interviewData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Complete interview
      completeInterviewMutation.mutate();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handlePlayQuestion = () => {
    setIsQuestionPlaying(true);
    // In a real implementation, this would play the TTS audio
    setTimeout(() => {
      setIsQuestionPlaying(false);
    }, 3000);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Token Inválido</h1>
            <p className="text-slate-600">
              O link da entrevista é inválido ou expirou.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando entrevista...</p>
        </div>
      </div>
    );
  }

  if (error || !interviewData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Entrevista Não Encontrada</h1>
            <p className="text-slate-600">
              Não foi possível carregar os dados da entrevista.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Welcome Screen
  if (showWelcome) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-slate-100 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <div className="h-16 w-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Mic className="text-primary text-2xl" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Entrevista por Voz</h1>
            <p className="text-lg text-slate-600">
              {interviewData.job.title} - {interviewData.selection.name}
            </p>
          </div>
          
          <Card className="shadow-xl border border-slate-200 mb-8">
            <CardContent className="p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Instruções</h2>
              <div className="text-left space-y-4 text-slate-600">
                <div className="flex items-start">
                  <div className="h-6 w-6 bg-primary/10 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-xs font-medium text-primary">1</span>
                  </div>
                  <p>Você ouvirá {interviewData.questions.length} perguntas relacionadas à vaga</p>
                </div>
                <div className="flex items-start">
                  <div className="h-6 w-6 bg-primary/10 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-xs font-medium text-primary">2</span>
                  </div>
                  <p>Cada pergunta terá um tempo limite para resposta</p>
                </div>
                <div className="flex items-start">
                  <div className="h-6 w-6 bg-primary/10 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-xs font-medium text-primary">3</span>
                  </div>
                  <p>Clique em "Iniciar Resposta" quando estiver pronto</p>
                </div>
                <div className="flex items-start">
                  <div className="h-6 w-6 bg-primary/10 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-xs font-medium text-primary">4</span>
                  </div>
                  <p>Fale de forma clara e objetiva</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="bg-slate-100 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-center space-x-8 text-sm text-slate-600">
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4" />
                Tempo estimado: {Math.round(interviewData.questions.reduce((sum, q) => sum + q.maxTime, 0) / 60)} min
              </div>
              <div className="flex items-center">
                <AlertCircle className="mr-2 h-4 w-4" />
                {interviewData.questions.length} perguntas
              </div>
              <div className="flex items-center">
                <Mic className="mr-2 h-4 w-4" />
                Gravação de voz
              </div>
            </div>
          </div>
          
          <Button 
            onClick={handleStartInterview}
            disabled={startInterviewMutation.isPending}
            className="px-8 py-3 text-lg font-medium"
          >
            <Play className="mr-2 h-5 w-5" />
            {startInterviewMutation.isPending ? "Iniciando..." : "Iniciar Entrevista"}
          </Button>
        </div>
      </div>
    );
  }

  // Complete Screen
  if (showComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-slate-100 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <div className="h-16 w-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-green-600 text-2xl" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Entrevista Concluída!</h1>
            <p className="text-lg text-slate-600">Obrigado por participar do processo seletivo</p>
          </div>
          
          <Card className="shadow-xl border border-slate-200 mb-8">
            <CardContent className="p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Próximos Passos</h2>
              <div className="text-slate-600 space-y-3">
                <p>✅ Suas respostas foram gravadas e enviadas com sucesso</p>
                <p>🤖 Nossa IA analisará suas respostas automaticamente</p>
                <p>📧 Entraremos em contato em até 5 dias úteis</p>
                <p>💼 Continue acompanhando outras oportunidades</p>
              </div>
            </CardContent>
          </Card>
          
          <Button 
            onClick={() => window.close()}
            className="px-8 py-3 text-lg font-medium"
          >
            Finalizar
          </Button>
        </div>
      </div>
    );
  }

  // Interview Question Screen
  const currentQuestion = interviewData.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / interviewData.questions.length) * 100;
  const hasResponse = responses.has(currentQuestion.id);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-600">Progresso</span>
            <span className="text-sm text-slate-600">
              Pergunta {currentQuestionIndex + 1} de {interviewData.questions.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Question Card */}
        <Card className="shadow-xl border border-slate-200 mb-8">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Pergunta {currentQuestionIndex + 1}
              </h2>
              <p className="text-lg text-slate-700 leading-relaxed">
                {currentQuestion.questionText}
              </p>
            </div>
            
            {/* Audio Player for Question */}
            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center space-x-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handlePlayQuestion}
                  disabled={isQuestionPlaying}
                  className="h-12 w-12 rounded-full"
                >
                  {isQuestionPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
                <div className="flex-1">
                  <div className="h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                    <span className="text-sm text-slate-500">
                      {isQuestionPlaying ? "Reproduzindo pergunta..." : "Clique para ouvir a pergunta"}
                    </span>
                  </div>
                </div>
                <span className="text-sm text-slate-500">
                  {formatDuration(Math.floor(currentQuestion.maxTime))}
                </span>
              </div>
            </div>
            
            {/* Recording Controls */}
            <div className="text-center">
              <div className="space-y-4">
                {!isRecording && !hasResponse && (
                  <Button 
                    onClick={handleStartRecording}
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-3"
                  >
                    <Mic className="mr-2 h-5 w-5" />
                    Iniciar Resposta
                  </Button>
                )}
                
                {isRecording && (
                  <div>
                    <div className="flex items-center justify-center space-x-4 mb-4">
                      <div className="h-4 w-4 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-red-600 font-medium">Gravando...</span>
                      <div className="text-slate-600">{formatDuration(duration)}</div>
                    </div>
                    
                    <Button 
                      onClick={handleStopRecording}
                      className="bg-slate-500 hover:bg-slate-600 text-white px-4 py-2"
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Finalizar Gravação
                    </Button>
                  </div>
                )}
                
                {hasResponse && (
                  <div className="space-y-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="mr-1 h-4 w-4" />
                      Resposta gravada
                    </Badge>
                    <div>
                      <Button 
                        variant="outline"
                        onClick={handleStartRecording}
                        className="mr-2"
                      >
                        <Mic className="mr-2 h-4 w-4" />
                        Gravar Novamente
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 text-sm text-slate-500 flex items-center justify-center">
                <Clock className="mr-1 h-4 w-4" />
                Tempo restante: {formatDuration(timeLeft)}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Navigation */}
        <div className="flex justify-between">
          <Button 
            variant="outline"
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>
          <Button 
            onClick={handleNextQuestion}
            disabled={!hasResponse && !audioBlob}
          >
            {currentQuestionIndex === interviewData.questions.length - 1 ? "Finalizar" : "Próxima"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
