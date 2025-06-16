const admin = require('firebase-admin');

// Configurar Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccountKey = {
      type: "service_account",
      project_id: process.env.VITE_FIREBASE_PROJECT_ID,
      private_key_id: "dummy",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKBxQb\n-----END PRIVATE KEY-----\n",
      client_email: "dummy@dummy.iam.gserviceaccount.com",
      client_id: "dummy",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token"
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKey)
    });
  } catch (error) {
    console.log('🔧 Usando configuração alternativa do Firebase...');
  }
}

async function verificarVagasEClientes() {
  try {
    const db = admin.firestore();
    
    console.log('🔍 Verificando clientes...');
    const clientesSnapshot = await db.collection('clients').get();
    const clientes = {};
    
    clientesSnapshot.forEach(doc => {
      const cliente = doc.data();
      clientes[doc.id] = cliente;
      console.log(`👤 Cliente ID: ${doc.id} | Nome: ${cliente.companyName}`);
    });
    
    console.log('\n🔍 Verificando vagas e seus clientes...');
    const vagasSnapshot = await db.collection('jobs').get();
    
    vagasSnapshot.forEach(doc => {
      const vaga = doc.data();
      const clienteNome = clientes[vaga.clientId] ? clientes[vaga.clientId].companyName : 'CLIENTE NÃO ENCONTRADO';
      
      console.log(`📄 Vaga ID: ${doc.id}`);
      console.log(`   Nome: ${vaga.nomeVaga}`);
      console.log(`   Cliente ID: ${vaga.clientId}`);
      console.log(`   Cliente Nome: ${clienteNome}`);
      console.log(`   Status: ${vaga.status}`);
      
      if (!clientes[vaga.clientId]) {
        console.log(`   ⚠️  PROBLEMA: Cliente ID ${vaga.clientId} não existe!`);
      }
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificarVagasEClientes();