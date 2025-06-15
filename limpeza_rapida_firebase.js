import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function limpezaRapidaFirebase() {
  console.log('🧹 Limpeza rápida do Firebase...');
  
  try {
    // Deletar em lotes para melhor performance
    const collections = ['responses', 'interviews', 'selections', 'message_logs'];
    
    for (const collectionName of collections) {
      console.log(`🗑️ Limpando ${collectionName}...`);
      
      const snapshot = await getDocs(collection(db, collectionName));
      const batchSize = 500; // Firestore limit
      
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const currentBatch = snapshot.docs.slice(i, i + batchSize);
        
        currentBatch.forEach((docRef) => {
          batch.delete(doc(db, collectionName, docRef.id));
        });
        
        await batch.commit();
        console.log(`   ✅ ${Math.min(batchSize, currentBatch.length)} documentos deletados`);
      }
      
      console.log(`✅ ${collectionName}: ${snapshot.docs.length} total deletados`);
    }
    
    // Verificação final
    console.log('\n🔍 Verificação final...');
    const interviewsCheck = await getDocs(collection(db, 'interviews'));
    const responsesCheck = await getDocs(collection(db, 'responses'));
    const selectionsCheck = await getDocs(collection(db, 'selections'));
    
    console.log(`📊 Restante: ${interviewsCheck.size} entrevistas, ${responsesCheck.size} respostas, ${selectionsCheck.size} seleções`);
    
    if (interviewsCheck.size === 0 && responsesCheck.size === 0 && selectionsCheck.size === 0) {
      console.log('🎉 Dashboard zerado com sucesso!');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

limpezaRapidaFirebase();