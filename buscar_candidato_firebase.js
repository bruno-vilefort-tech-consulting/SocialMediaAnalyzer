import admin from 'firebase-admin';

// Configurar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function buscarCandidatoPorNumero(numero) {
  console.log(`🔍 Buscando candidatos com número: ${numero}`);
  
  try {
    // Buscar por WhatsApp exato
    const snapshot1 = await db.collection('candidates')
      .where('whatsapp', '==', numero)
      .get();
    
    console.log(`📋 Busca exata por whatsapp: ${snapshot1.size} candidatos encontrados`);
    
    // Buscar todos os candidatos e filtrar por números similares
    const allCandidates = await db.collection('candidates').get();
    console.log(`📊 Total de candidatos no Firebase: ${allCandidates.size}`);
    
    const matchingCandidates = [];
    
    allCandidates.forEach(doc => {
      const data = doc.data();
      const candidatePhone = data.whatsapp || '';
      
      // Remover caracteres não numéricos para comparação
      const cleanCandidatePhone = candidatePhone.replace(/\D/g, '');
      const cleanSearchPhone = numero.replace(/\D/g, '');
      
      // Verificar se há correspondência
      if (cleanCandidatePhone.includes(cleanSearchPhone) || 
          cleanSearchPhone.includes(cleanCandidatePhone)) {
        matchingCandidates.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    console.log(`\n🎯 RESULTADOS DA BUSCA:`);
    console.log(`📱 Número pesquisado: ${numero}`);
    console.log(`🔢 Candidatos encontrados: ${matchingCandidates.length}`);
    
    if (matchingCandidates.length > 0) {
      console.log(`\n📋 CANDIDATOS ENCONTRADOS:`);
      matchingCandidates.forEach((candidate, index) => {
        console.log(`\n${index + 1}. ${candidate.name || 'Sem nome'}`);
        console.log(`   📱 WhatsApp: ${candidate.whatsapp || 'Não informado'}`);
        console.log(`   📧 Email: ${candidate.email || 'Não informado'}`);
        console.log(`   🏢 Cliente ID: ${candidate.clientId || 'Não informado'}`);
        console.log(`   🆔 ID: ${candidate.id}`);
        console.log(`   📅 Criado em: ${candidate.createdAt ? new Date(candidate.createdAt.seconds * 1000).toLocaleString() : 'Não informado'}`);
      });
    } else {
      console.log(`\n❌ Nenhum candidato encontrado com o número ${numero}`);
    }
    
    // Mostrar alguns candidatos de exemplo para referência
    console.log(`\n📋 EXEMPLOS DE CANDIDATOS NO SISTEMA:`);
    let count = 0;
    allCandidates.forEach(doc => {
      if (count < 5) {
        const data = doc.data();
        if (data.whatsapp) {
          console.log(`   ${data.name || 'Sem nome'} - ${data.whatsapp} (Cliente: ${data.clientId})`);
          count++;
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar candidatos:', error);
  }
}

// Executar busca
buscarCandidatoPorNumero('5511996612253')
  .then(() => {
    console.log('\n✅ Busca concluída');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro na busca:', error);
    process.exit(1);
  });
