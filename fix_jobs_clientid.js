import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixJobsClientId() {
  try {
    console.log('🔍 Verificando e corrigindo vagas no Firebase...');
    
    // Buscar todas as vagas
    const snapshot = await getDocs(collection(db, "jobs"));
    console.log(`📊 Total de vagas encontradas: ${snapshot.size}`);
    
    // Deletar todas as vagas existentes
    const deletePromises = [];
    snapshot.forEach(doc => {
      console.log(`🗑️ Deletando vaga: ${doc.id} - ${doc.data().nomeVaga}`);
      deletePromises.push(deleteDoc(doc.ref));
    });
    
    await Promise.all(deletePromises);
    console.log('✅ Todas as vagas antigas foram deletadas');
    
    // Criar nova vaga de teste com clientId correto
    const novaVaga = {
      id: "1750023500000",
      nomeVaga: "Faxineira Sistema Teste",
      descricaoVaga: "Vaga de teste para sistema limpo com Daniel Braga da Lista 2025",
      clientId: 1749849987543, // Grupo Maximuns correto
      status: "ativo",
      createdAt: new Date(),
      perguntas: [
        {
          numero: 1,
          pergunta: "Por que você quer trabalhar como faxineira?",
          respostaPerfeita: "Gosto de manter ambientes limpos e organizados, tenho experiência na área."
        },
        {
          numero: 2,
          pergunta: "Qual sua experiência em limpeza?",
          respostaPerfeita: "Trabalhei em várias empresas, sei usar produtos de limpeza e tenho atenção aos detalhes."
        }
      ]
    };
    
    console.log('➕ Criando nova vaga de teste...');
    console.log(`📝 ClientId: ${novaVaga.clientId}`);
    console.log(`📝 Nome: ${novaVaga.nomeVaga}`);
    
    await setDoc(doc(db, "jobs", novaVaga.id), novaVaga);
    console.log(`✅ Nova vaga criada: ID=${novaVaga.id}`);
    
    // Verificar resultado final
    console.log('\n🔍 Verificação final das vagas:');
    const finalSnapshot = await getDocs(collection(db, "jobs"));
    finalSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`📄 Vaga: ID=${doc.id}, clientId=${data.clientId}, nome=${data.nomeVaga}`);
    });
    
    console.log('\n✅ Correção das vagas concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir vagas:', error);
  }
}

fixJobsClientId();