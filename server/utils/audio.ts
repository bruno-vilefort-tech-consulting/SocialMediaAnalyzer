/**
 * 🔧 CORREÇÃO: Validações de áudio para transcrição
 * Utilitários para garantir qualidade dos arquivos de áudio
 */

// Constantes de validação
export const MIN_AUDIO_SIZE = 10 * 1024; // 10 kB real (não placeholder)
export const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB (limite Whisper)

/**
 * Validar se o áudio tem tamanho adequado para transcrição
 */
export const isValidAudio = (size: number): boolean => {
  return size >= MIN_AUDIO_SIZE && size <= MAX_AUDIO_SIZE;
};

/**
 * Verificar se o arquivo é um placeholder inválido
 */
export const isPlaceholderAudio = (size: number): boolean => {
  return size < MIN_AUDIO_SIZE;
};

/**
 * Validar buffer de áudio
 */
export const isValidAudioBuffer = (buffer: Buffer | null): boolean => {
  if (!buffer || buffer.length === 0) {
    return false;
  }
  return isValidAudio(buffer.length);
};

/**
 * Obter extensões de áudio válidas
 */
export const getValidAudioExtensions = (): string[] => {
  return ['.ogg', '.mp3', '.wav', '.m4a', '.webm'];
};

/**
 * Verificar se a extensão do arquivo é válida
 */
export const isValidAudioExtension = (filename: string): boolean => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return getValidAudioExtensions().includes(ext);
}; 