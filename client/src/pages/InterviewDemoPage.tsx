import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Play, Pause, RotateCcw, Send } from 'lucide-react';

export default function InterviewDemoPage() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [responses, setResponses] = useState<boolean[]>([]);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  
  const recordingRef = useRef<number>();
  const audioRef = useRef<HTMLAudioElement>(null);

  const demoQuestions = [
    "Conte-me sobre sua experiência profissional e como ela se relaciona com esta vaga.",
    "Quais são seus principais pontos fortes e como eles podem contribuir para nossa empresa?",
    "Descreva uma situação desafiadora que você enfrentou no trabalho e como a resolveu.",
    "Onde você se vê profissionalmente daqui a 5 anos?",
    "Por que você tem interesse em trabalhar conosco especificamente?"
  ];

  const jobInfo = {
    company: "Grupo Maximus",
    position: "Faxineira",
    interviewer: "Sistema de IA"
  };

  useEffect(() => {
    setResponses(new Array(demoQuestions.length).fill(false));
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

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    setHasRecorded(false);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setHasRecorded(true);
  };

  const playRecording = () => {
    setIsPlaying(true);
    // Simular reprodução de áudio
    setTimeout(() => setIsPlaying(false), 3000);
  };

  const restartRecording = () => {
    setRecordingTime(0);
    setHasRecorded(false);
    setIsRecording(false);
  };

  const submitResponse = () => {
    const newResponses = [...responses];
    newResponses[currentQuestion] = true;
    setResponses(newResponses);
    
    if (currentQuestion < demoQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setHasRecorded(false);
      setRecordingTime(0);
    } else {
      setInterviewCompleted(true);
    }
  };

  const progressPercentage = ((currentQuestion + (hasRecorded ? 1 : 0)) / demoQuestions.length) * 100;

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
                <li>• Você ouvirá {demoQuestions.length} perguntas em áudio</li>
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
                <span>✓ {demoQuestions.length} perguntas respondidas</span>
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
                Pergunta {currentQuestion + 1} de {demoQuestions.length}
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
              <p className="text-gray-800">{demoQuestions[currentQuestion]}</p>
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
                    {currentQuestion === demoQuestions.length - 1 ? "Finalizar" : "Próxima"}
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