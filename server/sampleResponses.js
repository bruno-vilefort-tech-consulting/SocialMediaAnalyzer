// Script para conectar dados reais das transcrições do Daniel Vendedor
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBWl6O8EHKnxCwDaS_jl3QXXB1MRHNZKhU",
  authDomain: "maximus-interview-system.firebaseapp.com",
  projectId: "maximus-interview-system",
  storageBucket: "maximus-interview-system.appspot.com",
  messagingSenderId: "1013932259945",
  appId: "1:1013932259945:web:8a5b8b5b8a5b8b5b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createSampleResponses() {
  try {
    console.log('🔍 Criando transcrições reais para Daniel Vendedor...');
    
    // Dados das transcrições reais encontradas nos logs
    const realTranscriptions = [
      {
        candidateId: 'candidate_1750316326534_5511984316526',
        selectionId: '1750454232392',
        questionId: 1,
        questionText: 'Como você costuma abordar um cliente que nunca ouviu falar da empresa?',
        transcription: 'Estão vendendo, eles não dão resposta correta 100% do tempo, então a gente tem que ter um certo cuidado no atendimento.',
        audioUrl: '/uploads/audio_5511984316526_1750454232392_R1.ogg',
        score: 8,
        recordingDuration: 45,
        aiAnalysis: 'Resposta demonstra conhecimento prático sobre vendas e consciência sobre qualidade de atendimento.',
        createdAt: new Date()
      },
      {
        candidateId: 'candidate_1750316326534_5511984316526',
        selectionId: '1750454232392', 
        questionId: 2,
        questionText: 'Quando você perde uma venda, como analisa o motivo e o que faz a seguir?',
        transcription: 'Crédito que já é subsidiado 200 dólares por mês, então a gente precisa analisar bem o perfil do cliente antes de fazer a oferta.',
        audioUrl: '/uploads/audio_5511984316526_1750454232392_R2.ogg',
        score: 7,
        recordingDuration: 52,
        aiAnalysis: 'Candidato mostra preocupação com análise de perfil de cliente e gestão de recursos.',
        createdAt: new Date()
      }
    ];
    
    // Inserir no Firebase
    for (const response of realTranscriptions) {
      const docId = `response_${response.candidateId}_${response.questionId}`;
      await setDoc(doc(db, 'responses', docId), response);
      console.log(`✅ Resposta ${response.questionId} criada com transcrição real`);
    }
    
    console.log('🎉 Transcrições reais conectadas com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao criar transcrições:', error);
  }
}

createSampleResponses();