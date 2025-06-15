// Script para forçar exclusão da vaga problemática
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, deleteDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const firebaseDb = getFirestore(app);

async function forceDeleteJob() {
  try {
    const jobId = '174986729964277';
    console.log(`🔥 Forçando exclusão da vaga ${jobId}...`);
    
    // Verificar se existe
    const docRef = doc(firebaseDb, 'jobs', jobId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      console.log('❌ Vaga não encontrada no Firebase');
      return;
    }
    
    console.log('📄 Vaga encontrada:', docSnap.data());
    
    // Forçar exclusão
    await deleteDoc(docRef);
    console.log('✅ Exclusão executada');
    
    // Verificar novamente
    const checkDoc = await getDoc(docRef);
    if (!checkDoc.exists()) {
      console.log('✅ Vaga removida com sucesso!');
    } else {
      console.log('❌ Vaga ainda existe após exclusão');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

forceDeleteJob();