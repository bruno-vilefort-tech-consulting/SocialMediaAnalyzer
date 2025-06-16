import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarListasCandidatos() {
  console.log('🔍 Verificando nova arquitetura muitos-para-muitos...');
  
  try {
    // 1. Verificar candidatos
    const candidatesSnapshot = await getDocs(collection(db, 'candidates'));
    const candidates = candidatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`👥 Total de candidatos: ${candidates.length}`);
    
    // 2. Verificar memberships
    const membershipsSnapshot = await getDocs(collection(db, 'candidateListMemberships'));
    const memberships = membershipsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`🔗 Total de memberships: ${memberships.length}`);
    
    // 3. Verificar listas de candidatos
    const listsSnapshot = await getDocs(collection(db, 'candidateLists'));
    const lists = listsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`📋 Total de listas: ${lists.length}`);
    
    // 4. Mostrar relacionamentos
    console.log('\n🔗 Relacionamentos candidato-lista:');
    memberships.forEach(membership => {
      const candidate = candidates.find(c => parseInt(c.id) === membership.candidateId);
      const list = lists.find(l => parseInt(l.id) === membership.listId);
      
      console.log(`  • ${candidate?.name || 'Candidato ID ' + membership.candidateId} → ${list?.name || 'Lista ID ' + membership.listId} (Cliente ${membership.clientId})`);
    });
    
    // 5. Verificar candidatos sem clientId/listId
    const candidatesWithOldFields = candidates.filter(c => c.clientId || c.listId);
    console.log(`\n✅ Candidatos migrados (sem clientId/listId): ${candidates.length - candidatesWithOldFields.length}`);
    
    if (candidatesWithOldFields.length > 0) {
      console.log('⚠️ Candidatos que ainda têm campos antigos:');
      candidatesWithOldFields.forEach(c => {
        console.log(`  • ${c.name} (ID: ${c.id}) - clientId: ${c.clientId}, listId: ${c.listId}`);
      });
    }
    
    // 6. Verificar candidatos por lista
    console.log('\n📊 Candidatos por lista:');
    lists.forEach(list => {
      const listMemberships = memberships.filter(m => m.listId === parseInt(list.id));
      console.log(`  • ${list.name}: ${listMemberships.length} candidatos`);
      listMemberships.forEach(membership => {
        const candidate = candidates.find(c => parseInt(c.id) === membership.candidateId);
        console.log(`    - ${candidate?.name || 'ID ' + membership.candidateId}`);
      });
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error);
    process.exit(1);
  }
}

verificarListasCandidatos();