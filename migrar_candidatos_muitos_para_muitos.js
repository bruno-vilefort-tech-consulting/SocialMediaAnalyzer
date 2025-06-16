import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrarCandidatosParaNovaArquitetura() {
  console.log('🔄 Iniciando migração de candidatos para arquitetura muitos-para-muitos...');
  
  try {
    // 1. Buscar todos os candidatos existentes
    const candidatesSnapshot = await getDocs(collection(db, 'candidates'));
    const candidates = candidatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`📋 Encontrados ${candidates.length} candidatos para migrar`);
    
    const batch = writeBatch(db);
    let migrationCount = 0;
    
    // 2. Para cada candidato que tem clientId e listId, criar membership
    for (const candidate of candidates) {
      if (candidate.clientId && candidate.listId) {
        const membershipId = Date.now() + Math.floor(Math.random() * 1000) + migrationCount;
        const membershipData = {
          id: membershipId,
          candidateId: parseInt(candidate.id),
          listId: candidate.listId,
          clientId: candidate.clientId,
          createdAt: new Date()
        };
        
        // Criar membership
        const membershipRef = doc(db, 'candidateListMemberships', String(membershipId));
        batch.set(membershipRef, membershipData);
        
        // Atualizar candidato removendo clientId e listId
        const candidateRef = doc(db, 'candidates', String(candidate.id));
        const updatedCandidate = {
          ...candidate,
          clientId: undefined,
          listId: undefined
        };
        // Remove os campos undefined
        delete updatedCandidate.clientId;
        delete updatedCandidate.listId;
        
        batch.set(candidateRef, updatedCandidate);
        
        console.log(`✅ Candidato ${candidate.name} migrado para lista ${candidate.listId} do cliente ${candidate.clientId}`);
        migrationCount++;
      }
    }
    
    // 3. Executar batch
    if (migrationCount > 0) {
      await batch.commit();
      console.log(`🎉 Migração concluída! ${migrationCount} candidatos migrados para nova arquitetura`);
    } else {
      console.log('ℹ️ Nenhum candidato precisou ser migrado');
    }
    
    // 4. Verificar resultado
    const membershipsSnapshot = await getDocs(collection(db, 'candidateListMemberships'));
    console.log(`📊 Total de memberships criados: ${membershipsSnapshot.docs.length}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
}

migrarCandidatosParaNovaArquitetura();