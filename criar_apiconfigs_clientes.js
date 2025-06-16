import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function criarApiConfigsClientes() {
  console.log("🔧 CRIANDO API CONFIGS PARA CLIENTES EXISTENTES...\n");

  const clientesExistentes = [
    {
      id: "1749849987543",
      nome: "Grupo Maximuns"
    },
    {
      id: "1749852235275", 
      nome: "Universidade dos Campeões"
    }
  ];

  try {
    for (const cliente of clientesExistentes) {
      const docId = `client_${cliente.id}`;
      const apiConfigData = {
        id: Date.now() + Math.floor(Math.random() * 1000), // ID único
        entityType: "client",
        entityId: cliente.id,
        openaiVoice: "nova", // Voz padrão
        whatsappQrConnected: false,
        whatsappQrPhoneNumber: null,
        whatsappQrLastConnection: null,
        firebaseProjectId: null,
        firebaseServiceAccount: null,
        updatedAt: new Date()
      };

      console.log(`🔧 Criando configuração para cliente: ${cliente.nome} (ID: ${cliente.id})`);
      
      await setDoc(doc(db, "apiConfigs", docId), apiConfigData);
      
      console.log(`✅ Configuração criada: ${docId}`);
      console.log(`   📊 Entity Type: ${apiConfigData.entityType}`);
      console.log(`   🆔 Entity ID: ${apiConfigData.entityId}`);
      console.log(`   🎤 Voz TTS: ${apiConfigData.openaiVoice}`);
      console.log(`   📱 WhatsApp: Desconectado\n`);
    }

    console.log("🎉 Configurações criadas com sucesso para todos os clientes!");
    console.log("\n📋 RESUMO:");
    console.log("✅ Grupo Maximuns (1749849987543) → client_1749849987543");
    console.log("✅ Universidade dos Campeões (1749852235275) → client_1749852235275");
    console.log("\n🔄 Próximo passo: Implementar criação automática para novos clientes");

  } catch (error) {
    console.error("❌ Erro ao criar configurações:", error);
  }
}

// Executar criação
criarApiConfigsClientes()
  .then(() => {
    console.log("\n✅ Script finalizado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });