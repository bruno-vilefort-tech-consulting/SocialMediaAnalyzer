import { useState, useRef, useCallback } from 'react';

export function useAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = useCallback((audioUrl: string) => {
    try {
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Create new audio element
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setCurrentAudioUrl(audioUrl);
      setIsPlaying(true);
      setIsPaused(false);

      audio.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentAudioUrl(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentAudioUrl(null);
        audioRef.current = null;
        console.error('Erro ao reproduzir áudio');
      };

      audio.play().catch(error => {
        console.error('Erro ao iniciar reprodução:', error);
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentAudioUrl(null);
        audioRef.current = null;
      });
    } catch (error) {
      console.error('Erro ao configurar áudio:', error);
    }
  }, []);

  const pauseAudio = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  }, [isPlaying]);

  const resumeAudio = useCallback(() => {
    if (audioRef.current && isPaused) {
      audioRef.current.play().catch(error => {
        console.error('Erro ao retomar reprodução:', error);
      });
      setIsPlaying(true);
      setIsPaused(false);
    }
  }, [isPaused]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentAudioUrl(null);
      audioRef.current = null;
    }
  }, []);

  return {
    isPlaying,
    isPaused,
    currentAudioUrl,
    playAudio,
    pauseAudio,
    resumeAudio,
    stopAudio
  };
}

// Export for backward compatibility
export const useAudioRecorder = useAudio;