import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Usar a mesma chave que o sistema usa
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

async function transcribeAudio(audioPath) {
  try {
    if (!fs.existsSync(audioPath)) {
      console.log(`❌ Arquivo não encontrado: ${audioPath}`);
      return null;
    }

    const stats = fs.statSync(audioPath);
    console.log(`📊 Processando: ${audioPath} (${stats.size} bytes)`);

    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath), 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (response.ok) {
      const result = await response.json();
      return result.text || '';
    } else {
      const error = await response.text();
      console.log(`❌ Erro ${response.status}: ${error}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🎤 TRANSCRIÇÕES REAIS DA ENTREVISTA CONSULTOR GM 6\n');
  
  const audioFiles = [
    'uploads/audio_5511984316526_1750316380512_fixed.ogg',
    'uploads/audio_5511984316526_1750316402580_fixed.ogg'
  ];

  const questions = [
    'Você é consultor há quanto tempo? Pode me explicar com detalhes e me dar uma resposta longa.',
    'Você já deu consultoria financeira antes?'
  ];

  for (let i = 0; i < audioFiles.length; i++) {
    console.log(`📝 PERGUNTA ${i + 1}:`);
    console.log(`"${questions[i]}"`);
    console.log('');
    
    const transcription = await transcribeAudio(audioFiles[i]);
    
    if (transcription) {
      console.log(`🎤 TRANSCRIÇÃO:`);
      console.log(`"${transcription}"`);
    } else {
      console.log(`🎤 TRANSCRIÇÃO: Falha no processamento`);
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

main();