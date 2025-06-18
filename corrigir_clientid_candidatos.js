import admin from 'firebase-admin';

// Inicializar Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const firebaseDb = admin.firestore();

async function corrigirClientIdCandidatos() {
  try {
    console.log('🔍 Buscando candidatos problemáticos...');
    
    // Buscar todos os candidatos
    const candidatesSnapshot = await firebaseDb.collection('candidates').get();
    const candidates = candidatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`📋 Total de candidatos encontrados: ${candidates.length}`);
    
    // Identificar candidatos sem clientId válido
    const problematicCandidates = candidates.filter(candidate => {
      const hasValidClientId = candidate.clientId && !isNaN(candidate.clientId) && candidate.clientId > 0;
      return !hasValidClientId;
    });
    
    console.log(`❌ Candidatos com clientId inválido: ${problematicCandidates.length}`);
    
    if (problematicCandidates.length === 0) {
      console.log('✅ Todos os candidatos já possuem clientId válido');
      return;
    }
    
    // Para cada candidato problemático, buscar nas memberships para descobrir o clientId correto
    for (const candidate of problematicCandidates) {
      console.log(`\n🔍 Analisando candidato: ${candidate.name} (ID: ${candidate.id})`);
      console.log(`   ClientId atual: ${candidate.clientId}`);
      
      // Buscar memberships deste candidato
      const membershipsSnapshot = await firebaseDb
        .collection('candidate-list-memberships')
        .where('candidateId', '==', parseInt(candidate.id))
        .get();
      
      if (!membershipsSnapshot.empty) {
        const membership = membershipsSnapshot.docs[0].data();
        const correctClientId = membership.clientId;
        
        console.log(`   ✅ ClientId correto encontrado na membership: ${correctClientId}`);
        
        // Atualizar o candidato com o clientId correto
        await firebaseDb.collection('candidates').doc(candidate.id).update({
          clientId: correctClientId
        });
        
        console.log(`   💾 Candidato ${candidate.name} atualizado com clientId: ${correctClientId}`);
      } else {
        console.log(`   ❌ Nenhuma membership encontrada para candidato ${candidate.name}`);
        console.log(`   🗑️  Candidato órfão - considere remover ou atribuir manualmente`);
      }
    }
    
    console.log('\n✅ Correção de clientId concluída!');
    
  } catch (error) {
    console.error('❌ Erro na correção:', error);
  } finally {
    process.exit(0);
  }
}

corrigirClientIdCandidatos();