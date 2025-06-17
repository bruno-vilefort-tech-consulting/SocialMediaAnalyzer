const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, deleteField } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyDUe_kvOXVt9tFEUhEGZKKd4lN5r9CK4nY',
  authDomain: 'humanize-ai-recruit.firebaseapp.com',
  projectId: 'humanize-ai-recruit',
  storageBucket: 'humanize-ai-recruit.appspot.com',
  messagingSenderId: '891159805635',
  appId: '1:891159805635:web:5b7bc11f8b9a6b8c9c4d8e'
};

const app = initializeApp(firebaseConfig);
const firebaseDb = getFirestore(app);

async function limparCampoIsIndefiniteContract() {
  try {
    console.log('🧹 Iniciando limpeza do campo isIndefiniteContract dos clientes...');
    
    // IDs dos clientes que têm o campo extra
    const clientsToClean = ['1749849987543', '1749852235275'];
    
    for (const clientId of clientsToClean) {
      try {
        const clientRef = doc(firebaseDb, 'clients', clientId);
        await updateDoc(clientRef, {
          isIndefiniteContract: deleteField()
        });
        console.log(`✅ Campo isIndefiniteContract removido do cliente ${clientId}`);
      } catch (error) {
        console.error(`❌ Erro ao limpar cliente ${clientId}:`, error.message);
      }
    }
    
    console.log('🎉 Limpeza concluída! Todos os clientes agora têm a mesma estrutura.');
    
  } catch (error) {
    console.error('❌ Erro geral na limpeza:', error);
  }
}

limparCampoIsIndefiniteContract();