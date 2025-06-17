import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore';

// Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBOLzafeOYNqGlFnqOHbv_yGOGQTY4nKCc",
  authDomain: "ai-interview-system-c1890.firebaseapp.com",
  projectId: "ai-interview-system-c1890",
  storageBucket: "ai-interview-system-c1890.firebasestorage.app",
  messagingSenderId: "542457067569",
  appId: "1:542457067569:web:71b98e7d30e0d1e4b3a5cb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixOrphanMemberships() {
  try {
    console.log('🔍 Verificando memberships órfãos...');
    
    // Buscar todos os memberships
    const membershipsSnapshot = await getDocs(collection(db, 'candidate-list-memberships'));
    const memberships = [];
    membershipsSnapshot.forEach(doc => {
      memberships.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`📊 Total de memberships encontrados: ${memberships.length}`);
    
    // Buscar todos os candidatos
    const candidatesSnapshot = await getDocs(collection(db, 'candidates'));
    const candidates = [];
    candidatesSnapshot.forEach(doc => {
      candidates.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`📊 Total de candidatos encontrados: ${candidates.length}`);
    
    // Buscar todos os candidate lists
    const listsSnapshot = await getDocs(collection(db, 'candidate-lists'));
    const lists = [];
    listsSnapshot.forEach(doc => {
      lists.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`📊 Total de listas encontradas: ${lists.length}`);
    
    // Identificar memberships órfãos
    const candidateIds = new Set(candidates.map(c => c.id));
    const listIds = new Set(lists.map(l => l.id));
    
    const orphanMemberships = memberships.filter(membership => {
      const candidateExists = candidateIds.has(membership.candidateId?.toString());
      const listExists = listIds.has(membership.listId?.toString());
      return !candidateExists || !listExists;
    });
    
    console.log(`🗑️ Memberships órfãos encontrados: ${orphanMemberships.length}`);
    
    // Deletar memberships órfãos
    for (const orphan of orphanMemberships) {
      console.log(`🗑️ Deletando membership órfão: ${orphan.id} (candidato: ${orphan.candidateId}, lista: ${orphan.listId})`);
      await deleteDoc(doc(db, 'candidate-list-memberships', orphan.id));
    }
    
    // Verificar novamente
    const finalMembershipsSnapshot = await getDocs(collection(db, 'candidate-list-memberships'));
    const finalCount = finalMembershipsSnapshot.size;
    
    console.log(`✅ Limpeza concluída. Memberships válidos restantes: ${finalCount}`);
    
    // Mostrar estatísticas por lista
    const validMembershipsSnapshot = await getDocs(collection(db, 'candidate-list-memberships'));
    const validMemberships = [];
    validMembershipsSnapshot.forEach(doc => {
      validMemberships.push({ id: doc.id, ...doc.data() });
    });
    
    const statsPerList = {};
    validMemberships.forEach(membership => {
      const listId = membership.listId;
      if (!statsPerList[listId]) {
        statsPerList[listId] = 0;
      }
      statsPerList[listId]++;
    });
    
    console.log('\n📊 Estatísticas por lista após limpeza:');
    for (const [listId, count] of Object.entries(statsPerList)) {
      const list = lists.find(l => l.id.toString() === listId.toString());
      console.log(`  Lista "${list?.name || 'Desconhecida'}" (ID: ${listId}): ${count} candidatos válidos`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao corrigir memberships órfãos:', error);
  }
}

fixOrphanMemberships();