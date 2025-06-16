import admin from 'firebase-admin';
import serviceAccount from './firebase-service-account.json' assert { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function limparListasECandidatos() {
  console.log('🧹 Iniciando limpeza de listas e candidatos...');
  
  try {
    // 1. Deletar todos os candidate-list-memberships
    console.log('🗑️ Deletando candidate-list-memberships...');
    const membershipsSnapshot = await db.collection('candidate-list-memberships').get();
    const membershipsBatch = db.batch();
    
    membershipsSnapshot.docs.forEach(doc => {
      membershipsBatch.delete(doc.ref);
    });
    
    if (membershipsSnapshot.docs.length > 0) {
      await membershipsBatch.commit();
      console.log(`✅ ${membershipsSnapshot.docs.length} memberships deletados`);
    } else {
      console.log('✅ Nenhum membership encontrado');
    }

    // 2. Deletar todos os candidatos
    console.log('🗑️ Deletando candidatos...');
    const candidatesSnapshot = await db.collection('candidates').get();
    const candidatesBatch = db.batch();
    
    candidatesSnapshot.docs.forEach(doc => {
      candidatesBatch.delete(doc.ref);
    });
    
    if (candidatesSnapshot.docs.length > 0) {
      await candidatesBatch.commit();
      console.log(`✅ ${candidatesSnapshot.docs.length} candidatos deletados`);
    } else {
      console.log('✅ Nenhum candidato encontrado');
    }

    // 3. Deletar todas as listas de candidatos
    console.log('🗑️ Deletando listas de candidatos...');
    const listsSnapshot = await db.collection('candidate-lists').get();
    const listsBatch = db.batch();
    
    listsSnapshot.docs.forEach(doc => {
      listsBatch.delete(doc.ref);
    });
    
    if (listsSnapshot.docs.length > 0) {
      await listsBatch.commit();
      console.log(`✅ ${listsSnapshot.docs.length} listas deletadas`);
    } else {
      console.log('✅ Nenhuma lista encontrada');
    }

    // 4. Verificação final
    console.log('\n📊 Verificação final:');
    const finalCandidates = await db.collection('candidates').get();
    const finalLists = await db.collection('candidate-lists').get();
    const finalMemberships = await db.collection('candidate-list-memberships').get();
    
    console.log(`📋 Candidatos restantes: ${finalCandidates.size}`);
    console.log(`📋 Listas restantes: ${finalLists.size}`);
    console.log(`📋 Memberships restantes: ${finalMemberships.size}`);
    
    if (finalCandidates.size === 0 && finalLists.size === 0 && finalMemberships.size === 0) {
      console.log('🎉 Limpeza completa realizada com sucesso!');
    } else {
      console.log('⚠️ Alguns itens ainda permanecem no banco');
    }

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
  }
}

limparListasECandidatos();