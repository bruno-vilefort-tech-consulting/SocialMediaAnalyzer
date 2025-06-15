// Script para corrigir problema das vagas no Firebase
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

async function fixFirebaseJobs() {
  try {
    console.log('🔍 Verificando todas as vagas no Firebase...');
    
    // Buscar todas as vagas
    const snapshot = await getDocs(collection(db, "jobs"));
    console.log(`📊 Total de documentos na coleção jobs: ${snapshot.size}`);
    
    const jobs = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      jobs.push({
        id: doc.id,
        ...data
      });
      console.log(`📄 Vaga: ID=${doc.id}, cliente=${data.clientId}, nome=${data.nomeVaga}, status=${data.status}`);
    });
    
    // Deletar vaga problemática se existir
    const problematicJobId = "174986729964277";
    try {
      console.log(`🗑️ Tentando deletar vaga problemática: ${problematicJobId}`);
      await deleteDoc(doc(db, "jobs", problematicJobId));
      console.log(`✅ Vaga ${problematicJobId} deletada com sucesso`);
    } catch (error) {
      console.log(`⚠️ Erro ao deletar vaga ${problematicJobId}:`, error.message);
    }
    
    // Criar nova vaga de teste limpa
    const novaVaga = {
      id: "1750023102000",
      nomeVaga: "Faxineira Teste - Sistema Limpo",
      descricaoVaga: "Vaga de teste para sistema limpo com Daniel Braga",
      clientId: 1749849987543, // Grupo Maximuns
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
    await setDoc(doc(db, "jobs", novaVaga.id), novaVaga);
    console.log(`✅ Nova vaga criada: ID=${novaVaga.id}, nome=${novaVaga.nomeVaga}`);
    
    // Verificar resultado final
    console.log('\n🔍 Verificação final das vagas:');
    const finalSnapshot = await getDocs(collection(db, "jobs"));
    finalSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`📄 Vaga final: ID=${doc.id}, cliente=${data.clientId}, nome=${data.nomeVaga}`);
    });
    
    console.log('\n✅ Correção das vagas concluída!');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir vagas:', error);
  }
}

fixFirebaseJobs();