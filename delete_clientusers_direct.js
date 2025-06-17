import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch } from 'firebase/firestore';

// Configuração Firebase direta
const firebaseConfig = {
  apiKey: "AIzaSyBOhAKHTdJVVt4TCdOE2lAZWjW8gKKWUBg",
  authDomain: "sistema-entrevista-ia.firebaseapp.com",
  projectId: "sistema-entrevista-ia",
  storageBucket: "sistema-entrevista-ia.firebasestorage.app",
  messagingSenderId: "441199436688",
  appId: "1:441199436688:web:3a649a4b23c6b7e0b42ad8"
};

async function deleteClientUsersCollection() {
  try {
    console.log('🔥 Inicializando Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('🗑️ Iniciando deleção da coleção clientUsers...');
    
    const collectionRef = collection(db, 'clientUsers');
    const snapshot = await getDocs(collectionRef);
    
    console.log(`📊 Documentos encontrados: ${snapshot.size}`);
    
    if (snapshot.empty) {
      console.log('✅ Coleção clientUsers já está vazia');
      return { deletedCount: 0 };
    }
    
    // Deletar em lotes
    const batch = writeBatch(db);
    let count = 0;
    
    snapshot.forEach((docSnapshot) => {
      console.log(`- Deletando documento: ${docSnapshot.id}`);
      batch.delete(docSnapshot.ref);
      count++;
    });
    
    if (count > 0) {
      await batch.commit();
      console.log(`🎉 ${count} documentos deletados com sucesso!`);
    }
    
    // Verificação final
    const finalCheck = await getDocs(collectionRef);
    console.log(`🔍 Verificação final: ${finalCheck.size} documentos restantes`);
    
    return { deletedCount: count };
    
  } catch (error) {
    console.error('❌ Erro ao deletar coleção clientUsers:', error.message);
    throw error;
  }
}

// Executar a função
deleteClientUsersCollection()
  .then(result => {
    console.log('✅ Operação concluída:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Falha na operação:', error);
    process.exit(1);
  });