import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Play, Pause, RotateCcw, Send } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function InterviewDemoPage() {
  const { toast } = useToast();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [responses, setResponses] = useState<boolean[]>([]);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isLoadingTTS, setIsLoadingTTS] = useState(false);
  
  const recordingRef = useRef<number>();
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Buscar dados reais do sistema
  const { data: jobs } = useQuery({
    queryKey: ['/api/jobs'],
    enabled: false // Desabilita por enquanto para usar dados demo mais realistas
  });

  const { data: questions } = useQuery({
    queryKey: ['/api/questions', '174986729964277'], // ID da vaga de faxineira
    enabled: false // Desabilita por enquanto para usar perguntas demo
  });

  // Usar perguntas reais da vaga de faxineira
  const realQuestions = [
    "Você tem experiência anterior em limpeza e manutenção? Conte-me sobre ela.",
    "Como você organiza sua rotina de trabalho para garantir que todas as tarefas sejam cumpridas?",
    "Você conhece os produtos de limpeza e seus usos específicos? Pode dar alguns exemplos?",
    "Como você lida com situações em que precisa trabalhar sozinho(a) por longos períodos?",
    "Você tem disponibilidade para trabalhar em diferentes horários conforme a necessidade da empresa?"
  ];

  const jobInfo = {
    company: "Grupo Maximus",
    position: "Faxineira",
    interviewer: "Sistema de IA"
  };

  useEffect(() => {
    setResponses(new Array(realQuestions.length).fill(false));
  }, []);

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Mutation para TTS da OpenAI
  const ttsMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest('/api/tts', {
        method: 'POST',
        body: JSON.stringify({ text }),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.blob();
    }
  });

  // Mutation para upload de áudio no Firebase
  const uploadAudioMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData();
      formData.append('audio', audioBlob, `interview_${Date.now()}.webm`);
      
      const response = await apiRequest('/api/upload-audio', {
        method: 'POST',
        body: formData
      });
      return response.json();
    }
  });

  // Mutation para transcrição
  const transcribeMutation = useMutation({
    mutationFn: async (audioUrl: string) => {
      const response = await apiRequest('/api/transcribe', {
        method: 'POST',
        body: JSON.stringify({ audioUrl }),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    }
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setHasRecorded(false);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone. Verifique as permissões.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setHasRecorded(true);
    }
  };

  const playRecording = async () => {
    if (isLoadingTTS || isPlaying) return;
    
    setIsLoadingTTS(true);
    try {
      const audioBlob = await ttsMutation.mutateAsync(realQuestions[currentQuestion]);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (error) {
      console.error('Erro no TTS:', error);
      toast({
        title: "Erro",
        description: "Não foi possível reproduzir a pergunta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTTS(false);
    }
  };

  const restartRecording = () => {
    setRecordingTime(0);
    setHasRecorded(false);
    setIsRecording(false);
    setAudioBlob(null);
  };

  const submitResponse = async () => {
    if (!audioBlob) {
      toast({
        title: "Erro",
        description: "Você precisa gravar uma resposta antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    try {
      // 1. Upload do áudio para Firebase
      toast({ title: "Processando", description: "Enviando áudio..." });
      const uploadResult = await uploadAudioMutation.mutateAsync(audioBlob);
      
      // 2. Transcrição do áudio
      toast({ title: "Processando", description: "Transcrevendo áudio..." });
      const transcriptionResult = await transcribeMutation.mutateAsync(uploadResult.audioUrl);
      
      // 3. Salvar resposta no banco
      const responseData = {
        questionId: currentQuestion + 1,
        questionText: realQuestions[currentQuestion],
        audioUrl: uploadResult.audioUrl,
        transcription: transcriptionResult.transcription,
        duration: recordingTime,
        candidateName: "Candidato Demo", // Em produção seria o nome real do candidato
        jobTitle: jobInfo.position
      };

      await apiRequest('/api/demo-responses', {
        method: 'POST',
        body: JSON.stringify(responseData),
        headers: { 'Content-Type': 'application/json' }
      });

      // 4. Atualizar interface
      const newResponses = [...responses];
      newResponses[currentQuestion] = true;
      setResponses(newResponses);
      
      toast({
        title: "Sucesso",
        description: "Resposta salva com sucesso!",
      });
      
      if (currentQuestion < realQuestions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setHasRecorded(false);
        setRecordingTime(0);
        setAudioBlob(null);
      } else {
        setInterviewCompleted(true);
      }
    } catch (error) {
      console.error('Erro ao processar resposta:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar sua resposta. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const progressPercentage = ((currentQuestion + (hasRecorded ? 1 : 0)) / realQuestions.length) * 100;

  if (!interviewStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-blue-700">
              Entrevista Virtual
            </CardTitle>
            <div className="space-y-2 mt-4">
              <p className="text-lg font-semibold">{jobInfo.company}</p>
              <p className="text-md text-gray-600">Vaga: {jobInfo.position}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800 mb-4">
                <strong>📱 Importante:</strong> Para esta entrevista, recomenda-se que você esteja em um ambiente silencioso e livre de interrupções, a fim de garantir o pleno funcionamento e compreensão do sistema.
              </p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Como funciona:</h3>
              <ul className="space-y-2 text-sm">
                <li>• Você ouvirá {realQuestions.length} perguntas em áudio</li>
                <li>• Grave suas respostas usando o microfone</li>
                <li>• O sistema analisará suas respostas automaticamente</li>
                <li>• Duração estimada: 10-15 minutos</li>
              </ul>
            </div>

            <Button 
              onClick={() => setInterviewStarted(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
              size="lg"
            >
              Iniciar Entrevista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (interviewCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-green-700">
              ✅ Entrevista Concluída!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="font-semibold text-lg mb-4">Obrigado por participar!</h3>
              <p className="text-gray-600 mb-4">
                Suas respostas foram gravadas e enviadas com sucesso. 
                Nossa equipe analisará seu perfil e entrará em contato em breve.
              </p>
              <div className="flex justify-center space-x-4 text-sm text-gray-500">
                <span>✓ {realQuestions.length} perguntas respondidas</span>
                <span>✓ Análise automática iniciada</span>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Próximos passos:</strong> Você receberá um email de confirmação 
                e nossa equipe entrará em contato em até 48 horas.
              </p>
            </div>

            <Button 
              onClick={() => window.location.href = '/'}
              variant="outline"
              className="mt-4"
            >
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl">{jobInfo.company}</CardTitle>
                <p className="text-gray-600">{jobInfo.position}</p>
              </div>
              <Badge variant="outline">
                Pergunta {currentQuestion + 1} de {realQuestions.length}
              </Badge>
            </div>
            <Progress value={progressPercentage} className="mt-4" />
          </CardHeader>
        </Card>

        {/* Question Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Pergunta {currentQuestion + 1}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-gray-800">{realQuestions[currentQuestion]}</p>
            </div>
            
            <div className="flex justify-center">
              <Button 
                onClick={playRecording}
                disabled={isPlaying}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? "Reproduzindo pergunta..." : "🔊 Ouvir pergunta"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recording Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sua Resposta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Recording Timer */}
            <div className="text-center">
              <div className="text-3xl font-mono text-gray-700 mb-2">
                {formatTime(recordingTime)}
              </div>
              {isRecording && (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-600 font-medium">Gravando...</span>
                </div>
              )}
            </div>

            {/* Recording Controls */}
            <div className="flex justify-center gap-4">
              {!isRecording && !hasRecorded && (
                <Button 
                  onClick={startRecording}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3"
                  size="lg"
                >
                  <Mic className="w-5 h-5 mr-2" />
                  Iniciar Gravação
                </Button>
              )}

              {isRecording && (
                <Button 
                  onClick={stopRecording}
                  variant="outline"
                  className="border-red-500 text-red-600 px-8 py-3"
                  size="lg"
                >
                  <MicOff className="w-5 h-5 mr-2" />
                  Parar Gravação
                </Button>
              )}

              {hasRecorded && (
                <div className="flex gap-3">
                  <Button 
                    onClick={playRecording}
                    disabled={isPlaying}
                    variant="outline"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlaying ? "Reproduzindo" : "Reproduzir"}
                  </Button>
                  
                  <Button 
                    onClick={restartRecording}
                    variant="outline"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Regravar
                  </Button>
                  
                  <Button 
                    onClick={submitResponse}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {currentQuestion === realQuestions.length - 1 ? "Finalizar" : "Próxima"}
                  </Button>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-600">
                {!hasRecorded 
                  ? "Clique em 'Iniciar Gravação' e responda à pergunta. Fale de forma clara e natural."
                  : "Você pode reproduzir sua gravação, regravar se necessário, ou enviar para a próxima pergunta."
                }
              </p>
            </div>

            {/* Response Progress */}
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-2">Progresso das respostas:</p>
              <div className="flex gap-2">
                {responses.map((completed, index) => (
                  <div 
                    key={index}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      completed 
                        ? 'bg-green-500 text-white' 
                        : index === currentQuestion 
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                ))}
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}