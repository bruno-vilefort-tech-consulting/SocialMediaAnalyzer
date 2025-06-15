// Script para criar dados do Daniel do zero com debug completo
import admin from 'firebase-admin';

// Inicializar Firebase Admin se não estiver inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function criarDadosDaniel() {
  try {
    console.log('🧹 LIMPANDO DADOS ANTIGOS...');
    
    // 1. Limpar todas as entrevistas antigas do Daniel
    const interviewsSnapshot = await db.collection('interviews').get();
    for (const doc of interviewsSnapshot.docs) {
      const data = doc.data();
      if (data.phone === '11984316526' || data.phone === '5511984316526') {
        console.log(`🗑️ Removendo entrevista antiga: ${doc.id}`);
        await doc.ref.delete();
      }
    }
    
    // 2. Limpar todas as respostas antigas do Daniel
    const responsesSnapshot = await db.collection('responses').get();
    for (const doc of responsesSnapshot.docs) {
      const data = doc.data();
      if (data.candidateName?.toLowerCase().includes('daniel')) {
        console.log(`🗑️ Removendo resposta antiga: ${doc.id}`);
        await doc.ref.delete();
      }
    }
    
    // 3. Limpar candidatos antigos do Daniel
    const candidatesSnapshot = await db.collection('candidates').get();
    for (const doc of candidatesSnapshot.docs) {
      const data = doc.data();
      if (data.name?.toLowerCase().includes('daniel') || data.whatsapp === '11984316526' || data.whatsapp === '5511984316526') {
        console.log(`🗑️ Removendo candidato antigo: ${doc.id} (${data.name})`);
        await doc.ref.delete();
      }
    }
    
    // 4. Limpar listas de candidatos antigas
    const listsSnapshot = await db.collection('candidateLists').get();
    for (const doc of listsSnapshot.docs) {
      const data = doc.data();
      if (data.name?.toLowerCase().includes('daniel') || data.name?.includes('Novo')) {
        console.log(`🗑️ Removendo lista antiga: ${doc.id} (${data.name})`);
        await doc.ref.delete();
      }
    }
    
    // 5. Limpar seleções antigas
    const selectionsSnapshot = await db.collection('selections').get();
    for (const doc of selectionsSnapshot.docs) {
      const data = doc.data();
      if (data.name?.toLowerCase().includes('faxineira') || data.name?.includes('Teste')) {
        console.log(`🗑️ Removendo seleção antiga: ${doc.id} (${data.name})`);
        await doc.ref.delete();
      }
    }
    
    console.log('✅ LIMPEZA CONCLUÍDA - Sistema pronto para dados novos');
    
    // 6. Buscar cliente e vaga existentes
    const clientsSnapshot = await db.collection('clients').get();
    let grupoMaximus = null;
    clientsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.companyName?.includes('Grupo Maximus')) {
        grupoMaximus = { id: doc.id, ...data };
        console.log(`👑 Cliente encontrado: ${data.companyName} (ID: ${doc.id})`);
      }
    });
    
    if (!grupoMaximus) {
      console.log('❌ Cliente Grupo Maximus não encontrado');
      return;
    }
    
    const jobsSnapshot = await db.collection('jobs').get();
    let faxineiraJob = null;
    jobsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.nomeVaga?.includes('Faxineira') && data.clientId === parseInt(grupoMaximus.id)) {
        faxineiraJob = { id: doc.id, ...data };
        console.log(`💼 Vaga encontrada: ${data.nomeVaga} (ID: ${doc.id})`);
      }
    });
    
    if (!faxineiraJob) {
      console.log('❌ Vaga de Faxineira não encontrada');
      return;
    }
    
    // 7. Criar nova lista de candidatos
    const listaId = Date.now();
    const novaLista = {
      id: listaId,
      name: 'Lista Teste Daniel - Nova',
      clientId: parseInt(grupoMaximus.id),
      createdAt: new Date()
    };
    
    await db.collection('candidateLists').doc(listaId.toString()).set(novaLista);
    console.log(`📋 Nova lista criada: ${novaLista.name} (ID: ${listaId})`);
    
    // 8. Criar novo candidato Daniel
    const candidatoId = Date.now() + 1;
    const novoCandidato = {
      id: candidatoId,
      name: 'Daniel Moreira Teste',
      email: 'daniel.teste@email.com',
      whatsapp: '11984316526',
      clientId: parseInt(grupoMaximus.id),
      listId: listaId,
      createdAt: new Date()
    };
    
    await db.collection('candidates').doc(candidatoId.toString()).set(novoCandidato);
    console.log(`👤 Novo candidato criado: ${novoCandidato.name} (ID: ${candidatoId})`);
    console.log(`📱 WhatsApp: ${novoCandidato.whatsapp}`);
    
    // 9. Criar nova seleção
    const selecaoId = Date.now() + 2;
    const novaSelecao = {
      id: selecaoId,
      name: 'Seleção Faxineira - Teste Daniel',
      jobId: faxineiraJob.id,
      candidateListId: listaId,
      status: 'preparando',
      whatsappTemplate: 'Olá [nome do candidato]! Você foi selecionado(a) para a vaga de [Nome da Vaga]. Deseja participar da entrevista?',
      emailTemplate: 'Prezado(a) [nome do candidato], você foi convidado(a) para a vaga de [Nome da Vaga].',
      createdAt: new Date()
    };
    
    await db.collection('selections').doc(selecaoId.toString()).set(novaSelecao);
    console.log(`🎯 Nova seleção criada: ${novaSelecao.name} (ID: ${selecaoId})`);
    
    console.log('\n🎉 DADOS CRIADOS COM SUCESSO!');
    console.log('📊 RESUMO:');
    console.log(`   Cliente: ${grupoMaximus.companyName} (${grupoMaximus.id})`);
    console.log(`   Vaga: ${faxineiraJob.nomeVaga} (${faxineiraJob.id})`);
    console.log(`   Lista: ${novaLista.name} (${listaId})`);
    console.log(`   Candidato: ${novoCandidato.name} (${candidatoId})`);
    console.log(`   Seleção: ${novaSelecao.name} (${selecaoId})`);
    console.log(`   WhatsApp: ${novoCandidato.whatsapp}`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

criarDadosDaniel();