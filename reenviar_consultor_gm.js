import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function reenviarConsultorGM() {
  console.log('🚀 Reenviando campanha WhatsApp para Consultor GM...');
  
  try {
    // Fazer chamada para a API de reenvio
    const response = await fetch('http://localhost:5000/api/whatsapp-qr/send-campaign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.AUTH_TOKEN
      },
      body: JSON.stringify({
        selectionId: 1750028451224
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Campanha reenviada com sucesso:', result);
    } else {
      console.log('❌ Erro ao reenviar campanha:', response.status);
    }
    
    // Verificar candidatos atualizados
    console.log('\n🔍 Verificando candidatos atualizados...');
    const candidatesRef = collection(db, 'candidates');
    const candidatesQuery = query(candidatesRef, where('listId', '==', 1750028384289));
    const candidatesSnapshot = await getDocs(candidatesQuery);
    
    candidatesSnapshot.forEach((candidateDoc) => {
      const candidateData = candidateDoc.data();
      console.log(`👤 ${candidateData.name}: WhatsApp = ${candidateData.whatsapp || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao reenviar campanha:', error);
  }
}

reenviarConsultorGM();