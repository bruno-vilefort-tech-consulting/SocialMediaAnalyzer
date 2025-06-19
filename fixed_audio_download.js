/**
 * IMPLEMENTAÇÃO CORRIGIDA - Download de Áudio Baileys
 * Baseado nas especificações do attached_assets/baileys_audio_fix_1750303632861.txt
 */

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

class FixedAudioDownloader {
  async downloadAudioFromMessage(fullMessage, socket) {
    console.log(`🎯 [FIXED_DOWNLOAD] ===== INICIANDO DOWNLOAD CORRIGIDO =====`);
    
    try {
      if (!fullMessage?.message || !socket) {
        console.log(`❌ [FIXED_DOWNLOAD] Mensagem ou socket não disponível`);
        return null;
      }
      
      // Identificar tipo de mensagem de áudio (incluindo ViewOnce)
      let audioMessage = fullMessage.message.audioMessage || 
                        fullMessage.message.pttMessage;
      
      // Verificar ViewOnce messages
      if (!audioMessage && fullMessage.message.viewOnceMessage?.message) {
        audioMessage = fullMessage.message.viewOnceMessage.message.audioMessage;
        console.log(`🔓 [FIXED_DOWNLOAD] ViewOnce message detectada`);
      }
      
      // Verificar ViewOnceV2 messages  
      if (!audioMessage && fullMessage.message.viewOnceMessageV2?.message) {
        audioMessage = fullMessage.message.viewOnceMessageV2.message.audioMessage;
        console.log(`🔓 [FIXED_DOWNLOAD] ViewOnceV2 message detectada`);
      }
      
      if (!audioMessage) {
        console.log(`❌ [FIXED_DOWNLOAD] Nenhuma mensagem de áudio encontrada`);
        console.log(`📋 [FIXED_DOWNLOAD] Estrutura disponível:`, Object.keys(fullMessage.message));
        return null;
      }
      
      console.log(`🎵 [FIXED_DOWNLOAD] Áudio encontrado - usando downloadContentFromMessage`);
      console.log(`📋 [FIXED_DOWNLOAD] Audio metadata:`, {
        mimetype: audioMessage.mimetype,
        seconds: audioMessage.seconds,
        fileLength: audioMessage.fileLength
      });
      
      // Usar novo método de download do Baileys
      const stream = await downloadContentFromMessage(audioMessage, 'audio');
      const chunks = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      
      if (buffer && buffer.length > 0) {
        console.log(`✅ [FIXED_DOWNLOAD] Download bem-sucedido: ${buffer.length} bytes`);
        return buffer;
      } else {
        console.log(`❌ [FIXED_DOWNLOAD] Buffer vazio recebido`);
        return null;
      }
      
    } catch (error) {
      console.log(`❌ [FIXED_DOWNLOAD] Erro no download:`, error.message);
      console.log(`❌ [FIXED_DOWNLOAD] Stack trace:`, error.stack);
      return null;
    }
  }
}

module.exports = { FixedAudioDownloader };