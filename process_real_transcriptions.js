import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBiP7xxUtCpUg0M4ZrIJhBCy5QLFfh2r8M",
  authDomain: "entrevistaia-cf7b4.firebaseapp.com",
  projectId: "entrevistaia-cf7b4",
  storageBucket: "entrevistaia-cf7b4.firebasestorage.app",
  messagingSenderId: "448692167187",
  appId: "1:448692167187:web:3a1b0bddc9d5f5e7e4e055"
};

async function getOpenAIConfig() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  const configRef = collection(db, 'apiConfigs');
  const snapshot = await getDocs(configRef);
  
  for (const doc of snapshot.docs) {
    const config = doc.data();
    if (config.openaiApiKey) {
      return config.openaiApiKey;
    }
  }
  throw new Error('OpenAI API key não encontrada');
}

async function transcribeAudio(audioPath, openaiApiKey) {
  try {
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Arquivo não encontrado: ${audioPath}`);
    }

    const stats = fs.statSync(audioPath);
    console.log(`📊 Processando arquivo: ${audioPath} (${stats.size} bytes)`);

    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath), 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
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
    console.log(`❌ Erro na transcrição: ${error.message}`);
    return null;
  }
}

async function processTranscriptions() {
  try {
    console.log('🔍 Processando transcrições reais da entrevista Consultor GM 6...\n');
    
    const openaiApiKey = await getOpenAIConfig();
    
    const audioFiles = [
      'uploads/audio_5511984316526_1750316380512_fixed.ogg',
      'uploads/audio_5511984316526_1750316402580_fixed.ogg'
    ];

    const questions = [
      'Você é consultor há quanto tempo? Pode me explicar com detalhes e me dar uma resposta longa.',
      'Você já deu consultoria financeira antes?'
    ];

    for (let i = 0; i < audioFiles.length; i++) {
      console.log(`📝 Pergunta ${i + 1}: ${questions[i]}`);
      
      const transcription = await transcribeAudio(audioFiles[i], openaiApiKey);
      
      if (transcription) {
        console.log(`🎤 Transcrição real: "${transcription}"`);
      } else {
        console.log(`🎤 Transcrição: Não foi possível processar`);
      }
      
      console.log('---\n');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

processTranscriptions();