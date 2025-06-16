// Script para associar candidatos existentes à lista "Daniel Infantil"
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, query, where } from 'firebase/firestore';

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

async function associarCandidatosExistentes() {
  try {
    console.log('🔍 Buscando candidatos existentes...');
    
    // Buscar todos os candidatos
    const candidatesSnapshot = await getDocs(collection(db, 'candidates'));
    const candidates = [];
    candidatesSnapshot.forEach(doc => {
      candidates.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`📋 Candidatos encontrados: ${candidates.length}`);
    candidates.forEach(candidate => {
      console.log(`  - ${candidate.name} (ID: ${candidate.id}, ClientID: ${candidate.clientId})`);
    });
    
    // Buscar a lista "Daniel Infantil"
    console.log('\n🔍 Buscando lista "Daniel Infantil"...');
    const listsQuery = query(collection(db, 'candidateLists'), where('name', '==', 'Daniel Infantil'));
    const listsSnapshot = await getDocs(listsQuery);
    
    if (listsSnapshot.empty) {
      console.log('❌ Lista "Daniel Infantil" não encontrada!');
      return;
    }
    
    const danielList = listsSnapshot.docs[0];
    const listData = { id: danielList.id, ...danielList.data() };
    console.log(`✅ Lista encontrada: ${listData.name} (ID: ${listData.id}, ClientID: ${listData.clientId})`);
    
    // Buscar associações existentes
    console.log('\n🔍 Verificando associações existentes...');
    const membershipsSnapshot = await getDocs(collection(db, 'candidateListMemberships'));
    const existingMemberships = [];
    membershipsSnapshot.forEach(doc => {
      existingMemberships.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`📋 Associações existentes: ${existingMemberships.length}`);
    existingMemberships.forEach(membership => {
      console.log(`  - Candidato ${membership.candidateId} → Lista ${membership.listId}`);
    });
    
    // Associar candidatos à lista
    console.log('\n🔗 Criando associações para candidatos...');
    let associacoesNovas = 0;
    
    for (const candidate of candidates) {
      // Verificar se já existe associação
      const jaAssociado = existingMemberships.some(m => 
        m.candidateId === parseInt(candidate.id) && m.listId === parseInt(listData.id)
      );
      
      if (jaAssociado) {
        console.log(`✅ ${candidate.name} já está associado à lista`);
        continue;
      }
      
      // Criar nova associação
      const membershipData = {
        candidateId: parseInt(candidate.id),
        listId: parseInt(listData.id),
        clientId: parseInt(listData.clientId),
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'candidateListMemberships'), membershipData);
      console.log(`✅ ${candidate.name} associado à lista "Daniel Infantil"`);
      associacoesNovas++;
    }
    
    console.log(`\n🎉 Processo concluído! ${associacoesNovas} novas associações criadas.`);
    
    // Verificação final
    console.log('\n🔍 Verificação final das associações...');
    const finalMembershipsSnapshot = await getDocs(collection(db, 'candidateListMemberships'));
    const finalMemberships = [];
    finalMembershipsSnapshot.forEach(doc => {
      finalMemberships.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`📋 Total de associações no sistema: ${finalMemberships.length}`);
    finalMemberships.forEach(membership => {
      const candidate = candidates.find(c => parseInt(c.id) === membership.candidateId);
      console.log(`  - ${candidate?.name || 'Candidato não encontrado'} (${membership.candidateId}) → Lista ${membership.listId}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

associarCandidatosExistentes();