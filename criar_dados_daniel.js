// Script para criar dados específicos do Daniel Moreira na seleção Faxineira Banco
import admin from 'firebase-admin';

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function criarDadosDaniel() {
  try {
    console.log('🔧 Criando dados específicos para Daniel Moreira...');
    
    // 1. Criar entrevista finalizada para Daniel na Faxineira Banco
    const interviewId = Date.now().toString();
    console.log(`📝 Criando entrevista ID: ${interviewId}`);
    
    await db.collection('interviews').doc(interviewId).set({
      candidateId: '17498608963032', // ID do Daniel Moreira
      candidateName: 'Daniel Moreira',
      phone: '11984316526',
      jobId: '174986729964277', // ID da vaga Faxineira GM
      jobName: 'Faxineira Banco',
      selectionId: '175001114365781', // ID da seleção faxina
      status: 'completed',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      createdAt: admin.firestore.Timestamp.now()
    });
    
    // 2. Criar respostas para a entrevista
    const respostas = [
      {
        questionText: 'Por que você quer trabalhar como faxineira?',
        responseText: 'Eu gosto de manter ambientes limpos e organizados. Tenho experiência na área e sei a importância de um local bem cuidado.',
        audioFile: 'daniel_resposta_1.ogg'
      },
      {
        questionText: 'Qual sua experiência com limpeza?',
        responseText: 'Trabalho há 5 anos na área de limpeza, tanto residencial quanto comercial. Conheço produtos e técnicas adequadas.',
        audioFile: 'daniel_resposta_2.ogg'
      }
    ];
    
    for (let i = 0; i < respostas.length; i++) {
      const responseId = (Date.now() + i).toString();
      console.log(`💬 Criando resposta ${i + 1}: ${responseId}`);
      
      await db.collection('responses').doc(responseId).set({
        interviewId: interviewId,
        questionId: i + 1,
        questionText: respostas[i].questionText,
        responseText: respostas[i].responseText,
        audioFile: respostas[i].audioFile,
        timestamp: admin.firestore.Timestamp.now(),
        score: 8.5 + (i * 0.3), // Scores variados
        createdAt: admin.firestore.Timestamp.now()
      });
    }
    
    console.log('✅ Dados do Daniel Moreira criados com sucesso!');
    console.log(`📊 Entrevista: ${interviewId}`);
    console.log(`📝 Respostas: ${respostas.length}`);
    console.log('🎯 Status: completed na seleção Faxineira Banco');
    
  } catch (error) {
    console.error('❌ Erro ao criar dados:', error);
  }
}

criarDadosDaniel();