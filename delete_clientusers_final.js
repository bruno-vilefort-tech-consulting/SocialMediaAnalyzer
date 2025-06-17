// Script para deletar completamente a coleção clientUsers do Firebase
const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = {
  "type": "service_account",
  "project_id": "ai-interview-system-c13b4",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk@ai-interview-system-c13b4.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
};

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://ai-interview-system-c13b4-default-rtdb.firebaseio.com"
    });
  }
} catch (error) {
  console.log('Firebase já inicializado ou erro na inicialização:', error.message);
}

const db = admin.firestore();

async function deleteClientUsersCollection() {
  try {
    console.log('🔍 Buscando documentos na coleção clientUsers...');
    
    const collectionRef = db.collection('clientUsers');
    const snapshot = await collectionRef.get();
    
    console.log(`📊 Encontrados ${snapshot.size} documentos`);
    
    if (snapshot.empty) {
      console.log('✅ Coleção clientUsers já está vazia');
      return;
    }
    
    console.log('🗑️ Deletando documentos...');
    
    const batch = db.batch();
    let deleteCount = 0;
    
    snapshot.forEach(doc => {
      console.log(`- Preparando deleção do documento: ${doc.id}`);
      batch.delete(doc.ref);
      deleteCount++;
    });
    
    if (deleteCount > 0) {
      await batch.commit();
      console.log(`✅ ${deleteCount} documentos deletados com sucesso!`);
    }
    
    // Verificar se a coleção está realmente vazia
    const verifySnapshot = await collectionRef.get();
    console.log(`🔍 Verificação final: ${verifySnapshot.size} documentos restantes`);
    
    if (verifySnapshot.size === 0) {
      console.log('🎉 Coleção clientUsers completamente removida!');
    } else {
      console.log('⚠️ Ainda existem documentos na coleção');
    }
    
  } catch (error) {
    console.error('❌ Erro ao deletar coleção:', error.message);
    
    // Tentar método alternativo - deletar um por um
    console.log('🔄 Tentando método alternativo...');
    try {
      const snapshot = await db.collection('clientUsers').get();
      
      for (const doc of snapshot.docs) {
        console.log(`- Deletando documento individual: ${doc.id}`);
        await doc.ref.delete();
      }
      
      console.log('✅ Método alternativo concluído');
    } catch (altError) {
      console.error('❌ Método alternativo também falhou:', altError.message);
    }
  }
}

// Executar
deleteClientUsersCollection()
  .then(() => {
    console.log('🏁 Processo finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error.message);
    process.exit(1);
  });