// Script para limpar estruturas duplicadas no Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function limparDuplicatasFirebase() {
  try {
    console.log('🧹 Iniciando limpeza de estruturas duplicadas...\n');
    
    // 1. Deletar candidate-list-memberships (versão com hífen)
    console.log('🗑️ Removendo coleção candidate-list-memberships...');
    const membershipsDashSnapshot = await getDocs(collection(db, 'candidate-list-memberships'));
    let deletedMemberships = 0;
    
    for (const docRef of membershipsDashSnapshot.docs) {
      await deleteDoc(doc(db, 'candidate-list-memberships', docRef.id));
      deletedMemberships++;
    }
    console.log(`   ✅ ${deletedMemberships} documentos deletados`);
    
    // 2. Deletar candidate-lists (versão com hífen)
    console.log('\n🗑️ Removendo coleção candidate-lists...');
    const listsDashSnapshot = await getDocs(collection(db, 'candidate-lists'));
    let deletedLists = 0;
    
    for (const docRef of listsDashSnapshot.docs) {
      await deleteDoc(doc(db, 'candidate-lists', docRef.id));
      deletedLists++;
    }
    console.log(`   ✅ ${deletedLists} documentos deletados`);
    
    // 3. Verificar estruturas restantes
    console.log('\n📊 Verificando estruturas finais...');
    
    const finalMemberships = await getDocs(collection(db, 'candidateListMemberships'));
    console.log(`   📋 candidateListMemberships: ${finalMemberships.size} documentos`);
    
    const finalLists = await getDocs(collection(db, 'candidateLists'));
    console.log(`   📝 candidateLists: ${finalLists.size} documentos`);
    
    const finalCandidates = await getDocs(collection(db, 'candidates'));
    console.log(`   👥 candidates: ${finalCandidates.size} documentos`);
    
    console.log('\n🎉 Limpeza concluída! Estrutura final:');
    console.log('=====================================');
    console.log('✅ candidateListMemberships (associações)');
    console.log('✅ candidateLists (listas)');  
    console.log('✅ candidates (candidatos)');
    console.log('❌ candidate-list-memberships (REMOVIDA)');
    console.log('❌ candidate-lists (REMOVIDA)');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

limparDuplicatasFirebase();