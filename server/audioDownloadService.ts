import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from '../src/config/paths';

export class AudioDownloadService {
  private whatsappService: any;

  constructor(whatsappService: any) {
    this.whatsappService = whatsappService;
  }

  async downloadAudio(audioMessage: any, phone: string): Promise<Buffer | null> {
    console.log(`\n🎯 [AUDIO_DOWNLOAD] ===== INICIANDO DOWNLOAD ROBUSTO =====`);
    console.log(`📱 [AUDIO_DOWNLOAD] Telefone: ${phone}`);
    
    if (!audioMessage) {
      console.log(`❌ [AUDIO_DOWNLOAD] Mensagem de áudio não fornecida`);
      return null;
    }

    // Log da estrutura da mensagem para debug
    console.log(`📋 [AUDIO_DOWNLOAD] Estrutura da mensagem:`, JSON.stringify({
      messageType: audioMessage.messageType,
      hasMessage: !!audioMessage.message,
      hasAudioMessage: !!audioMessage.message?.audioMessage,
      audioData: audioMessage.message?.audioMessage ? {
        mimetype: audioMessage.message.audioMessage.mimetype,
        fileLength: audioMessage.message.audioMessage.fileLength,
        hasUrl: !!audioMessage.message.audioMessage.url,
        hasDirectPath: !!audioMessage.message.audioMessage.directPath
      } : null
    }, null, 2));

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
        console.log(`🔄 [AUDIO_DOWNLOAD] Tentativa 1: downloadMediaMessage direto`);
        
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
          console.log(`✅ [AUDIO_DOWNLOAD] Sucesso método 1 - ${audioBuffer.length} bytes`);
          return audioBuffer;
        }
      } catch (method1Error: any) {
        console.log(`⚠️ [AUDIO_DOWNLOAD] Método 1 falhou:`, method1Error?.message || 'Erro desconhecido');
      }

      // Método 2: Download direto sem parâmetros extras
      try {
        console.log(`🔄 [AUDIO_DOWNLOAD] Tentativa 2: Download direto simples`);
        const audioBuffer = await downloadMediaMessage(audioMessage, 'buffer');
        
        if (audioBuffer && audioBuffer.length > 0) {
          console.log(`✅ [AUDIO_DOWNLOAD] Sucesso método 2 - ${audioBuffer.length} bytes`);
          return audioBuffer;
        }
      } catch (directError: any) {
        console.log(`⚠️ [AUDIO_DOWNLOAD] Método 2 falhou:`, directError?.message || 'Erro desconhecido');
      }

      // Método 3: Com socket caso disponível
      if (this.whatsappService?.socket) {
        try {
          console.log(`🔄 [AUDIO_DOWNLOAD] Tentativa 3: Com socket disponível`);
          
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
            console.log(`✅ [AUDIO_DOWNLOAD] Sucesso método 3 - ${audioBuffer.length} bytes`);
            return audioBuffer;
          }
          
        } catch (socketError: any) {
          console.log(`⚠️ [AUDIO_DOWNLOAD] Método 3 falhou:`, socketError?.message || 'Erro desconhecido');
        }
      }

      // Método 4: Verificar URL direta
      try {
        console.log(`🔄 [AUDIO_DOWNLOAD] Tentativa 4: Verificando URL direta`);
        
        const audioMsg = audioMessage?.message?.audioMessage;
        if (audioMsg?.url) {
          console.log(`🔗 [AUDIO_DOWNLOAD] URL encontrada, fazendo fetch...`);
          
          const response = await fetch(audioMsg.url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            if (buffer.length > 0) {
              console.log(`✅ [AUDIO_DOWNLOAD] Sucesso via URL - ${buffer.length} bytes`);
              return buffer;
            }
          }
        }
      } catch (urlError: any) {
        console.log(`⚠️ [AUDIO_DOWNLOAD] Download via URL falhou:`, urlError?.message || 'Erro desconhecido');
      }

      console.log(`❌ [AUDIO_DOWNLOAD] Todos os métodos falharam`);
      return null;
      
    } catch (error: any) {
      console.log(`❌ [AUDIO_DOWNLOAD] Erro geral:`, error?.message || error);
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
      
      console.log(`💾 [AUDIO_SAVE] Arquivo salvo DEFINITIVAMENTE: ${filePath} (${audioBuffer.length} bytes)`);
      return filePath; // Retorna path completo
      
    } catch (error: any) {
      console.log(`❌ [AUDIO_SAVE] Erro ao salvar:`, error?.message || error);
      throw error;
    }
  }
}