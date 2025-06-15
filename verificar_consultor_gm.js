import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarConsultorGM() {
  console.log('🔍 Investigando seleção "Consultor GM"...');
  
  try {
    // Buscar a seleção Consultor GM
    const selectionsRef = collection(db, 'selections');
    const q = query(selectionsRef, where('name', '==', 'Consultor GM'));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('❌ Seleção Consultor GM não encontrada');
      return;
    }
    
    let selecaoData;
    querySnapshot.forEach((doc) => {
      selecaoData = { id: doc.id, ...doc.data() };
      console.log(`📄 Seleção encontrada: ${doc.id}`);
      console.log('📋 Dados da seleção:', JSON.stringify(selecaoData, null, 2));
    });
    
    // Buscar candidatos da lista associada
    if (selecaoData && selecaoData.candidateListId) {
      console.log(`\n🔍 Buscando candidatos da lista: ${selecaoData.candidateListId}`);
      
      const candidatesRef = collection(db, 'candidates');
      const candidatesQuery = query(candidatesRef, where('listId', '==', selecaoData.candidateListId));
      const candidatesSnapshot = await getDocs(candidatesQuery);
      
      if (candidatesSnapshot.empty) {
        console.log('❌ Nenhum candidato encontrado nesta lista');
        return;
      }
      
      console.log(`📊 ${candidatesSnapshot.size} candidato(s) encontrado(s):`);
      
      candidatesSnapshot.forEach((candidateDoc) => {
        const candidateData = candidateDoc.data();
        console.log(`\n👤 Candidato: ${candidateData.name} (ID: ${candidateDoc.id})`);
        console.log(`📧 Email: ${candidateData.email || 'N/A'}`);
        console.log(`📱 WhatsApp: ${candidateData.whatsapp || 'N/A'}`);
        console.log(`📞 Phone: ${candidateData.phone || 'N/A'}`);
        console.log(`📋 ListId: ${candidateData.listId || 'N/A'}`);
        
        // Se Daniel Lima não tem WhatsApp, vamos corrigir
        if (candidateData.name === 'Daniel Lima' && !candidateData.whatsapp && candidateData.phone) {
          console.log(`\n🔧 Corrigindo WhatsApp para ${candidateData.name}...`);
          const candidateRef = doc(db, 'candidates', candidateDoc.id);
          updateDoc(candidateRef, {
            whatsapp: candidateData.phone
          }).then(() => {
            console.log(`✅ WhatsApp atualizado para ${candidateData.name}: ${candidateData.phone}`);
          }).catch(error => {
            console.error(`❌ Erro ao atualizar WhatsApp:`, error);
          });
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar seleção:', error);
  }
}

verificarConsultorGM();