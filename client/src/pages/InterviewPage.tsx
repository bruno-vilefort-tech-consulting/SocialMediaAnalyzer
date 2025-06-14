import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Mic, 
  Play, 
  Pause, 
  Square, 
  ArrowRight, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Volume2,
  MicOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Question {
  id: number;
  perguntaCandidato: string;
  numeroPergunta: number;
}

interface InterviewData {
  interview: {
    id: number;
    status: string;
    token: string;
    candidateId: number;
  };
  candidate: {
    name: string;
    email: string;
  };
  selection: {
    nomeSelecao: string;
  };
  job: {
    nomeVaga: string;
    descricaoVaga: string;
  };
  questions: Question[];
}

export default function InterviewPage() {
  const [, params] = useRoute("/interview/:token");
  const token = params?.token;
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Map<number, Blob>>(new Map());
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutos = 180 segundos
  const [isRecording, setIsRecording] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingQuestion, setIsPlayingQuestion] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const { toast } = useToast();

  // Buscar dados da entrevista
  const { data: interviewData, isLoading, error } = useQuery<InterviewData>({
    queryKey: [`/api/interview/${token}`],
    enabled: !!token,
  });



  // Verificar se entrevista já foi feita
  useEffect(() => {
    if (interviewData?.interview.status === 'completed') {
      setShowComplete(true);
      setShowWelcome(false);
    } else if (interviewData?.interview.status === 'expired') {
      toast({
        title: "Entrevista expirada",
        description: "Esta entrevista não está mais disponível",
        variant: "destructive"
      });
    }
  }, [interviewData]);

  // Timer para cada pergunta (3 minutos)
  useEffect(() => {
    if (hasStarted && !showWelcome && !showComplete && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Tempo esgotado, pular para próxima pergunta
            handleNextQuestion();
            return 180;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [hasStarted, showWelcome, showComplete, timeLeft]);

  // Inicializar gravação de áudio
  const initializeAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setResponses(prev => new Map(prev.set(currentQuestionIndex, audioBlob)));
        audioChunksRef.current = [];
        
        // Salvar resposta automaticamente
        saveResponse(audioBlob);
      };
    } catch (error) {
      toast({
        title: "Erro de áudio",
        description: "Não foi possível acessar o microfone",
        variant: "destructive"
      });
    }
  };

  // Iniciar entrevista
  const handleStartInterview = async () => {
    try {
      await initializeAudio();
      setHasStarted(true);
      setShowWelcome(false);
      setTimeLeft(180);
      
      // Reproduzir primeira pergunta com TTS
      await playQuestionAudio(interviewData!.questions[0].perguntaCandidato);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a entrevista",
        variant: "destructive"
      });
    }
  };

  // Reproduzir pergunta com TTS da OpenAI
  const playQuestionAudio = async (questionText: string) => {
    try {
      setIsPlayingQuestion(true);
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: questionText })
      });
      
      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => {
          setIsPlayingQuestion(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      }
    } catch (error) {
      setIsPlayingQuestion(false);
      toast({
        title: "Erro de áudio",
        description: "Não foi possível reproduzir a pergunta",
        variant: "destructive"
      });
    }
  };

  // Iniciar gravação
  const startRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  // Parar gravação
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Salvar resposta
  const saveResponse = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'response.webm');
      formData.append('questionId', interviewData!.questions[currentQuestionIndex].id.toString());
      formData.append('duration', (180 - timeLeft).toString());

      await fetch(`/api/interview/${token}/response`, {
        method: 'POST',
        body: formData
      });

      toast({
        title: "Resposta salva",
        description: "Sua resposta foi gravada com sucesso"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar resposta",
        variant: "destructive"
      });
    }
  };

  // Próxima pergunta
  const handleNextQuestion = async () => {
    if (isRecording) {
      stopRecording();
    }

    if (currentQuestionIndex < interviewData!.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setTimeLeft(180);
      
      // Reproduzir próxima pergunta
      setTimeout(() => {
        playQuestionAudio(interviewData!.questions[currentQuestionIndex + 1].perguntaCandidato);
      }, 1000);
    } else {
      // Finalizar entrevista
      await finalizeInterview();
    }
  };

  // Finalizar entrevista
  const finalizeInterview = async () => {
    try {
      await fetch(`/api/interview/${token}/complete`, {
        method: 'POST'
      });
      
      setShowComplete(true);
      setHasStarted(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao finalizar entrevista",
        variant: "destructive"
      });
    }
  };

  // Formatação do tempo
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando entrevista...</p>
        </div>
      </div>
    );
  }

  if (error || !interviewData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Entrevista não encontrada</h2>
            <p className="text-gray-600">
              Este link de entrevista não é válido ou expirou.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Obrigado por responder todas as perguntas!
            </h1>
            <p className="text-gray-600 text-lg">
              Nós avaliaremos suas respostas e retornaremos o mais breve possível.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              Entrevista Virtual - {interviewData.job.nomeVaga}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">
                Olá {interviewData.candidate.name}, vamos iniciar sua entrevista?
              </h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-gray-700">
                  <strong>Instruções importantes:</strong>
                </p>
                <ul className="text-left mt-2 space-y-1 text-sm text-gray-600">
                  <li>• Esteja em um ambiente sem interrupções e barulhos</li>
                  <li>• Fale claramente cada resposta após a pergunta</li>
                  <li>• Cada pergunta tem limite de 3 minutos para resposta</li>
                  <li>• Total de {interviewData.questions.length} perguntas</li>
                  <li>• Permita o acesso ao microfone quando solicitado</li>
                </ul>
              </div>
            </div>
            
            <Button 
              onClick={handleStartInterview}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
            >
              Iniciar Entrevista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = interviewData.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / interviewData.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {interviewData.job.nomeVaga}
          </h1>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
            <Badge variant="outline">
              Pergunta {currentQuestionIndex + 1} de {interviewData.questions.length}
            </Badge>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Pergunta {currentQuestion.numeroPergunta}
              {isPlayingQuestion && (
                <Badge variant="secondary" className="ml-2">
                  Reproduzindo...
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-gray-700 mb-4">
              {currentQuestion.perguntaCandidato}
            </p>
            
            <Button
              variant="outline"
              onClick={() => playQuestionAudio(currentQuestion.perguntaCandidato)}
              disabled={isPlayingQuestion}
              className="mb-4"
            >
              <Volume2 className="w-4 h-4 mr-2" />
              {isPlayingQuestion ? "Reproduzindo..." : "Ouvir novamente"}
            </Button>
          </CardContent>
        </Card>

        {/* Recording Controls */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-4">
                {!isRecording ? (
                  <Button
                    onClick={startRecording}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 text-lg"
                    disabled={isPlayingQuestion}
                  >
                    <Mic className="w-6 h-6 mr-2" />
                    Iniciar Gravação
                  </Button>
                ) : (
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    className="px-8 py-4 text-lg"
                  >
                    <Square className="w-6 h-6 mr-2" />
                    Parar Gravação
                  </Button>
                )}
              </div>

              {isRecording && (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-600 font-medium">Gravando...</span>
                </div>
              )}

              {responses.has(currentQuestionIndex) && (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span>Resposta gravada</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-center">
          <Button
            onClick={handleNextQuestion}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
            disabled={isRecording}
          >
            {currentQuestionIndex < interviewData.questions.length - 1 ? (
              <>
                Próxima Pergunta
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              "Finalizar Entrevista"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}