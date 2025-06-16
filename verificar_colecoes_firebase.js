import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function verificarColecoesFirebase() {
  try {
    console.log('🔍 Verificando coleções no Firebase...');
    
    // Lista das coleções que esperamos encontrar
    const colecoesEsperadas = [
      'clients',
      'jobs', 
      'candidates',
      'selections',
      'interviews',
      'responses',
      'candidateLists',
      'clientUsers',
      'apiConfigs', // Esta é a única tabela de configuração no schema
      'clientVoiceSettings'
    ];
    
    // Verificar também possíveis variações de config
    const possiveisConfigs = [
      'config',
      'configs', 
      'apiConfig',
      'apiConfigs',
      'configurations',
      'settings'
    ];
    
    console.log('\n📊 Verificando coleções esperadas:');
    for (const colecao of colecoesEsperadas) {
      try {
        const snapshot = await getDocs(collection(db, colecao));
        console.log(`✅ ${colecao}: ${snapshot.size} documentos`);
      } catch (error) {
        console.log(`❌ ${colecao}: Não encontrada ou erro`);
      }
    }
    
    console.log('\n🔍 Verificando possíveis duplicações de config:');
    for (const colecao of possiveisConfigs) {
      try {
        const snapshot = await getDocs(collection(db, colecao));
        if (snapshot.size > 0) {
          console.log(`⚠️  ${colecao}: ${snapshot.size} documentos encontrados`);
          snapshot.forEach(doc => {
            console.log(`   - ID: ${doc.id}, dados: ${JSON.stringify(doc.data(), null, 2).substring(0, 200)}...`);
          });
        } else {
          console.log(`✅ ${colecao}: Coleção vazia ou não existe`);
        }
      } catch (error) {
        console.log(`❌ ${colecao}: Erro ao acessar`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar coleções:', error.message);
  }
}

verificarColecoesFirebase();