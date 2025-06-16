import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, updateDoc, getDocs, getDoc } from 'firebase/firestore';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function corrigirIdsVagas() {
  try {
    console.log('🔍 Verificando vagas com IDs de cliente incorretos...');
    
    // Buscar todas as vagas
    const vagasSnapshot = await getDocs(collection(db, 'jobs'));
    
    // Buscar clientes válidos
    const clientesSnapshot = await getDocs(collection(db, 'clients'));
    const clientesValidos = [];
    
    clientesSnapshot.forEach(doc => {
      const cliente = doc.data();
      clientesValidos.push({
        id: doc.id,
        nome: cliente.companyName
      });
      console.log(`✅ Cliente válido: ${doc.id} - ${cliente.companyName}`);
    });
    
    console.log('\n🔍 Verificando vagas...');
    
    const vagasComProblema = [];
    
    vagasSnapshot.forEach(doc => {
      const vaga = doc.data();
      const clienteExiste = clientesValidos.find(c => c.id === vaga.clientId.toString());
      
      console.log(`📄 Vaga: ${vaga.nomeVaga} | Cliente ID: ${vaga.clientId}`);
      
      if (!clienteExiste) {
        console.log(`   ⚠️  PROBLEMA: Cliente ID ${vaga.clientId} não existe!`);
        vagasComProblema.push({
          id: doc.id,
          nome: vaga.nomeVaga,
          clienteIdAtual: vaga.clientId,
          dadosVaga: vaga
        });
      } else {
        console.log(`   ✅ Cliente válido: ${clienteExiste.nome}`);
      }
    });
    
    if (vagasComProblema.length > 0) {
      console.log(`\n🔧 Corrigindo ${vagasComProblema.length} vaga(s) com problema...`);
      
      // Usar o primeiro cliente válido como padrão (Grupo Maximuns)
      const clientePadrao = clientesValidos[0];
      
      for (const vaga of vagasComProblema) {
        console.log(`🔄 Atualizando vaga "${vaga.nome}" para cliente ${clientePadrao.nome} (${clientePadrao.id})`);
        
        const vagaRef = doc(db, 'jobs', vaga.id);
        await updateDoc(vagaRef, {
          clientId: parseInt(clientePadrao.id)
        });
        
        console.log(`✅ Vaga "${vaga.nome}" atualizada com sucesso!`);
      }
      
      console.log('\n🎉 Todas as vagas foram corrigidas!');
    } else {
      console.log('\n✅ Todas as vagas já possuem IDs de cliente válidos!');
    }
    
  } catch (error) {
    console.error('❌ Erro ao corrigir vagas:', error);
  }
}

corrigirIdsVagas();