// Script para verificar todas as coleções relacionadas a candidatos no Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function verificarEstruturasFirebase() {
  try {
    const collections = [
      'candidate-list-memberships',
      'candidate-lists', 
      'candidateListMemberships',
      'candidateLists',
      'candidates'
    ];
    
    for (const collectionName of collections) {
      console.log(`\n🔍 Verificando coleção: ${collectionName}`);
      
      try {
        const snapshot = await getDocs(collection(db, collectionName));
        
        if (snapshot.empty) {
          console.log(`   ❌ Coleção VAZIA ou NÃO EXISTE`);
          continue;
        }
        
        console.log(`   ✅ Coleção EXISTE com ${snapshot.size} documentos`);
        
        // Mostrar alguns exemplos de documentos
        let count = 0;
        snapshot.forEach(doc => {
          if (count < 2) { // Apenas primeiros 2 documentos
            console.log(`   📄 Documento ${doc.id}:`, JSON.stringify(doc.data(), null, 2));
            count++;
          }
        });
        
        if (snapshot.size > 2) {
          console.log(`   ... e mais ${snapshot.size - 2} documentos`);
        }
        
      } catch (error) {
        console.log(`   ❌ ERRO ao acessar: ${error.message}`);
      }
    }
    
    console.log('\n📊 RESUMO FINAL:');
    console.log('================');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

verificarEstruturasFirebase();