import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Volume2, VolumeX, MessageCircle, CheckCircle, Loader2, Play, Square, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAudioRecorder } from "@/hooks/useAudio";

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
  const { playAudio: playAudioHook, pauseAudio, resumeAudio, stopAudio, isPlaying: isAudioPlaying, currentAudioUrl } = useAudioRecorder();
  
  // Estados principais
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [conversationHistory, setConversationHistory] = useState<Array<{
    type: 'ai' | 'candidate';
    message: string;
    timestamp: Date;
  }>>([]);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // Estados para gravação completa da sessão
  const [isRecordingSession, setIsRecordingSession] = useState(false);
  const [sessionAudioChunks, setSessionAudioChunks] = useState<Blob[]>([]);
  
  // Refs para controle de áudio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sessionRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
      recognition.maxAlternatives = 1;
      
      recognition.onstart = () => {
        console.log('🎤 Reconhecimento de voz iniciado');
        setIsListening(true);
      };
      
      recognition.onresult = (event) => {
        let transcript = '';
        let isFinal = false;
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          transcript += result[0].transcript;
          if (result.isFinal) {
            isFinal = true;
          }
        }
        
        setCurrentTranscript(transcript);
        
        // Processar quando a frase estiver completa e tiver conteúdo
        if (isFinal && transcript.trim().length > 2) {
          console.log('🗣️ Resposta captada:', transcript.trim());
          handleCandidateResponse(transcript.trim());
          setCurrentTranscript("");
          // Limpar timeout existente
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
        }
      };
      
      recognition.onerror = (event) => {
        console.error('❌ Erro no reconhecimento:', event.error);
        setIsListening(false);
      };
      
      recognition.onend = () => {
        console.log('🔇 Reconhecimento finalizado');
        setIsListening(false);
        
        // CORREÇÃO: Reiniciar automaticamente se ainda estiver ativo
        if (!interviewCompleted && !isSpeaking && isInterviewStarted) {
          setTimeout(() => {
            if (!interviewCompleted && !isSpeaking) {
              console.log('🔄 Reiniciando reconhecimento automaticamente...');
              startListening();
            }
          }, 1000); // 1 segundo para reiniciar
        }
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

  // AUTO-INICIAR entrevista quando dados carregarem
  useEffect(() => {
    if (interview && !isInterviewStarted && !interviewCompleted && !isSpeaking) {
      console.log('🚀 Auto-iniciando entrevista...');
      startInterview();
    }
  }, [interview, isInterviewStarted, interviewCompleted, isSpeaking]);

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
        
        // Usar o hook para reproduzir áudio
        playAudioHook(audioUrl);
        
        // Adicionar à conversa
        setConversationHistory(prev => [...prev, {
          type: 'ai',
          message: text,
          timestamp: new Date()
        }]);
        
        // Aguardar o áudio terminar usando um listener
        const checkAudioEnd = setInterval(() => {
          if (!isAudioPlaying && currentAudioUrl === null) {
            clearInterval(checkAudioEnd);
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            // Iniciar escuta após falar
            if (!interviewCompleted) {
              setTimeout(() => {
                startListening();
              }, 500); // Pequena pausa antes de começar a escutar
            }
          }
        }, 200);
        
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
    if (!transcript.trim() || !interview || isProcessing) return;
    
    console.log('💬 Processando resposta:', transcript);
    setIsProcessing(true);
    
    // Parar reconhecimento durante processamento
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Reconhecimento já parado');
      }
    }
    
    // Cancelar timeout de silêncio se existir
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    // Marcar entrevista como iniciada
    setIsInterviewStarted(true);
    
    // Atualizar histórico da conversa
    const updatedHistory = [...conversationHistory, {
      type: 'candidate' as const,
      message: transcript,
      timestamp: new Date()
    }];
    
    setConversationHistory(updatedHistory);
    
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
    
    try {
      // Gerar próxima resposta da IA com histórico atualizado
      await generateAIResponse(transcript, updatedHistory);
    } catch (error) {
      console.error('❌ Erro ao gerar resposta IA:', error);
      // Reiniciar reconhecimento em caso de erro
      setTimeout(() => {
        if (!interviewCompleted && !isSpeaking) {
          startListening();
        }
      }, 2000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Gerar resposta da IA
  const generateAIResponse = async (candidateResponse: string, updatedHistory?: any[]) => {
    try {
      // Usar histórico atualizado se fornecido, senão usar o estado atual
      const historyToUse = updatedHistory || conversationHistory;
      
      // Debug: mostrar estado atual
      console.log('🔍 Debug generateAIResponse:', {
        isInterviewStarted,
        historyLength: historyToUse.length,
        candidateResponse: candidateResponse.substring(0, 50),
        currentQuestionIndex
      });
      
      const response = await fetch('/api/natural-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interviewToken: token,
          candidateResponse,
          currentQuestionIndex,
          conversationHistory: historyToUse.slice(-6), // Últimas 6 mensagens para contexto
          hasStarted: isInterviewStarted || historyToUse.length > 0, // Verifica estado ou histórico
        }),
      });

      const data = await response.json();
      
      if (data.aiResponse) {
        // CORREÇÃO CRÍTICA: Marcar entrevista como iniciada após primeira resposta da IA
        if (!isInterviewStarted) {
          console.log('✅ Marcando entrevista como iniciada após primeira resposta IA');
          setIsInterviewStarted(true);
        }
        
        await speakWithAI(data.aiResponse);
        
        // Atualizar índice da pergunta se necessário
        if (data.nextQuestionIndex !== undefined) {
          setCurrentQuestionIndex(data.nextQuestionIndex);
        }
        
        // Verificar se entrevista terminou
        if (data.interviewCompleted) {
          setInterviewCompleted(true);
          stopListening();
        } else {
          // CORREÇÃO CRÍTICA: Reiniciar escuta automaticamente após IA falar
          console.log('🔄 Reiniciando escuta após IA falar...');
          setTimeout(() => {
            if (!interviewCompleted && !isSpeaking) {
              startListening();
            }
          }, 1000); // 1 segundo de pausa antes de reiniciar
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

  // Iniciar gravação da sessão completa
  const startSessionRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      const sessionRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      sessionRecorderRef.current = sessionRecorder;
      setSessionAudioChunks([]);
      
      sessionRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setSessionAudioChunks(prev => [...prev, event.data]);
        }
      };
      
      sessionRecorder.start(1000); // Coleta dados a cada segundo
      setIsRecordingSession(true);
      
      console.log('🎙️ Gravação da sessão iniciada');
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação da sessão:', error);
    }
  };

  // Parar gravação da sessão e salvar
  const stopSessionRecording = async () => {
    if (sessionRecorderRef.current && isRecordingSession) {
      sessionRecorderRef.current.stop();
      setIsRecordingSession(false);
      
      // Aguardar processamento final dos chunks
      setTimeout(async () => {
        await saveSessionRecording();
      }, 1000);
    }
  };

  // Salvar gravação completa da sessão
  const saveSessionRecording = async () => {
    if (sessionAudioChunks.length === 0) return;
    
    try {
      const audioBlob = new Blob(sessionAudioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('sessionAudio', audioBlob, `session_${token}_${Date.now()}.webm`);
      formData.append('conversationHistory', JSON.stringify(conversationHistory));
      formData.append('duration', String(Math.floor((Date.now() - interview?.createdAt?.getTime() || 0) / 1000)));
      
      await fetch(`/api/interview/${token}/save-session`, {
        method: 'POST',
        body: formData,
      });
      
      console.log('💾 Sessão completa salva no banco');
    } catch (error) {
      console.error('❌ Erro ao salvar sessão:', error);
    }
  };

  // Iniciar entrevista
  const startInterview = async () => {
    if (!interview) return;
    
    setIsInterviewStarted(true);
    
    // Iniciar gravação automática da sessão completa
    await startSessionRecording();
    
    // CORREÇÃO: Iniciar reconhecimento de voz IMEDIATAMENTE
    setTimeout(() => {
      startListening();
    }, 500);
    
    // Gerar primeira resposta da IA automaticamente (sem input do usuário)
    await generateAIResponse('');
  };

  // Controlar escuta
  const startListening = () => {
    if (recognitionRef.current && !isListening && !isSpeaking) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.log('Reconhecimento já ativo, ignorando...');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    // Limpar timeout de silêncio se parou manualmente
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  };

  // Finalizar entrevista
  const finishInterview = async () => {
    try {
      // Parar gravação da sessão
      await stopSessionRecording();
      
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
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <MessageCircle className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-light text-gray-800">Entrevista por Voz</h2>
              <p className="text-gray-600 max-w-md mx-auto">
                Conversa natural com nosso assistente virtual para a vaga de {interview.job.nomeVaga}
              </p>
            </div>
            
            <Button 
              onClick={startInterview}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full"
            >
              Começar Conversa
            </Button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Interface Conversacional Limpa */}
            <div className="space-y-6">
              {/* Status Visual Central */}
              <div className="text-center">
                {isSpeaking && (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                      <Volume2 className="h-8 w-8 text-blue-600" />
                    </div>
                    <p className="text-gray-600">Assistente falando...</p>
                    <SpeakingWaves />
                    
                    {/* Controles de áudio */}
                    <div className="flex items-center justify-center space-x-2 mt-4">
                      {isAudioPlaying ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={pauseAudio}
                          className="flex items-center space-x-2 bg-orange-100 hover:bg-orange-200 border-orange-300 text-orange-700"
                        >
                          <Pause className="h-4 w-4" />
                          <span>Pausar</span>
                        </Button>
                      ) : (
                        currentAudioUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={resumeAudio}
                            className="flex items-center space-x-2 bg-green-100 hover:bg-green-200 border-green-300 text-green-700"
                          >
                            <Play className="h-4 w-4" />
                            <span>Continuar</span>
                          </Button>
                        )
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={stopAudio}
                        className="flex items-center space-x-2 bg-red-100 hover:bg-red-200 border-red-300 text-red-700"
                      >
                        <Square className="h-4 w-4" />
                        <span>Parar</span>
                      </Button>
                    </div>
                  </div>
                )}
                
                {isListening && !isSpeaking && (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                      <Mic className="h-8 w-8 text-green-600" />
                    </div>
                    <p className="text-gray-600">Te escutando...</p>
                    <VoiceVisualizer isActive={isListening} />
                  </div>
                )}
                
                {!isSpeaking && !isListening && !interviewCompleted && (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                      <MessageCircle className="h-8 w-8 text-blue-600" />
                    </div>
                    <p className="text-blue-600">
                      {isProcessing ? "Processando resposta..." : 
                       isInterviewStarted ? "Aguardando..." : "Iniciando entrevista..."}
                    </p>
                  </div>
                )}
              </div>

              {/* Transcrição em Tempo Real */}
              {currentTranscript && (
                <div className="bg-blue-50 p-4 rounded-lg max-w-2xl mx-auto">
                  <p className="text-blue-800 text-center">{currentTranscript}</p>
                </div>
              )}

              {/* Interface totalmente limpa - sem histórico visível */}

              {/* Tela de Finalização */}
              {interviewCompleted && (
                <div className="text-center space-y-6 py-12">
                  <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-medium text-gray-800">Entrevista Finalizada</h3>
                    <p className="text-gray-600">
                      Obrigado pela sua participação, {interview.candidate.nome}!<br />
                      Em breve a empresa entrará em contato com o resultado.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}