import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDocs, collection } from 'firebase/firestore';

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

async function fixJacquelineInterview() {
  console.log('🔧 Corrigindo entrevista da Jacqueline...');
  
  try {
    // 1. Buscar todas as Jacquelines
    const candidatesSnapshot = await getDocs(collection(db, 'candidates'));
    const jacquelines = [];
    
    candidatesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.toLowerCase().includes('jacqueline')) {
        jacquelines.push({ id: doc.id, ...data });
        console.log(`📋 Jacqueline encontrada: ${data.name} (ID: ${doc.id}) - Lista: ${data.listId}`);
      }
    });
    
    // 2. Encontrar a Jacqueline na lista correta (1750034659590)
    const correctJacqueline = jacquelines.find(j => j.listId == 1750034659590 || j.listId === '1750034659590');
    const wrongJacqueline = jacquelines.find(j => j.listId == 1750025242993 || j.listId === '1750025242993');
    
    if (!correctJacqueline) {
      console.log('❌ Jacqueline na lista correta não encontrada');
      return;
    }
    
    if (!wrongJacqueline) {
      console.log('❌ Jacqueline na lista errada não encontrada');
      return;
    }
    
    console.log(`✅ Jacqueline correta: ${correctJacqueline.name} (ID: ${correctJacqueline.id}) - Lista: ${correctJacqueline.listId}`);
    console.log(`⚠️ Jacqueline errada: ${wrongJacqueline.name} (ID: ${wrongJacqueline.id}) - Lista: ${wrongJacqueline.listId}`);
    
    // 3. Buscar entrevista da Jacqueline errada
    const interviewsSnapshot = await getDocs(collection(db, 'interviews'));
    let interviewToFix = null;
    
    interviewsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.candidateId === wrongJacqueline.id) {
        interviewToFix = { id: doc.id, ...data };
        console.log(`🔍 Entrevista encontrada: ID ${doc.id} - candidateId: ${data.candidateId}`);
      }
    });
    
    if (!interviewToFix) {
      console.log('❌ Entrevista da Jacqueline errada não encontrada');
      return;
    }
    
    // 4. Atualizar a entrevista para apontar para a Jacqueline correta
    console.log(`🔄 Atualizando entrevista ${interviewToFix.id}:`);
    console.log(`   candidateId: ${wrongJacqueline.id} → ${correctJacqueline.id}`);
    console.log(`   candidateName: ${interviewToFix.candidateName} → ${correctJacqueline.name}`);
    
    await updateDoc(doc(db, 'interviews', interviewToFix.id), {
      candidateId: correctJacqueline.id,
      candidateName: correctJacqueline.name,
      phone: correctJacqueline.whatsapp || correctJacqueline.phone || interviewToFix.phone
    });
    
    console.log(`✅ Entrevista atualizada com sucesso!`);
    console.log(`🎉 Agora a Jacqueline aparecerá corretamente na seleção "Professora Infantil 2"`);
    
  } catch (error) {
    console.error('❌ Erro ao corrigir entrevista da Jacqueline:', error);
  }
}

fixJacquelineInterview().then(() => {
  console.log('🏁 Correção da entrevista concluída - teste os relatórios agora');
  process.exit(0);
}).catch(console.error);