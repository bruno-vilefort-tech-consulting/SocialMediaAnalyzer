// Teste de conectividade Firebase
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAFvUSbvTuXuo6KVt4ApG2OSOvXs7AkRx4",
  authDomain: "entrevistaia-cf7b4.firebaseapp.com",
  projectId: "entrevistaia-cf7b4",
  storageBucket: "entrevistaia-cf7b4.firebasestorage.app",
  messagingSenderId: "746157638477",
  appId: "1:746157638477:web:0d55b46c3fbf9a72e8ed04"
};

async function testFirebaseConnectivity() {
  try {
    console.log('🔥 Testando conectividade Firebase...\n');

    // Inicializar Firebase
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app);
    
    console.log('✅ Firebase inicializado com sucesso');
    console.log('📦 Project ID:', firebaseConfig.projectId);
    
    // Testar coleções principais
    const collections = ['clients', 'jobs', 'candidates', 'selections', 'interviews'];
    
    for (const collectionName of collections) {
      try {
        const snapshot = await getDocs(collection(db, collectionName));
        console.log(`📊 Coleção '${collectionName}': ${snapshot.size} documentos`);
        
        if (snapshot.size > 0) {
          const firstDoc = snapshot.docs[0];
          console.log(`   ├─ Primeiro documento ID: ${firstDoc.id}`);
          console.log(`   └─ Campos: ${Object.keys(firstDoc.data()).join(', ')}`);
        }
      } catch (error) {
        console.log(`❌ Erro ao acessar coleção '${collectionName}':`, error.message);
      }
    }
    
    console.log('\n🎉 Teste de conectividade Firebase concluído!');
    
  } catch (error) {
    console.error('❌ Erro na conectividade Firebase:', error);
  }
}

testFirebaseConnectivity();