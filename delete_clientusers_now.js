import { firebaseDb } from './server/db.js';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';

async function deleteClientUsersCollection() {
  try {
    console.log('🗑️ Deletando coleção clientUsers...');
    
    const clientUsersRef = collection(firebaseDb, 'clientUsers');
    const snapshot = await getDocs(clientUsersRef);
    
    console.log(`📊 Documentos encontrados: ${snapshot.size}`);
    
    if (snapshot.size === 0) {
      console.log('✅ Coleção já está vazia');
      return;
    }
    
    // Deletar todos os documentos
    const deletePromises = snapshot.docs.map(doc => {
      console.log(`- Deletando: ${doc.id}`);
      return deleteDoc(doc.ref);
    });
    
    await Promise.all(deletePromises);
    
    console.log(`🎉 ${snapshot.size} documentos deletados com sucesso!`);
    
    // Verificação final
    const finalSnapshot = await getDocs(clientUsersRef);
    console.log(`🔍 Verificação: ${finalSnapshot.size} documentos restantes`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

deleteClientUsersCollection().then(() => process.exit(0));