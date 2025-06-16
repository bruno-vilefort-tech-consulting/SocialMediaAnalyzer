
import { useState, useRef, useCallback } from "react";

interface UseAudioRecorderReturn {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  playAudio: (audioUrl: string) => void;
  pauseAudio: () => void;
  resumeAudio: () => void;
  stopAudio: () => void;
  isPlaying: boolean;
  isPaused: boolean;
  currentAudioUrl: string | null;
}

export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
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
      console.log('🎵 Reproduzindo novo áudio:', audioUrl);
      
      // Se já existe um áudio, parar completamente antes
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.removeEventListener('ended', () => {});
        audioRef.current.removeEventListener('error', () => {});
      }
      
      // Criar novo elemento de áudio
      audioRef.current = new Audio(audioUrl);
      
      // Configurar event listeners
      audioRef.current.addEventListener('ended', () => {
        console.log('✅ Áudio finalizado');
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentAudioUrl(null);
      });
      
      audioRef.current.addEventListener('error', (e) => {
        console.error('❌ Erro no áudio:', e);
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentAudioUrl(null);
      });
      
      // Definir estados
      setCurrentAudioUrl(audioUrl);
      setIsPlaying(true);
      setIsPaused(false);
      
      // Iniciar reprodução
      audioRef.current.play().then(() => {
        console.log('✅ Áudio iniciado com sucesso');
      }).catch((error) => {
        console.error('❌ Erro ao iniciar áudio:', error);
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentAudioUrl(null);
      });
    } catch (error) {
      console.error('❌ Erro geral:', error);
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentAudioUrl(null);
    }
  }, []);

  const pauseAudio = useCallback(() => {
    if (audioRef.current && isPlaying && !isPaused) {
      console.log('⏸️ Pausando áudio na posição:', audioRef.current.currentTime);
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
      // Manter currentAudioUrl e currentTime para permitir resume
      console.log('⏸️ Estados após pause - isPlaying:', false, 'isPaused:', true);
    }
  }, [isPlaying, isPaused]);

  const resumeAudio = useCallback(() => {
    if (audioRef.current && isPaused && currentAudioUrl && !isPlaying) {
      console.log('▶️ Retomando áudio da posição:', audioRef.current.currentTime);
      
      audioRef.current.play().then(() => {
        console.log('✅ Áudio retomado com sucesso');
        setIsPlaying(true);
        setIsPaused(false);
        console.log('▶️ Estados após resume - isPlaying:', true, 'isPaused:', false);
      }).catch((error) => {
        console.error('❌ Erro ao retomar áudio:', error);
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentAudioUrl(null);
      });
    } else {
      console.log('⚠️ Não é possível retomar - condições:', {
        hasAudio: !!audioRef.current,
        isPaused,
        currentAudioUrl,
        isPlaying
      });
    }
  }, [isPaused, currentAudioUrl, isPlaying]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      console.log('⏹️ Parando áudio completamente');
      audioRef.current.pause();
      audioRef.current.currentTime = 0; // Só resetar no stop
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentAudioUrl(null);
      console.log('⏹️ Estados após stop - isPlaying:', false, 'isPaused:', false);
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
    resumeAudio,
    stopAudio,
    isPlaying,
    isPaused,
    currentAudioUrl
  };
};

export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};
