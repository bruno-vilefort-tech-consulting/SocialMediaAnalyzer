import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function criarDadosDaniel() {
  console.log('🧪 Criando dados de teste para Daniel...');
  
  try {
    // Criar uma nova vaga para teste
    const vagaTest = {
      nomeVaga: 'Desenvolvedor Web',
      descricaoVaga: 'Vaga para desenvolvedor web com experiência em React',
      clientId: 1,
      status: 'active',
      createdAt: new Date(),
      perguntas: [
        {
          pergunta: 'Conte um pouco sobre sua experiência com desenvolvimento web.',
          respostaIdeal: 'Experiência com HTML, CSS, JavaScript e frameworks modernos'
        },
        {
          pergunta: 'Como você aborda a resolução de problemas complexos?',
          respostaIdeal: 'Análise sistemática, pesquisa e testes incrementais'
        }
      ]
    };

    const vagaRef = await addDoc(collection(db, 'jobs'), vagaTest);
    console.log(`✅ Vaga criada: ${vagaRef.id}`);

    // Criar lista de candidatos
    const listaRef = await addDoc(collection(db, 'candidateLists'), {
      name: 'Lista Daniel - Teste Campo Celular',
      clientId: 1,
      createdAt: new Date()
    });
    console.log(`✅ Lista criada: ${listaRef.id}`);

    // Criar candidato Daniel usando o campo whatsapp
    const candidatoDaniel = {
      name: 'Daniel Silva',
      email: 'daniel.silva@email.com',
      whatsapp: '5511984316526', // Campo celular vai para whatsapp
      clientId: 1,
      listId: listaRef.id,
      createdAt: new Date()
    };

    const candidatoRef = await addDoc(collection(db, 'candidates'), candidatoDaniel);
    console.log(`✅ Candidato criado: ${candidatoRef.id}`);

    // Criar seleção para teste
    const selecao = {
      jobId: vagaRef.id,
      candidateListId: listaRef.id,
      clientId: 1,
      status: 'active',
      sendVia: 'whatsapp',
      whatsappTemplate: 'Olá [nome do candidato]! Você foi selecionado para a vaga de [Nome da Vaga]. Digite 1 para aceitar a entrevista.',
      createdAt: new Date()
    };

    const selecaoRef = await addDoc(collection(db, 'selections'), selecao);
    console.log(`✅ Seleção criada: ${selecaoRef.id}`);

    console.log(`\n🎉 Dados de teste criados com sucesso!`);
    console.log(`📝 Vaga: Desenvolvedor Web (${vagaRef.id})`);
    console.log(`👤 Candidato: Daniel Silva - WhatsApp: 5511984316526`);
    console.log(`📋 Lista: ${listaRef.id}`);
    console.log(`🎯 Seleção: ${selecaoRef.id}`);
    
  } catch (error) {
    console.error('❌ Erro ao criar dados:', error);
  }
}

criarDadosDaniel();