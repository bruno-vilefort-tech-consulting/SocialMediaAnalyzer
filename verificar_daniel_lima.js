// Script para verificar associações do Daniel Lima
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

// Configuração Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarDanielLima() {
  try {
    const danielId = 1750029553415;
    
    console.log(`🔍 Verificando associações do Daniel Lima (ID: ${danielId})...`);
    
    // Buscar associações na tabela candidateListMemberships
    const membershipsQuery = query(
      collection(db, 'candidateListMemberships'), 
      where('candidateId', '==', danielId)
    );
    const membershipsSnapshot = await getDocs(membershipsQuery);
    
    if (membershipsSnapshot.empty) {
      console.log('❌ Daniel Lima NÃO está associado a nenhuma lista!');
      return;
    }
    
    console.log(`✅ Daniel Lima está associado a ${membershipsSnapshot.size} lista(s):`);
    
    for (const doc of membershipsSnapshot.docs) {
      const membership = doc.data();
      console.log(`\n📋 Associação encontrada:`);
      console.log(`  - Membership ID: ${doc.id}`);
      console.log(`  - Candidate ID: ${membership.candidateId}`);
      console.log(`  - List ID: ${membership.listId}`);
      console.log(`  - Client ID: ${membership.clientId}`);
      console.log(`  - Created At: ${membership.createdAt?.toDate?.() || membership.createdAt}`);
      
      // Buscar nome da lista
      const listsSnapshot = await getDocs(collection(db, 'candidateLists'));
      const list = listsSnapshot.docs.find(doc => parseInt(doc.id) === membership.listId);
      if (list) {
        console.log(`  - Nome da Lista: "${list.data().name}"`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

verificarDanielLima();