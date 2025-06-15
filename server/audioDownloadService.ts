import * as fs from 'fs';
import * as path from 'path';

export class AudioDownloadService {
  private whatsappService: any;

  constructor(whatsappService: any) {
    this.whatsappService = whatsappService;
  }

  async downloadAudio(audioMessage: any, phone: string): Promise<Buffer | null> {
    console.log(`\n🎯 [AUDIO_DOWNLOAD] ===== INICIANDO DOWNLOAD =====`);
    console.log(`📱 [AUDIO_DOWNLOAD] Telefone: ${phone}`);
    console.log(`📋 [AUDIO_DOWNLOAD] Dados da mensagem:`, {
      type: audioMessage.type,
      mimetype: audioMessage.mimetype,
      fileLength: audioMessage.fileLength,
      seconds: audioMessage.seconds,
      url: audioMessage.url ? 'Presente' : 'Ausente'
    });

    try {
      // Método 1: Tentar com socket ativo
      if (this.whatsappService && this.whatsappService.socket) {
        try {
          console.log(`🔌 [AUDIO_DOWNLOAD] Tentativa 1: Socket ativo`);
          const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
          
          const audioBuffer = await downloadMediaMessage(
            audioMessage,
            'buffer',
            {},
            {
              logger: {
                level: 'info',
                child: () => console
              },
              reuploadRequest: this.whatsappService.socket.updateMediaMessage
            }
          );
          
          if (audioBuffer && audioBuffer.length > 0) {
            console.log(`✅ [AUDIO_DOWNLOAD] Sucesso com socket - ${audioBuffer.length} bytes`);
            return audioBuffer;
          }
        } catch (socketError: any) {
          console.log(`⚠️ [AUDIO_DOWNLOAD] Socket falhou:`, socketError?.message || socketError);
        }
      }

      // Método 2: Download direto sem contexto
      try {
        console.log(`🔄 [AUDIO_DOWNLOAD] Tentativa 2: Download direto`);
        const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
        
        const audioBuffer = await downloadMediaMessage(audioMessage, 'buffer');
        
        if (audioBuffer && audioBuffer.length > 0) {
          console.log(`✅ [AUDIO_DOWNLOAD] Sucesso direto - ${audioBuffer.length} bytes`);
          return audioBuffer;
        }
      } catch (directError: any) {
        console.log(`⚠️ [AUDIO_DOWNLOAD] Download direto falhou:`, directError?.message || directError);
      }

      // Método 3: Tentar acessar dados brutos da mensagem
      try {
        console.log(`📦 [AUDIO_DOWNLOAD] Tentativa 3: Dados brutos`);
        
        if (audioMessage.message?.audioMessage?.fileEncSha256) {
          console.log(`🔑 [AUDIO_DOWNLOAD] Hash encontrado, tentando download com hash`);
          const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
          
          const audioBuffer = await downloadMediaMessage(
            audioMessage,
            'buffer',
            {},
            {
              logger: {
                level: 'info', 
                child: () => console
              }
            }
          );
          
          if (audioBuffer && audioBuffer.length > 0) {
            console.log(`✅ [AUDIO_DOWNLOAD] Sucesso com hash - ${audioBuffer.length} bytes`);
            return audioBuffer;
          }
        }
      } catch (hashError: any) {
        console.log(`⚠️ [AUDIO_DOWNLOAD] Download com hash falhou:`, hashError?.message || hashError);
      }

      console.log(`❌ [AUDIO_DOWNLOAD] Todos os métodos falharam`);
      return null;

    } catch (error: any) {
      console.log(`❌ [AUDIO_DOWNLOAD] Erro geral:`, error?.message || error);
      return null;
    }
  }

  async saveAudioFile(audioBuffer: Buffer, phone: string): Promise<string> {
    const filename = `audio_${phone}_${Date.now()}.ogg`;
    const filepath = path.join('./uploads', filename);
    
    fs.writeFileSync(filepath, audioBuffer);
    console.log(`💾 [AUDIO_DOWNLOAD] Arquivo salvo: ${filepath} (${audioBuffer.length} bytes)`);
    
    return filename;
  }
}