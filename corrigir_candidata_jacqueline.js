import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function corrigirCandidataJacqueline() {
  console.log('🔧 Corrigindo dados da candidata Jacqueline...');
  
  try {
    // Buscar a candidata Jacqueline
    const candidatesRef = collection(db, 'candidates');
    const jacquelineQuery = query(candidatesRef, where('name', '==', 'Jacqueline de Souza'));
    const jacquelineSnapshot = await getDocs(jacquelineQuery);
    
    if (jacquelineSnapshot.empty) {
      console.log('❌ Candidata Jacqueline não encontrada');
      return;
    }
    
    const jacquelineDoc = jacquelineSnapshot.docs[0];
    const jacquelineData = jacquelineDoc.data();
    
    console.log('📝 Dados atuais da Jacqueline:', jacquelineData);
    
    // Atualizar o campo whatsapp com o valor do campo phone
    if (jacquelineData.phone && !jacquelineData.whatsapp) {
      const phoneWithPrefix = `55${jacquelineData.phone}`;
      
      await updateDoc(doc(db, 'candidates', jacquelineDoc.id), {
        whatsapp: phoneWithPrefix
      });
      
      console.log(`✅ Campo whatsapp atualizado para: ${phoneWithPrefix}`);
      
      // Verificar a atualização
      const updatedDoc = await getDocs(query(candidatesRef, where('name', '==', 'Jacqueline de Souza')));
      const updatedData = updatedDoc.docs[0].data();
      console.log('📝 Dados atualizados:', updatedData);
    } else {
      console.log('⚠️ Campo phone não encontrado ou whatsapp já existe');
    }
    
  } catch (error) {
    console.error('❌ Erro ao corrigir candidata:', error);
  }
}

corrigirCandidataJacqueline();