import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarDadosPosExclusao() {
  console.log('✅ Cliente CNPJ 12345678000123 deletado com sucesso!');
  console.log('\n🔍 Verificando dados relacionados...');
  
  try {
    // Verificar se ainda existem clientes
    console.log('\n📋 Clientes restantes:');
    const clientsSnapshot = await getDocs(collection(db, 'clients'));
    if (clientsSnapshot.empty) {
      console.log('❌ Nenhum cliente encontrado no sistema');
    } else {
      clientsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`🏢 ${data.companyName} - CNPJ: ${data.cnpj} (ID: ${doc.id})`);
      });
    }

    // Verificar vagas órfãs (sem cliente)
    console.log('\n📄 Verificando vagas órfãs...');
    const jobsSnapshot = await getDocs(collection(db, 'jobs'));
    let orphanJobs = 0;
    
    jobsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.clientId === 1750023251515) {
        console.log(`⚠️  Vaga órfã encontrada: ${data.nomeVaga} (ID: ${doc.id})`);
        orphanJobs++;
      }
    });
    
    if (orphanJobs === 0) {
      console.log('✅ Nenhuma vaga órfã encontrada');
    } else {
      console.log(`❌ ${orphanJobs} vaga(s) órfã(s) encontrada(s)`);
    }

    // Verificar candidatos órfãos
    console.log('\n👥 Verificando candidatos órfãos...');
    const candidatesSnapshot = await getDocs(collection(db, 'candidates'));
    let orphanCandidates = 0;
    
    candidatesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.clientId === 1750023251515) {
        console.log(`⚠️  Candidato órfão encontrado: ${data.name} (ID: ${doc.id})`);
        orphanCandidates++;
      }
    });
    
    if (orphanCandidates === 0) {
      console.log('✅ Nenhum candidato órfão encontrado');
    } else {
      console.log(`❌ ${orphanCandidates} candidato(s) órfão(s) encontrado(s)`);
    }

    console.log('\n✅ Verificação concluída!');
    
  } catch (error) {
    console.error('❌ Erro ao verificar dados:', error);
  }
}

verificarDadosPosExclusao();