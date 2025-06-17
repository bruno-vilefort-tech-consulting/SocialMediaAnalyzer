// Deletar coleção clientUsers usando o storage existente
import { storage } from './server/storage.js';

async function forceDeleteClientUsers() {
  try {
    console.log('🔍 Acessando Firebase diretamente...');
    
    // Usar o firestore já configurado no storage
    const firestore = storage.firestore;
    const collectionRef = firestore.collection('clientUsers');
    
    console.log('📊 Buscando todos os documentos...');
    const snapshot = await collectionRef.get();
    
    console.log(`Encontrados: ${snapshot.size} documentos`);
    
    if (snapshot.empty) {
      console.log('✅ Coleção já está vazia');
      return;
    }
    
    // Deletar em lotes
    const batchSize = 500;
    let deletedCount = 0;
    
    while (true) {
      const batch = firestore.batch();
      const docs = await collectionRef.limit(batchSize).get();
      
      if (docs.empty) break;
      
      docs.forEach(doc => {
        console.log(`- Deletando: ${doc.id}`);
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      await batch.commit();
      console.log(`📦 Lote processado: ${docs.size} documentos`);
    }
    
    console.log(`🎉 Total deletado: ${deletedCount} documentos`);
    
    // Verificação final
    const finalCheck = await collectionRef.get();
    console.log(`🔍 Verificação final: ${finalCheck.size} documentos restantes`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  }
}

forceDeleteClientUsers()
  .then(() => {
    console.log('🏁 Concluído');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });