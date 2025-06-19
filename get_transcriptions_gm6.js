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

async function getTranscriptionsGM6() {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('🔍 Buscando respostas da entrevista Consultor GM 6...');
    
    // Buscar respostas da seleção específica
    const responsesRef = collection(db, 'responses');
    const q = query(responsesRef, where('selectionId', '==', '1750316326534'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('❌ Nenhuma resposta encontrada para esta seleção');
      return;
    }
    
    console.log(`✅ Encontradas ${snapshot.size} respostas:`);
    console.log('');
    
    const responses = [];
    snapshot.forEach(doc => {
      responses.push({ id: doc.id, ...doc.data() });
    });
    
    // Ordenar por número da pergunta
    responses.sort((a, b) => (a.questionId || 0) - (b.questionId || 0));
    
    responses.forEach(response => {
      console.log(`📝 Pergunta ${response.questionId}: ${response.questionText}`);
      console.log(`🎤 Transcrição: ${response.transcription || response.responseText}`);
      console.log(`📄 Arquivo de áudio: ${response.audioFile || 'Não disponível'}`);
      console.log(`⏰ Timestamp: ${response.timestamp}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar transcrições:', error);
  }
}

getTranscriptionsGM6();