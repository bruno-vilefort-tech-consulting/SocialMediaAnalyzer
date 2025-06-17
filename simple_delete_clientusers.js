// Script para deletar clientUsers usando storage direto
const { storage } = await import('./server/storage.js');

async function deleteClientUsersCollection() {
  try {
    console.log('🔍 Verificando coleção clientUsers...');
    
    // Acessar o Firestore diretamente
    const db = storage.firestore;
    const collectionRef = db.collection('clientUsers');
    
    // Buscar todos os documentos
    const snapshot = await collectionRef.get();
    console.log(`📊 Documentos encontrados: ${snapshot.size}`);
    
    if (snapshot.empty) {
      console.log('✅ Coleção já está vazia');
      return;
    }
    
    // Deletar em lotes
    const batch = db.batch();
    let count = 0;
    
    snapshot.forEach((doc) => {
      console.log(`- Deletando documento: ${doc.id}`);
      batch.delete(doc.ref);
      count++;
    });
    
    if (count > 0) {
      await batch.commit();
      console.log(`🎉 ${count} documentos deletados com sucesso!`);
    }
    
    // Verificação final
    const finalCheck = await collectionRef.get();
    console.log(`🔍 Verificação final: ${finalCheck.size} documentos restantes`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

deleteClientUsersCollection().then(() => {
  console.log('🏁 Processo concluído');
  process.exit(0);
}).catch(error => {
  console.error('💥 Falha:', error);
  process.exit(1);
});