import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function buscarEDeletarClienteCNPJ() {
  console.log('🔍 Buscando cliente com CNPJ 12345678000123...');
  
  try {
    // Buscar cliente com CNPJ específico
    const clientsRef = collection(db, 'clients');
    const clientQuery = query(clientsRef, where('cnpj', '==', '12345678000123'));
    const clientSnapshot = await getDocs(clientQuery);
    
    if (clientSnapshot.empty) {
      console.log('❌ Cliente com CNPJ 12345678000123 não encontrado');
      
      // Listar todos os clientes para verificar
      console.log('\n📋 Listando todos os clientes cadastrados:');
      const allClientsSnapshot = await getDocs(clientsRef);
      allClientsSnapshot.forEach((clientDoc) => {
        const clientData = clientDoc.data();
        console.log(`🏢 ${clientData.companyName} - CNPJ: ${clientData.cnpj} (ID: ${clientDoc.id})`);
      });
      return;
    }
    
    const clientDoc = clientSnapshot.docs[0];
    const clientData = clientDoc.data();
    
    console.log(`🏢 Cliente encontrado: ${clientData.companyName}`);
    console.log(`📧 Email: ${clientData.email}`);
    console.log(`📱 Telefone: ${clientData.phone}`);
    console.log(`📋 ID: ${clientDoc.id}`);
    
    // Deletar o cliente
    console.log('\n🗑️ Deletando cliente...');
    await deleteDoc(doc(db, 'clients', clientDoc.id));
    
    console.log('✅ Cliente deletado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao buscar/deletar cliente:', error);
  }
}

buscarEDeletarClienteCNPJ();