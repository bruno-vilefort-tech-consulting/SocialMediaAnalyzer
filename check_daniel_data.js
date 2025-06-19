// Script temporário para verificar dados do Daniel Moreira no Firebase
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCKABkfZwrH4hU8UR1ZH-Hb9cgkYYsQbEM",
  authDomain: "maximus-interview-system.firebaseapp.com",
  projectId: "maximus-interview-system",
  storageBucket: "maximus-interview-system.appspot.com",
  messagingSenderId: "425210094516",
  appId: "1:425210094516:web:7e1e4e4e1e4e4e4e4e4e4e"
};

async function checkDanielData() {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('🔍 Verificando dados do Daniel Moreira (5511984316526)...');
    
    // Buscar interviews
    const interviewsQuery = query(collection(db, 'interviews'));
    const interviewsSnapshot = await getDocs(interviewsQuery);
    
    console.log('\n📋 INTERVIEWS ENCONTRADAS:');
    interviewsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.candidateId === 1750275097840 || data.candidateId === '1750275097840') {
        console.log(`✅ Interview ID: ${doc.id}`, {
          candidateId: data.candidateId,
          status: data.status,
          jobId: data.jobId,
          selectionId: data.selectionId
        });
      }
    });
    
    // Buscar responses
    const responsesQuery = query(collection(db, 'responses'));
    const responsesSnapshot = await getDocs(responsesQuery);
    
    console.log('\n📋 RESPONSES ENCONTRADAS:');
    responsesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.interviewId?.includes('1750275097840') || 
          data.candidatePhone === '5511984316526' ||
          data.audioFile?.includes('5511984316526')) {
        console.log(`✅ Response ID: ${doc.id}`, {
          interviewId: data.interviewId,
          audioFile: data.audioFile,
          transcription: data.transcription,
          candidatePhone: data.candidatePhone
        });
      }
    });
    
    // Buscar interview_responses
    const interviewResponsesQuery = query(collection(db, 'interview_responses'));
    const interviewResponsesSnapshot = await getDocs(interviewResponsesQuery);
    
    console.log('\n📋 INTERVIEW_RESPONSES ENCONTRADAS:');
    interviewResponsesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.numero === '5511984316526' || data.candidatePhone === '5511984316526') {
        console.log(`✅ Interview Response ID: ${doc.id}`, {
          nome: data.nome,
          numero: data.numero,
          respostaTexto: data.respostaTexto?.substring(0, 50) + '...',
          respostaAudioUrl: data.respostaAudioUrl
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkDanielData();