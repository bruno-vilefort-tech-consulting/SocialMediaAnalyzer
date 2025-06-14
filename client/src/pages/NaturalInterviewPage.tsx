import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Volume2, VolumeX, MessageCircle, CheckCircle, Loader2, Play, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Componente de ondas sonoras para quando a IA está falando
const SpeakingWaves = () => {
  const [amplitudes, setAmplitudes] = useState([0, 0, 0, 0, 0, 0, 0]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setAmplitudes(prev => prev.map(() => Math.random()));
    }, 150);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center space-x-1 p-4">
      {amplitudes.map((amplitude, i) => (
        <div
          key={i}
          className="bg-blue-500 rounded-full transition-all duration-150 ease-out"
          style={{
            width: '3px',
            height: `${8 + amplitude * 30}px`,
            opacity: 0.7 + amplitude * 0.3
          }}
        />
      ))}
    </div>
  );
};

// Componente de indicador de escuta para quando o candidato está falando
const ListeningIndicator = () => {
  return (
    <div className="flex items-center justify-center space-x-2 p-4">
      <div className="relative">
        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
          <Mic className="h-6 w-6 text-white" />
        </div>
        <div className="absolute inset-0 w-12 h-12 bg-green-400 rounded-full animate-ping opacity-25" />
        <div className="absolute inset-0 w-12 h-12 bg-green-300 rounded-full animate-ping opacity-20" style={{ animationDelay: '0.2s' }} />
      </div>
    </div>
  );
};

// Componente de visualização de amplitude de voz
const VoiceVisualizer = ({ isActive }: { isActive: boolean }) => {
  const [amplitude, setAmplitude] = useState(0);
  
  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        setAmplitude(Math.random() * 100);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setAmplitude(0);
    }
  }, [isActive]);

  return (
    <div className="flex items-center justify-center space-x-1 h-16">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-100 ${
            isActive ? 'bg-green-500' : 'bg-gray-300'
          }`}
          style={{
            height: isActive ? `${5 + (amplitude * Math.sin(i * 0.5)) / 10}px` : '5px'
          }}
        />
      ))}
    </div>
  );
};

interface Interview {
  id: number;
  token: string;
  status: string;
  candidate: {
    id: number;
    nome: string;
    email: string;
  };
  job: {
    id: string;
    nomeVaga: string;
    descricaoVaga: string;
  };
  questions: Array<{
    id: number;
    perguntaCandidato: string;
    numeroPergunta: number;
    respostaPerfeita: string;
  }>;
}

export default function NaturalInterviewPage() {
  const { token } = useParams();
  const { toast } = useToast();
  
  // Estados principais
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [conversationHistory, setConversationHistory] = useState<Array<{
    type: 'ai' | 'candidate';
    message: string;
    timestamp: Date;
  }>>([]);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // Refs para controle de áudio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Query para buscar dados da entrevista
  const { data: interview, isLoading } = useQuery<Interview>({
    queryKey: [`/api/interview/${token}`],
    enabled: !!token,
  });

  // Inicializar reconhecimento de voz
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';
      
      recognition.onstart = () => {
        console.log('🎤 Reconhecimento de voz iniciado');
        setIsListening(true);
      };
      
      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setCurrentTranscript(transcript);
        
        // Se a frase parece completa, processar
        if (event.results[event.results.length - 1].isFinal) {
          handleCandidateResponse(transcript);
          setCurrentTranscript("");
        }
      };
      
      recognition.onerror = (event) => {
        console.error('❌ Erro no reconhecimento:', event.error);
        setIsListening(false);
      };
      
      recognition.onend = () => {
        console.log('🔇 Reconhecimento finalizado');
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    } else {
      toast({
        title: "Recurso não disponível",
        description: "Seu navegador não suporta reconhecimento de voz",
        variant: "destructive",
      });
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Função para falar usando IA do OpenAI
  const speakWithAI = async (text: string) => {
    try {
      setIsSpeaking(true);
      
      const response = await fetch('/api/natural-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          interviewToken: token
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        currentAudioRef.current = audio;
        
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          // Iniciar escuta após falar
          if (!interviewCompleted) {
            startListening();
          }
        };
        
        await audio.play();
        
        // Adicionar à conversa
        setConversationHistory(prev => [...prev, {
          type: 'ai',
          message: text,
          timestamp: new Date()
        }]);
        
      } else {
        throw new Error('Falha ao gerar áudio');
      }
    } catch (error) {
      console.error('❌ Erro ao falar:', error);
      setIsSpeaking(false);
      toast({
        title: "Erro",
        description: "Falha ao reproduzir áudio da IA",
        variant: "destructive",
      });
    }
  };

  // Processar resposta do candidato
  const handleCandidateResponse = async (transcript: string) => {
    if (!transcript.trim() || !interview) return;
    
    console.log('💬 Resposta do candidato:', transcript);
    
    // Adicionar resposta à conversa
    setConversationHistory(prev => [...prev, {
      type: 'candidate',
      message: transcript,
      timestamp: new Date()
    }]);
    
    // Salvar no banco de dados
    try {
      await fetch(`/api/interview/${token}/natural-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionIndex: currentQuestionIndex,
          response: transcript,
          timestamp: new Date().toISOString()
        }),
      });
    } catch (error) {
      console.error('❌ Erro ao salvar resposta:', error);
    }
    
    // Gerar próxima resposta da IA
    await generateAIResponse(transcript);
  };

  // Gerar resposta da IA
  const generateAIResponse = async (candidateResponse: string) => {
    try {
      const response = await fetch('/api/natural-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interviewToken: token,
          candidateResponse,
          currentQuestionIndex,
          conversationHistory: conversationHistory.slice(-6), // Últimas 6 mensagens para contexto
        }),
      });

      const data = await response.json();
      
      if (data.aiResponse) {
        await speakWithAI(data.aiResponse);
        
        // Atualizar índice da pergunta se necessário
        if (data.nextQuestionIndex !== undefined) {
          setCurrentQuestionIndex(data.nextQuestionIndex);
        }
        
        // Verificar se entrevista terminou
        if (data.interviewCompleted) {
          setInterviewCompleted(true);
          stopListening();
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao gerar resposta da IA:', error);
      toast({
        title: "Erro",
        description: "Falha ao processar conversa",
        variant: "destructive",
      });
    }
  };

  // Iniciar entrevista
  const startInterview = async () => {
    if (!interview) return;
    
    setIsInterviewStarted(true);
    
    // Mensagem de boas-vindas
    const welcomeMessage = `Olá ${interview.candidate.nome}, tudo bem? Sou o assistente virtual que vai conduzir sua entrevista para a vaga de ${interview.job.nomeVaga}. Vou fazer algumas perguntas e você pode conversar comigo naturalmente. Está tudo bem para começarmos?`;
    
    await speakWithAI(welcomeMessage);
  };

  // Controlar escuta
  const startListening = () => {
    if (recognitionRef.current && !isListening && !isSpeaking) {
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // Finalizar entrevista
  const finishInterview = async () => {
    try {
      await fetch(`/api/interview/${token}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationHistory,
          completedAt: new Date().toISOString()
        }),
      });
      
      setInterviewCompleted(true);
      stopListening();
      
      toast({
        title: "Entrevista finalizada",
        description: "Obrigado pela sua participação!",
      });
      
    } catch (error) {
      console.error('❌ Erro ao finalizar entrevista:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Entrevista não encontrada</h2>
            <p className="text-muted-foreground">Verifique o link e tente novamente.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-blue-900">
              Entrevista - {interview.job.nomeVaga}
            </CardTitle>
            <p className="text-muted-foreground">
              Candidato: {interview.candidate.nome}
            </p>
          </CardHeader>
        </Card>

        {!isInterviewStarted ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center space-y-6">
              <div className="space-y-4">
                <MessageCircle className="h-16 w-16 mx-auto text-blue-600" />
                <h2 className="text-xl font-semibold">Pronto para começar?</h2>
                <p className="text-muted-foreground">
                  Esta será uma entrevista conversacional natural. Você poderá falar normalmente 
                  com nosso assistente virtual, que fará perguntas sobre a vaga e sua experiência.
                </p>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Dicas importantes:</strong><br />
                    • Fale claramente e em ritmo normal<br />
                    • Aguarde o assistente terminar de falar antes de responder<br />
                    • Seja natural e espontâneo em suas respostas
                  </p>
                </div>
              </div>
              
              <Button 
                onClick={startInterview}
                size="lg"
                className="w-full"
              >
                <Play className="mr-2 h-5 w-5" />
                Iniciar Entrevista
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Painel de Controle */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mic className="h-5 w-5" />
                  <span>Controles</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status da IA:</span>
                    <Badge variant={isSpeaking ? "default" : "secondary"}>
                      {isSpeaking ? "Falando" : "Aguardando"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Escuta:</span>
                    <Badge variant={isListening ? "default" : "outline"}>
                      {isListening ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Pergunta:</span>
                    <Badge variant="outline">
                      {currentQuestionIndex + 1} de {interview.questions.length}
                    </Badge>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  {currentTranscript && (
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Detectando:</strong><br />
                        {currentTranscript}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button
                    variant={isListening ? "destructive" : "outline"}
                    onClick={isListening ? stopListening : startListening}
                    disabled={isSpeaking}
                    className="flex-1"
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  
                  {!interviewCompleted && (
                    <Button
                      variant="outline"
                      onClick={finishInterview}
                      className="flex-1"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Conversa */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Conversa</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {conversationHistory.map((message, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg ${
                        message.type === 'ai'
                          ? 'bg-blue-50 border-l-4 border-blue-500'
                          : 'bg-green-50 border-l-4 border-green-500 ml-8'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant={message.type === 'ai' ? "default" : "secondary"}>
                          {message.type === 'ai' ? 'Assistente' : interview.candidate.nome}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm">{message.message}</p>
                    </div>
                  ))}
                  
                  {isSpeaking && (
                    <div className="p-3 rounded-lg bg-blue-50 border-l-4 border-blue-500">
                      <div className="flex items-center space-x-2 mb-2">
                        <Volume2 className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-800">Assistente está falando...</span>
                      </div>
                      <SpeakingWaves />
                    </div>
                  )}
                  
                  {isListening && !isSpeaking && (
                    <div className="p-3 rounded-lg bg-green-50 border-l-4 border-green-500">
                      <div className="flex items-center space-x-2 mb-2">
                        <Mic className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-800">Te escutando...</span>
                      </div>
                      <VoiceVisualizer isActive={isListening} />
                    </div>
                  )}
                </div>

                {interviewCompleted && (
                  <div className="mt-6 p-4 bg-green-50 rounded-lg text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-2" />
                    <h3 className="font-semibold text-green-800">Entrevista Finalizada!</h3>
                    <p className="text-sm text-green-700 mt-1">
                      Obrigado pela sua participação. Em breve a empresa entrará em contato.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}