import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function corrigirSelecaoProfessora() {
  console.log('🔧 Corrigindo dados da seleção "Professora Infantil"...');
  
  try {
    // 1. Corrigir a seleção - adicionar nome
    console.log('\n📝 Corrigindo seleção...');
    const selectionRef = doc(db, 'selections', '1750029587923');
    await updateDoc(selectionRef, {
      nomeSelecao: 'Seleção Professora Infantil',
      title: 'Seleção Professora Infantil'
    });
    console.log('✅ Seleção atualizada com nome');

    // 2. Corrigir a entrevista - adicionar dados do candidato e job
    console.log('\n🎯 Corrigindo entrevista...');
    const interviewRef = doc(db, 'interviews', '1750029682005');
    await updateDoc(interviewRef, {
      jobId: '1750025604495',
      candidateName: 'Daniel Moreira',
      candidatePhone: '5511984316526',
      jobName: 'Professora Infantil'
    });
    console.log('✅ Entrevista atualizada com dados do candidato');

    // 3. Verificar se as correções foram aplicadas
    console.log('\n🔍 Verificando correções...');
    
    const selectionDoc = await getDoc(selectionRef);
    const selectionData = selectionDoc.data();
    console.log(`📊 Seleção: ${selectionData.nomeSelecao}`);
    
    const interviewDoc = await getDoc(interviewRef);
    const interviewData = interviewDoc.data();
    console.log(`🎯 Entrevista: ${interviewData.candidateName} - ${interviewData.jobName}`);
    
    console.log('\n🎉 Correções aplicadas com sucesso!');
    console.log('📊 Agora a seleção "Professora Infantil" deve aparecer no relatório');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

corrigirSelecaoProfessora();