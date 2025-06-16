import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarConexaoWhatsAppMaster() {
  console.log("🔍 VERIFICANDO CONEXÃO WHATSAPP DO MASTER...\n");

  try {
    // 1. Buscar configuração do master por documento direto
    console.log("📋 1. BUSCANDO CONFIGURAÇÃO MASTER POR DOCUMENTO:");
    const masterConfigDoc = await getDoc(doc(db, "apiConfigs", "master_1749848502212"));
    
    if (masterConfigDoc.exists()) {
      const masterConfig = masterConfigDoc.data();
      console.log("✅ Configuração master encontrada:");
      console.log(`   📄 Documento: master_1749848502212`);
      console.log(`   📊 ID: ${masterConfig.id}`);
      console.log(`   👤 Entity Type: ${masterConfig.entityType}`);
      console.log(`   🆔 Entity ID: ${masterConfig.entityId}`);
      console.log(`   🎤 Voz TTS: ${masterConfig.openaiVoice}`);
      console.log(`   📱 WhatsApp Conectado: ${masterConfig.whatsappQrConnected}`);
      console.log(`   📞 Número WhatsApp: ${masterConfig.whatsappQrPhoneNumber || 'Não definido'}`);
      console.log(`   🕒 Última Conexão: ${masterConfig.whatsappQrLastConnection || 'Nunca'}`);
    } else {
      console.log("❌ Configuração master não encontrada no documento master_1749848502212");
    }

    // 2. Buscar todas as configurações master por query
    console.log("\n📋 2. BUSCANDO TODAS AS CONFIGURAÇÕES MASTER:");
    const masterQuery = query(
      collection(db, "apiConfigs"),
      where("entityType", "==", "master")
    );
    
    const masterSnapshot = await getDocs(masterQuery);
    
    if (masterSnapshot.empty) {
      console.log("❌ Nenhuma configuração master encontrada");
    } else {
      console.log(`✅ ${masterSnapshot.size} configuração(ões) master encontrada(s):`);
      
      masterSnapshot.docs.forEach((doc, index) => {
        const config = doc.data();
        console.log(`\n   📄 Documento ${index + 1}: ${doc.id}`);
        console.log(`   📊 ID: ${config.id}`);
        console.log(`   🆔 Entity ID: ${config.entityId}`);
        console.log(`   🎤 Voz TTS: ${config.openaiVoice}`);
        console.log(`   📱 WhatsApp Conectado: ${config.whatsappQrConnected}`);
        console.log(`   📞 Número WhatsApp: ${config.whatsappQrPhoneNumber || 'Não definido'}`);
        console.log(`   🕒 Última Conexão: ${config.whatsappQrLastConnection || 'Nunca'}`);
      });
    }

    // 3. Verificar também a coleção whatsappConnections (se existir)
    console.log("\n📋 3. VERIFICANDO COLEÇÃO WHATSAPP CONNECTIONS:");
    try {
      const whatsappSnapshot = await getDocs(collection(db, "whatsappConnections"));
      
      if (whatsappSnapshot.empty) {
        console.log("📊 Nenhuma conexão WhatsApp encontrada na coleção separada");
      } else {
        console.log(`✅ ${whatsappSnapshot.size} conexão(ões) WhatsApp encontrada(s):`);
        
        whatsappSnapshot.docs.forEach((doc, index) => {
          const connection = doc.data();
          console.log(`\n   📄 Documento ${index + 1}: ${doc.id}`);
          console.log(`   📞 Número: ${connection.phoneNumber || 'Não definido'}`);
          console.log(`   🔗 Conectado: ${connection.connected || false}`);
          console.log(`   🕒 Última Conexão: ${connection.lastConnection || 'Nunca'}`);
        });
      }
    } catch (error) {
      console.log("📊 Coleção whatsappConnections não existe ou está vazia");
    }

    console.log("\n📋 RESUMO:");
    console.log("✅ A conexão WhatsApp do master está armazenada em:");
    console.log("   📍 Firebase Firestore > apiConfigs > master_1749848502212");
    console.log("   🔑 Campos: whatsappQrConnected, whatsappQrPhoneNumber, whatsappQrLastConnection");

  } catch (error) {
    console.error("❌ Erro na verificação:", error);
  }
}

// Executar verificação
verificarConexaoWhatsAppMaster()
  .then(() => {
    console.log("\n✅ Verificação finalizada");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });