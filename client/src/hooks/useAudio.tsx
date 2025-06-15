import { useState, useRef, useCallback } from "react";

interface UseAudioRecorderReturn {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  playAudio: (audioUrl: string) => void;
  pauseAudio: () => void;
  stopAudio: () => void;
  isPlaying: boolean;
  currentAudioUrl: string | null;
}

export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setDuration(0);
      
      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Failed to start recording. Please check microphone permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, [isRecording]);

  const playAudio = useCallback((audioUrl: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      console.log('Tentando reproduzir áudio:', audioUrl);
      
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setCurrentAudioUrl(null);
      };
      audioRef.current.onerror = (e) => {
        console.error('Erro no áudio:', e);
        console.log('URL que falhou:', audioUrl);
        setIsPlaying(false);
        setCurrentAudioUrl(null);
      };
      audioRef.current.onloadstart = () => {
        console.log('Carregando áudio...');
      };
      audioRef.current.oncanplay = () => {
        console.log('Áudio pronto para tocar');
      };
      
      setCurrentAudioUrl(audioUrl);
      setIsPlaying(true);
      
      audioRef.current.play().catch((error) => {
        console.error('Error playing audio:', error);
        console.log('Detalhes do erro:', error.name, error.message);
        setIsPlaying(false);
        setCurrentAudioUrl(null);
      });
    } catch (error) {
      console.error('Erro geral ao reproduzir áudio:', error);
      setIsPlaying(false);
      setCurrentAudioUrl(null);
    }
  }, []);

  const pauseAudio = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentAudioUrl(null);
    }
  }, []);

  return {
    isRecording,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    playAudio,
    pauseAudio,
    stopAudio,
    isPlaying,
    currentAudioUrl
  };
};

export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};
