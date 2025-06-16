import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const firebaseDb = getFirestore(app);

async function limparListasECandidatos() {
  console.log('🧹 Iniciando limpeza de listas e candidatos...');
  
  try {
    // 1. Deletar todos os candidate-list-memberships
    console.log('🗑️ Deletando candidate-list-memberships...');
    const membershipsSnapshot = await getDocs(collection(firebaseDb, 'candidate-list-memberships'));
    let membershipsCount = 0;
    
    for (const docSnapshot of membershipsSnapshot.docs) {
      await deleteDoc(doc(firebaseDb, 'candidate-list-memberships', docSnapshot.id));
      membershipsCount++;
    }
    
    console.log(`✅ ${membershipsCount} memberships deletados`);

    // 2. Deletar todos os candidatos
    console.log('🗑️ Deletando candidatos...');
    const candidatesSnapshot = await getDocs(collection(firebaseDb, 'candidates'));
    let candidatesCount = 0;
    
    for (const docSnapshot of candidatesSnapshot.docs) {
      await deleteDoc(doc(firebaseDb, 'candidates', docSnapshot.id));
      candidatesCount++;
    }
    
    console.log(`✅ ${candidatesCount} candidatos deletados`);

    // 3. Deletar todas as listas de candidatos
    console.log('🗑️ Deletando listas de candidatos...');
    const listsSnapshot = await getDocs(collection(firebaseDb, 'candidate-lists'));
    let listsCount = 0;
    
    for (const docSnapshot of listsSnapshot.docs) {
      await deleteDoc(doc(firebaseDb, 'candidate-lists', docSnapshot.id));
      listsCount++;
    }
    
    console.log(`✅ ${listsCount} listas deletadas`);

    // 4. Verificação final
    console.log('\n📊 Verificação final:');
    const finalCandidates = await getDocs(collection(firebaseDb, 'candidates'));
    const finalLists = await getDocs(collection(firebaseDb, 'candidate-lists'));
    const finalMemberships = await getDocs(collection(firebaseDb, 'candidate-list-memberships'));
    
    console.log(`📋 Candidatos restantes: ${finalCandidates.size}`);
    console.log(`📋 Listas restantes: ${finalLists.size}`);
    console.log(`📋 Memberships restantes: ${finalMemberships.size}`);
    
    if (finalCandidates.size === 0 && finalLists.size === 0 && finalMemberships.size === 0) {
      console.log('🎉 Limpeza completa realizada com sucesso!');
    } else {
      console.log('⚠️ Alguns itens ainda permanecem no banco');
    }

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
  }
}

limparListasECandidatos();