import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deletarListaDaniel() {
  console.log('🔍 Buscando lista "Daniel - Teste Campo Celular"...');
  
  try {
    // Buscar a lista pelo nome
    const listsRef = collection(db, 'candidateLists');
    const q = query(listsRef, where('name', '==', 'Lista Daniel - Teste Campo Celular'));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('❌ Lista não encontrada');
      return;
    }
    
    // Deletar cada documento encontrado
    const deletePromises = [];
    querySnapshot.forEach((document) => {
      console.log(`📄 Encontrada lista: ${document.id} - ${document.data().name}`);
      deletePromises.push(deleteDoc(doc(db, 'candidateLists', document.id)));
    });
    
    await Promise.all(deletePromises);
    console.log(`✅ ${deletePromises.length} lista(s) deletada(s) com sucesso!`);
    
    // Verificar se há candidatos associados para deletar também
    console.log('🔍 Verificando candidatos associados...');
    querySnapshot.forEach(async (document) => {
      const listId = document.id;
      const candidatesRef = collection(db, 'candidates');
      const candidatesQuery = query(candidatesRef, where('listId', '==', listId));
      const candidatesSnapshot = await getDocs(candidatesQuery);
      
      if (!candidatesSnapshot.empty) {
        console.log(`📄 Encontrados ${candidatesSnapshot.size} candidatos associados`);
        const deleteCandidatePromises = [];
        candidatesSnapshot.forEach((candidateDoc) => {
          console.log(`👤 Deletando candidato: ${candidateDoc.data().name}`);
          deleteCandidatePromises.push(deleteDoc(doc(db, 'candidates', candidateDoc.id)));
        });
        await Promise.all(deleteCandidatePromises);
        console.log(`✅ ${deleteCandidatePromises.length} candidato(s) deletado(s)`);
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao deletar lista:', error);
  }
}

deletarListaDaniel();