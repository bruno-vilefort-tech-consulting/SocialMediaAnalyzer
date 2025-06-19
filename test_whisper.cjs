const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testWhisperAPI() {
  try {
    // Verificar se temos a API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.log('❌ OPENAI_API_KEY não encontrada');
      return;
    }
    
    console.log('✅ OPENAI_API_KEY encontrada');
    console.log('🔍 Testando último arquivo de áudio baixado...');
    
    const audioFile = 'uploads/audio_5511984316526_1750315476320_fixed.ogg';
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(audioFile)) {
      console.log('❌ Arquivo de áudio não encontrado:', audioFile);
      return;
    }
    
    const stats = fs.statSync(audioFile);
    console.log(`📁 Arquivo: ${audioFile}`);
    console.log(`📊 Tamanho: ${stats.size} bytes`);
    
    // Ler o arquivo
    const audioBuffer = fs.readFileSync(audioFile);
    console.log(`🎵 Buffer criado: ${audioBuffer.length} bytes`);
    
    // Criar FormData
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.ogg',
      contentType: 'audio/ogg'
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    
    console.log('🚀 Enviando para Whisper API...');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    console.log(`📊 Status da resposta: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Transcrição bem-sucedida:');
      console.log(`📝 Texto: "${result.text}"`);
    } else {
      const errorText = await response.text();
      console.log('❌ Erro na transcrição:');
      console.log(`📄 Resposta: ${errorText}`);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testWhisperAPI();