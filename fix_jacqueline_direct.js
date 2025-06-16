import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixJacquelineList() {
  console.log('🔧 Corrigindo lista da Jacqueline diretamente...');
  
  try {
    // 1. Buscar a Jacqueline
    const candidatesSnapshot = await getDocs(collection(db, 'candidates'));
    let jacqueline = null;
    
    candidatesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.toLowerCase().includes('jacqueline')) {
        jacqueline = { id: doc.id, ...data };
        console.log(`✅ Jacqueline encontrada: ${data.name} (ID: ${doc.id}) - Lista atual: ${data.listId}`);
      }
    });
    
    if (!jacqueline) {
      console.log('❌ Jacqueline não encontrada');
      return;
    }
    
    // 2. Buscar a seleção "Professora Infantil 2"
    const selectionsSnapshot = await getDocs(collection(db, 'selections'));
    let targetSelection = null;
    
    selectionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.includes('Professora Infantil 2')) {
        targetSelection = { id: doc.id, ...data };
        console.log(`✅ Seleção "Professora Infantil 2" encontrada: ID ${doc.id} - candidateListId: ${data.candidateListId}`);
      }
    });
    
    if (!targetSelection) {
      console.log('❌ Seleção "Professora Infantil 2" não encontrada');
      return;
    }
    
    // 3. Atualizar a lista da Jacqueline
    const newListId = targetSelection.candidateListId;
    console.log(`🔄 Atualizando lista da Jacqueline de ${jacqueline.listId} para ${newListId}...`);
    
    await updateDoc(doc(db, 'candidates', jacqueline.id), {
      listId: newListId
    });
    
    console.log(`✅ Jacqueline atualizada com sucesso! Lista: ${jacqueline.listId} → ${newListId}`);
    console.log(`🎉 Agora a Jacqueline aparecerá na seleção "Professora Infantil 2" nos relatórios`);
    
  } catch (error) {
    console.error('❌ Erro ao corrigir lista da Jacqueline:', error);
  }
}

fixJacquelineList().then(() => {
  console.log('🏁 Correção concluída - teste os relatórios agora');
  process.exit(0);
}).catch(console.error);