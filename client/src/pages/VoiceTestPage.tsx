import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Play, Square, Volume2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VoiceTestPage() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState([0.85]);
  const [pitch, setPitch] = useState([1.1]);
  const [volume, setVolume] = useState([0.9]);
  const { toast } = useToast();

  const testText = "Olá! Esta é uma pergunta de teste para avaliar a qualidade da voz. Qual cidade você mora?";

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      // Buscar a melhor voz portuguesa por padrão
      const bestVoice = availableVoices.find(voice => 
        (voice.lang.includes('pt-BR') || voice.lang.includes('pt-PT')) && 
        (voice.name.toLowerCase().includes('google') || 
         voice.name.toLowerCase().includes('microsoft') ||
         voice.name.toLowerCase().includes('female'))
      ) || availableVoices.find(voice => voice.lang.includes('pt-BR')) || 
         availableVoices.find(voice => voice.lang.includes('pt'));

      if (bestVoice) {
        setSelectedVoice(bestVoice);
      }
    };

    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  const playTestVoice = async () => {
    if (!selectedVoice) return;

    try {
      setIsPlaying(true);
      
      // Parar qualquer reprodução anterior
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(testText);
      utterance.voice = selectedVoice;
      utterance.lang = 'pt-BR';
      utterance.rate = rate[0];
      utterance.pitch = pitch[0];
      utterance.volume = volume[0];
      
      utterance.onend = () => {
        setIsPlaying(false);
      };
      
      utterance.onerror = () => {
        setIsPlaying(false);
        toast({
          title: "Erro",
          description: "Não foi possível reproduzir a voz de teste",
          variant: "destructive"
        });
      };
      
      speechSynthesis.speak(utterance);
      
    } catch (error) {
      setIsPlaying(false);
      toast({
        title: "Erro",
        description: "Erro ao reproduzir voz de teste",
        variant: "destructive"
      });
    }
  };

  const stopVoice = () => {
    speechSynthesis.cancel();
    setIsPlaying(false);
  };

  const testOpenAITTS = async () => {
    try {
      setIsPlaying(true);
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText })
      });
      
      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
        toast({
          title: "Sucesso!",
          description: "OpenAI TTS está funcionando corretamente",
          variant: "default"
        });
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error) {
      setIsPlaying(false);
      toast({
        title: "OpenAI TTS não disponível",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const portugueseVoices = voices.filter(voice => 
    voice.lang.includes('pt-BR') || voice.lang.includes('pt-PT') || voice.lang.includes('pt')
  );

  const otherVoices = voices.filter(voice => 
    !voice.lang.includes('pt-BR') && !voice.lang.includes('pt-PT') && !voice.lang.includes('pt')
  );

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Teste de Voz</h1>
        <p className="text-muted-foreground">
          Configure e teste diferentes vozes para as entrevistas
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* OpenAI TTS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              OpenAI TTS (Recomendado)
            </CardTitle>
            <CardDescription>
              Voz natural e profissional da OpenAI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {testText}
            </p>
            <Button 
              onClick={testOpenAITTS}
              disabled={isPlaying}
              className="w-full"
            >
              {isPlaying ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Reproduzindo...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Testar OpenAI TTS
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Web Speech API */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Voz do Navegador
            </CardTitle>
            <CardDescription>
              Fallback usando Web Speech API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Voz Selecionada</label>
              <Select
                value={selectedVoice?.name || ""}
                onValueChange={(value) => {
                  const voice = voices.find(v => v.name === value);
                  setSelectedVoice(voice || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma voz" />
                </SelectTrigger>
                <SelectContent>
                  {portugueseVoices.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                        Vozes em Português
                      </div>
                      {portugueseVoices.map((voice) => (
                        <SelectItem key={voice.name} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {otherVoices.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                        Outras Vozes
                      </div>
                      {otherVoices.slice(0, 10).map((voice) => (
                        <SelectItem key={voice.name} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Velocidade: {rate[0].toFixed(2)}
                </label>
                <Slider
                  value={rate}
                  onValueChange={setRate}
                  min={0.5}
                  max={2}
                  step={0.05}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Tom: {pitch[0].toFixed(2)}
                </label>
                <Slider
                  value={pitch}
                  onValueChange={setPitch}
                  min={0.5}
                  max={2}
                  step={0.1}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Volume: {volume[0].toFixed(2)}
                </label>
                <Slider
                  value={volume}
                  onValueChange={setVolume}
                  min={0.1}
                  max={1}
                  step={0.1}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={playTestVoice}
                disabled={isPlaying || !selectedVoice}
                className="flex-1"
              >
                {isPlaying ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Reproduzindo...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Testar Voz
                  </>
                )}
              </Button>
              
              {isPlaying && (
                <Button 
                  onClick={stopVoice}
                  variant="outline"
                >
                  <Square className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Informações Técnicas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">Status da OpenAI TTS</h4>
              <p className="text-sm text-muted-foreground">
                A API da OpenAI oferece a melhor qualidade de voz, mas requer uma chave válida com créditos.
                Atualmente está retornando erro de quota excedida.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Web Speech API</h4>
              <p className="text-sm text-muted-foreground">
                Funciona como fallback usando as vozes do sistema operacional.
                A qualidade varia conforme o navegador e sistema.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}