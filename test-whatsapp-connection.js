/**
 * Script para testar apenas a conexão WhatsApp e verificar o sistema TTS
 */

async function testConnection() {
  console.log('🔍 [CONN] Testando conexão WhatsApp...\n');
  
  try {
    // 1. Tentar conectar uma instância WhatsApp
    console.log('1️⃣ Tentando conectar slot 1...');
    
    const response = await fetch('http://localhost:5000/api/multi-whatsapp/connect/1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        clientId: '1749849987543'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ [CONN] Resposta da conexão:', result);
      
      if (result.qrCode) {
        console.log('📱 [CONN] QR Code gerado com sucesso!');
        console.log('🔍 [CONN] Tamanho do QR Code:', result.qrCode.length, 'caracteres');
        
        // Agora testar TTS com OpenAI diretamente
        console.log('\n2️⃣ Testando TTS do OpenAI...');
        
        const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "tts-1",
            input: "Esta é uma pergunta de teste para o sistema de entrevistas",
            voice: "nova",
            response_format: "opus",
            speed: 1.0
          })
        });
        
        if (ttsResponse.ok) {
          const audioBuffer = await ttsResponse.arrayBuffer();
          console.log('✅ [CONN] TTS funcionando!');
          console.log('🎵 [CONN] Áudio gerado:', audioBuffer.byteLength, 'bytes');
          
          console.log('\n✅ [CONN] SISTEMA OPERACIONAL!');
          console.log('📋 [CONN] Para funcionar completamente:');
          console.log('   1. Escaneie o QR Code gerado na página Configurações');
          console.log('   2. Inicie uma entrevista enviando "1" via WhatsApp');
          console.log('   3. O sistema enviará perguntas por texto + áudio TTS');
          
        } else {
          const errorText = await ttsResponse.text();
          console.log('❌ [CONN] Erro no TTS:', ttsResponse.status, errorText);
        }
        
      } else {
        console.log('⚠️ [CONN] QR Code não foi gerado');
      }
      
    } else {
      const errorText = await response.text();
      console.log('❌ [CONN] Erro na conexão:', response.status);
      console.log('📋 [CONN] Detalhes:', errorText.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.log('❌ [CONN] Erro no teste:', error.message);
  }
}

// Executar teste
testConnection().catch(console.error);