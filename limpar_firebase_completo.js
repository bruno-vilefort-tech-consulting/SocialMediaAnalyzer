import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Configuração Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

async function limparFirebaseCompleto() {
  console.log('🧹 Iniciando limpeza completa do Firebase...');
  
  try {
    const app = initializeApp(firebaseConfig);
    const firebaseDb = getFirestore(app);
    
    // 1. Deletar candidate-list-memberships
    console.log('🗑️ Deletando candidate-list-memberships...');
    const membershipsSnapshot = await getDocs(collection(firebaseDb, 'candidate-list-memberships'));
    console.log(`📊 Encontrados ${membershipsSnapshot.size} memberships`);
    
    for (const membershipDoc of membershipsSnapshot.docs) {
      await deleteDoc(doc(firebaseDb, 'candidate-list-memberships', membershipDoc.id));
    }
    console.log(`✅ ${membershipsSnapshot.size} memberships deletados`);
    
    // 2. Deletar candidatos
    console.log('🗑️ Deletando candidatos...');
    const candidatesSnapshot = await getDocs(collection(firebaseDb, 'candidates'));
    console.log(`📊 Encontrados ${candidatesSnapshot.size} candidatos`);
    
    for (const candidateDoc of candidatesSnapshot.docs) {
      await deleteDoc(doc(firebaseDb, 'candidates', candidateDoc.id));
    }
    console.log(`✅ ${candidatesSnapshot.size} candidatos deletados`);
    
    // 3. Deletar listas de candidatos
    console.log('🗑️ Deletando listas de candidatos...');
    const listsSnapshot = await getDocs(collection(firebaseDb, 'candidate-lists'));
    console.log(`📊 Encontradas ${listsSnapshot.size} listas`);
    
    for (const listDoc of listsSnapshot.docs) {
      await deleteDoc(doc(firebaseDb, 'candidate-lists', listDoc.id));
    }
    console.log(`✅ ${listsSnapshot.size} listas deletadas`);
    
    // 4. Verificação final
    console.log('\n📊 Verificação final...');
    const finalCandidates = await getDocs(collection(firebaseDb, 'candidates'));
    const finalLists = await getDocs(collection(firebaseDb, 'candidate-lists'));
    const finalMemberships = await getDocs(collection(firebaseDb, 'candidate-list-memberships'));
    
    console.log(`📋 Candidatos restantes: ${finalCandidates.size}`);
    console.log(`📋 Listas restantes: ${finalLists.size}`);
    console.log(`📋 Memberships restantes: ${finalMemberships.size}`);
    
    if (finalCandidates.size === 0 && finalLists.size === 0 && finalMemberships.size === 0) {
      console.log('🎉 Limpeza completa realizada com sucesso!');
    } else {
      console.log('⚠️ Alguns registros ainda permanecem');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    process.exit(1);
  }
}

limparFirebaseCompleto();