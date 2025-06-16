import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function buscarJacqueline() {
  console.log('🔍 Buscando candidata Jacqueline de Souza no Firebase...\n');
  
  // Buscar em candidates
  console.log('📋 COLEÇÃO: candidates');
  const candidatesRef = collection(db, 'candidates');
  const candidatesSnapshot = await getDocs(candidatesRef);
  
  candidatesSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.name && data.name.toLowerCase().includes('jacqueline')) {
      console.log(`✅ ENCONTRADA EM candidates/${doc.id}:`);
      console.log(`   Nome: ${data.name}`);
      console.log(`   Email: ${data.email || 'N/A'}`);
      console.log(`   WhatsApp: ${data.whatsapp || data.phone || 'N/A'}`);
      console.log(`   Criado em: ${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString('pt-BR') : 'N/A'}`);
      console.log(`   Dados completos:`);
      console.log(JSON.stringify(data, null, 2));
      console.log('');
    }
  });
  
  // Buscar em interviews
  console.log('📋 COLEÇÃO: interviews');
  const interviewsRef = collection(db, 'interviews');
  const interviewsSnapshot = await getDocs(interviewsRef);
  
  interviewsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.candidateName && data.candidateName.toLowerCase().includes('jacqueline')) {
      console.log(`✅ ENCONTRADA EM interviews/${doc.id}:`);
      console.log(`   Nome do candidato: ${data.candidateName}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Candidate ID: ${data.candidateId}`);
      console.log(`   Selection ID: ${data.selectionId}`);
      console.log(`   Token: ${data.token}`);
      console.log(`   Iniciada em: ${data.startedAt ? new Date(data.startedAt.seconds * 1000).toLocaleString('pt-BR') : 'N/A'}`);
      console.log(`   Completada em: ${data.completedAt ? new Date(data.completedAt.seconds * 1000).toLocaleString('pt-BR') : 'N/A'}`);
      console.log(`   Dados completos:`);
      console.log(JSON.stringify(data, null, 2));
      console.log('');
    }
  });
  
  // Buscar em responses da entrevista 1750034816177 (baseado nos logs)
  console.log('📋 COLEÇÃO: responses (Interview ID: 1750034816177)');
  const responsesRef = collection(db, 'responses');
  const responsesSnapshot = await getDocs(responsesRef);
  
  let jacquelineResponses = [];
  responsesSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.interviewId === 1750034816177) {
      jacquelineResponses.push({
        id: doc.id,
        ...data
      });
    }
  });
  
  if (jacquelineResponses.length > 0) {
    console.log(`✅ RESPOSTAS DA JACQUELINE ENCONTRADAS (${jacquelineResponses.length} respostas):`);
    jacquelineResponses.forEach((response, index) => {
      console.log(`   === RESPOSTA ${index + 1} ===`);
      console.log(`   ID do documento: ${response.id}`);
      console.log(`   Question ID: ${response.questionId}`);
      console.log(`   Transcrição: ${response.transcription || 'N/A'}`);
      console.log(`   Score: ${response.score || 'N/A'}`);
      console.log(`   Audio URL: ${response.audioUrl || 'N/A'}`);
      console.log(`   Duração: ${response.recordingDuration || 'N/A'}s`);
      console.log(`   Criado em: ${response.createdAt ? new Date(response.createdAt.seconds * 1000).toLocaleString('pt-BR') : 'N/A'}`);
      console.log('');
    });
  }
  
  // Buscar em candidate-list-memberships
  console.log('📋 COLEÇÃO: candidate-list-memberships');
  const membershipsRef = collection(db, 'candidate-list-memberships');
  const membershipsSnapshot = await getDocs(membershipsRef);
  
  membershipsSnapshot.forEach((doc) => {
    const data = doc.data();
    // Buscar por ID de candidato que pode ser da Jacqueline
    if (data.candidateId === 1750025475264) {
      console.log(`✅ MEMBERSHIP ENCONTRADA EM candidate-list-memberships/${doc.id}:`);
      console.log(`   Candidate ID: ${data.candidateId}`);
      console.log(`   List ID: ${data.listId}`);
      console.log(`   Client ID: ${data.clientId}`);
      console.log(`   Criado em: ${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString('pt-BR') : 'N/A'}`);
      console.log(`   Dados completos:`);
      console.log(JSON.stringify(data, null, 2));
      console.log('');
    }
  });
  
  console.log('🔍 Busca concluída.');
}

buscarJacqueline().catch(console.error);