const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, updateDoc, doc, getDocs, query, where } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBjf8nV2q7Jz_wAERHWqZN9O5BcT8wKl4A",
  authDomain: "sistema-entrevista-ia.firebaseapp.com",
  projectId: "sistema-entrevista-ia",
  storageBucket: "sistema-entrevista-ia.appspot.com",
  messagingSenderId: "671781846530",
  appId: "1:671781846530:web:4e9f8f8f8f8f8f8f8f8f8f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function criarVagaDanielCorreta() {
  try {
    console.log('🔧 Criando vaga correta para Daniel Braga...');
    
    // Dados da vaga correta para Daniel (clientId: 1749849987543)
    const vagaData = {
      nomeVaga: "Desenvolvedor Full Stack",
      descricaoVaga: "Desenvolvedor full stack para desenvolvimento de sistemas web completos usando React, Node.js e Firebase",
      clientId: 1749849987543, // ClientId correto do Grupo Maximuns
      status: "ativo",
      createdAt: new Date(),
      perguntas: [
        {
          numero: 1,
          pergunta: "Qual sua experiência com desenvolvimento full stack?",
          respostaPerfeita: "Candidato deve demonstrar conhecimento em frontend (React) e backend (Node.js, APIs)"
        },
        {
          numero: 2,
          pergunta: "Como você estrutura um projeto do zero?",
          respostaPerfeita: "Candidato deve mencionar planejamento, arquitetura, escolha de tecnologias e boas práticas"
        },
        {
          numero: 3,
          pergunta: "Descreva sua experiência com bancos de dados e APIs",
          respostaPerfeita: "Candidato deve demonstrar conhecimento em modelagem de dados, integração de APIs e otimização"
        }
      ]
    };
    
    // Criar a vaga no Firebase
    const docRef = await addDoc(collection(db, "jobs"), vagaData);
    console.log(`✅ Vaga criada com sucesso! ID: ${docRef.id}`);
    console.log(`📋 ClientId correto: ${vagaData.clientId}`);
    
    // Verificar todas as vagas existentes e corrigir clientId incorretos
    console.log('\n🔍 Verificando vagas existentes...');
    const jobsSnapshot = await getDocs(collection(db, "jobs"));
    
    for (const jobDoc of jobsSnapshot.docs) {
      const jobData = jobDoc.data();
      console.log(`📄 Vaga ID: ${jobDoc.id}, clientId: ${jobData.clientId}, nome: ${jobData.nomeVaga}`);
      
      // Se a vaga tem clientId=1 (incorreto), corrigir para 1749849987543
      if (jobData.clientId === 1) {
        console.log(`🔧 Corrigindo clientId da vaga "${jobData.nomeVaga}" de 1 para 1749849987543`);
        await updateDoc(doc(db, "jobs", jobDoc.id), {
          clientId: 1749849987543
        });
        console.log(`✅ Vaga "${jobData.nomeVaga}" corrigida!`);
      }
    }
    
    // Verificar o resultado final
    console.log('\n📋 RESULTADO FINAL:');
    console.log('===================');
    const finalSnapshot = await getDocs(collection(db, "jobs"));
    let vagasGrupoMaximuns = 0;
    
    for (const jobDoc of finalSnapshot.docs) {
      const jobData = jobDoc.data();
      if (jobData.clientId === 1749849987543) {
        vagasGrupoMaximuns++;
        console.log(`✅ Vaga para Grupo Maximuns: "${jobData.nomeVaga}"`);
      }
    }
    
    console.log(`\n🎯 Total de vagas para Daniel/Grupo Maximuns (clientId 1749849987543): ${vagasGrupoMaximuns}`);
    console.log('✅ Sistema corrigido! Daniel agora deve ver suas vagas no painel.');
    
  } catch (error) {
    console.error('❌ Erro ao criar/corrigir vagas:', error);
  }
}

criarVagaDanielCorreta();