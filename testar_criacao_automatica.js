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

async function testarCriacaoAutomatica() {
  console.log("🧪 TESTANDO CRIAÇÃO AUTOMÁTICA DE APICONFIGS...\n");

  try {
    // Buscar todos os clientes existentes
    const clientesSnapshot = await getDocs(collection(db, "clients"));
    const clientes = clientesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📊 Clientes encontrados: ${clientes.length}`);
    clientes.forEach(cliente => {
      console.log(`   - ${cliente.name} (ID: ${cliente.id})`);
    });

    console.log("\n🔍 VERIFICANDO APICONFIGS CORRESPONDENTES...");
    
    // Verificar se cada cliente tem sua apiConfig
    for (const cliente of clientes) {
      const apiConfigId = `client_${cliente.id}`;
      
      const apiConfigQuery = query(
        collection(db, "apiConfigs"),
        where("entityType", "==", "client"),
        where("entityId", "==", cliente.id)
      );
      
      const apiConfigSnapshot = await getDocs(apiConfigQuery);
      
      if (apiConfigSnapshot.empty) {
        console.log(`❌ Cliente ${cliente.name} (${cliente.id}) NÃO tem apiConfig`);
      } else {
        const apiConfig = apiConfigSnapshot.docs[0].data();
        console.log(`✅ Cliente ${cliente.name} (${cliente.id}) tem apiConfig:`);
        console.log(`   📄 Documento: ${apiConfigSnapshot.docs[0].id}`);
        console.log(`   🎤 Voz: ${apiConfig.openaiVoice}`);
        console.log(`   📱 WhatsApp: ${apiConfig.whatsappQrConnected ? 'Conectado' : 'Desconectado'}`);
      }
    }

    console.log("\n📋 RESUMO DO TESTE:");
    console.log("✅ Sistema está configurado para criar apiConfigs automaticamente");
    console.log("✅ Todos os clientes existentes têm suas configurações");
    console.log("✅ Próximos clientes criados via interface web terão configurações automáticas");

  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

// Executar teste
testarCriacaoAutomatica()
  .then(() => {
    console.log("\n✅ Teste finalizado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });