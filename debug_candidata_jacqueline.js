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

async function debugCandidataJacqueline() {
  console.log('🔍 Buscando dados da candidata Jacqueline...');
  
  try {
    // Buscar todos os candidatos
    const candidatesRef = collection(db, 'candidates');
    const candidatesSnapshot = await getDocs(candidatesRef);
    
    console.log(`📊 Total de candidatos encontrados: ${candidatesSnapshot.size}`);
    
    candidatesSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`📝 Candidato: ${data.name} | WhatsApp: ${data.whatsapp} | Email: ${data.email}`);
      
      if (data.name.includes('Jacqueline')) {
        console.log(`🎯 ENCONTRADA: ${JSON.stringify(data, null, 2)}`);
      }
    });
    
    // Buscar especificamente pelo telefone
    console.log('\n🔍 Buscando pelo telefone 5511994640330...');
    const phoneQuery = query(candidatesRef, where('whatsapp', '==', '5511994640330'));
    const phoneSnapshot = await getDocs(phoneQuery);
    
    if (phoneSnapshot.empty) {
      console.log('❌ Nenhum candidato encontrado com esse telefone');
      
      // Tentar variações do telefone
      const variations = [
        '11994640330',
        '+5511994640330',
        '551194640330',
        '1194640330'
      ];
      
      for (const variation of variations) {
        console.log(`🔍 Tentando variação: ${variation}`);
        const varQuery = query(candidatesRef, where('whatsapp', '==', variation));
        const varSnapshot = await getDocs(varQuery);
        
        if (!varSnapshot.empty) {
          varSnapshot.forEach((doc) => {
            console.log(`✅ ENCONTRADO com variação ${variation}: ${JSON.stringify(doc.data(), null, 2)}`);
          });
        }
      }
    } else {
      phoneSnapshot.forEach((doc) => {
        console.log(`✅ ENCONTRADO: ${JSON.stringify(doc.data(), null, 2)}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao buscar candidatos:', error);
  }
}

debugCandidataJacqueline();