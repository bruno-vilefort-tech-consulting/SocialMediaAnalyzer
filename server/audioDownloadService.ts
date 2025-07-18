import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from '../src/config/paths';

export class AudioDownloadService {
  private whatsappService: any;

  constructor(whatsappService: any) {
    this.whatsappService = whatsappService;
  }

  async downloadAudio(audioMessage: any, phone: string): Promise<Buffer | null> {
    if (!audioMessage) {
      return null;
    }

    try {
      const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
      
      // Logger silencioso para evitar spam
      const silentLogger = {
        level: 'silent' as const,
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        trace: () => {},
        child: () => silentLogger
      };

      // Método 1: Download direto com downloadMediaMessage
      try {
        const audioBuffer = await downloadMediaMessage(
          audioMessage,
          'buffer',
          {},
          {
            logger: silentLogger,
            reuploadRequest: this.whatsappService?.socket?.updateMediaMessage
          }
        );
        
        if (audioBuffer && audioBuffer.length > 0) {
          return audioBuffer;
        }
      } catch (method1Error: any) {
        // Method 1 failed, try next method
      }

      // Método 2: Download direto sem parâmetros extras
      try {
        const audioBuffer = await downloadMediaMessage(audioMessage, 'buffer', {});
        
        if (audioBuffer && audioBuffer.length > 0) {
          return audioBuffer;
        }
      } catch (directError: any) {
        // Method 2 failed, try next method
      }

      // Método 3: Com socket caso disponível
      if (this.whatsappService?.socket) {
        try {
          const audioBuffer = await downloadMediaMessage(
            audioMessage,
            'buffer',
            {},
            {
              logger: silentLogger,
              reuploadRequest: this.whatsappService.socket.updateMediaMessage
            }
          );
          
          if (audioBuffer && audioBuffer.length > 0) {
            return audioBuffer;
          }
          
        } catch (socketError: any) {
          // Method 3 failed, try next method
        }
      }

      // Método 4: Verificar URL direta
      try {
        const audioMsg = audioMessage?.message?.audioMessage;
        if (audioMsg?.url) {
          const response = await fetch(audioMsg.url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            if (buffer.length > 0) {
              return buffer;
            }
          }
        }
      } catch (urlError: any) {
        // URL download failed
      }

      return null;
      
    } catch (error: any) {
      return null;
    }
  }

  async saveAudioFile(audioBuffer: Buffer, phone: string, selectionId?: string, questionNumber?: number): Promise<string> {
    try {
      // CORRIGIDO: Usar nomenclatura consistente baseada no padrão existente
      const phoneClean = phone.replace(/\D/g, '');
      let fileName: string;
      
      if (selectionId && questionNumber) {
        // Nova nomenclatura: audio_[telefone]_[selectionId]_R[numero].ogg
        fileName = `audio_${phoneClean}_${selectionId}_R${questionNumber}.ogg`;
      } else {
        // Fallback para nomenclatura antiga caso parâmetros não sejam fornecidos
        fileName = `audio_${phoneClean}_${Date.now()}.ogg`;
      }
      
      const filePath = path.join(UPLOADS_DIR, fileName);
      
      await fs.promises.writeFile(filePath, audioBuffer);
      
      return filePath; // Retorna path completo
      
    } catch (error: any) {
      throw error;
    }
  }
}