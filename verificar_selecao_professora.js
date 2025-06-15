import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarSelecaoProfessora() {
  console.log('🔍 Verificando seleção "Professora Infantil"...');
  
  try {
    // 1. Buscar todas as seleções
    console.log('\n📋 Buscando todas as seleções...');
    const selectionsSnapshot = await getDocs(collection(db, 'selections'));
    
    if (selectionsSnapshot.empty) {
      console.log('❌ Nenhuma seleção encontrada no Firebase');
      return;
    }
    
    selectionsSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`📊 Seleção: ${data.nomeSelecao || data.title || 'Nome não definido'}`);
      console.log(`   - ID: ${doc.id}`);
      console.log(`   - Job ID: ${data.jobId}`);
      console.log(`   - Status: ${data.status}`);
      console.log(`   - Data: ${data.createdAt?.toDate?.()}`);
      console.log('');
    });

    // 2. Buscar entrevistas relacionadas à vaga "Professora Infantil"
    console.log('🎯 Buscando entrevistas da vaga "Professora Infantil"...');
    const interviewsSnapshot = await getDocs(collection(db, 'interviews'));
    
    if (interviewsSnapshot.empty) {
      console.log('❌ Nenhuma entrevista encontrada no Firebase');
    } else {
      console.log(`📊 Total de entrevistas: ${interviewsSnapshot.size}`);
      
      interviewsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`🎯 Entrevista ID: ${doc.id}`);
        console.log(`   - Job ID: ${data.jobId}`);
        console.log(`   - Candidato: ${data.candidateName}`);
        console.log(`   - Status: ${data.status}`);
        console.log(`   - Telefone: ${data.candidatePhone}`);
        console.log('');
      });
    }

    // 3. Verificar a vaga "Professora Infantil"
    console.log('📄 Verificando vaga "Professora Infantil"...');
    const jobsSnapshot = await getDocs(collection(db, 'jobs'));
    
    let professoraJob = null;
    jobsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.nomeVaga && data.nomeVaga.toLowerCase().includes('professora')) {
        professoraJob = { id: doc.id, ...data };
        console.log(`✅ Vaga encontrada: ${data.nomeVaga} (ID: ${doc.id})`);
      }
    });

    if (!professoraJob) {
      console.log('❌ Vaga "Professora Infantil" não encontrada');
      return;
    }

    // 4. Verificar respostas das entrevistas
    console.log('\n📝 Verificando respostas das entrevistas...');
    const responsesSnapshot = await getDocs(collection(db, 'responses'));
    
    if (responsesSnapshot.empty) {
      console.log('❌ Nenhuma resposta encontrada no Firebase');
    } else {
      console.log(`📊 Total de respostas: ${responsesSnapshot.size}`);
      
      responsesSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`💬 Resposta ID: ${doc.id}`);
        console.log(`   - Interview ID: ${data.interviewId}`);
        console.log(`   - Transcrição: ${data.transcription?.substring(0, 50)}...`);
        console.log(`   - Audio URL: ${data.audioUrl}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

verificarSelecaoProfessora();