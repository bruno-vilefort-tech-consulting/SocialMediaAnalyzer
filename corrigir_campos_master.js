import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function corrigirCamposMaster() {
  console.log("🔧 CORRIGINDO CAMPOS WHATSAPP NA CONFIGURAÇÃO MASTER...\n");

  try {
    // Buscar configuração atual do master
    const masterDocRef = doc(db, "apiConfigs", "master_1749848502212");
    const masterDoc = await getDoc(masterDocRef);

    if (!masterDoc.exists()) {
      console.log("❌ Configuração master não encontrada");
      return;
    }

    const masterConfig = masterDoc.data();
    console.log("📋 CONFIGURAÇÃO ATUAL DO MASTER:");
    console.log(`   📊 ID: ${masterConfig.id}`);
    console.log(`   👤 Entity Type: ${masterConfig.entityType}`);
    console.log(`   🆔 Entity ID: ${masterConfig.entityId}`);
    console.log(`   🎤 Voz TTS: ${masterConfig.openaiVoice}`);
    console.log(`   📱 WhatsApp Conectado: ${masterConfig.whatsappQrConnected || 'CAMPO AUSENTE'}`);
    console.log(`   📞 Número WhatsApp: ${masterConfig.whatsappQrPhoneNumber || 'CAMPO AUSENTE'}`);
    console.log(`   🕒 Última Conexão: ${masterConfig.whatsappQrLastConnection || 'CAMPO AUSENTE'}`);

    // Definir campos que devem existir (mesmos dos clientes)
    const camposWhatsApp = {
      whatsappQrConnected: false,
      whatsappQrPhoneNumber: null,
      whatsappQrLastConnection: null,
      firebaseProjectId: null,
      firebaseServiceAccount: null,
      updatedAt: new Date()
    };

    console.log("\n🔧 ADICIONANDO CAMPOS WHATSAPP AUSENTES...");

    // Atualizar apenas os campos que não existem
    const camposParaAdicionar = {};
    let algumCampoAdicionado = false;

    for (const [campo, valorPadrao] of Object.entries(camposWhatsApp)) {
      if (masterConfig[campo] === undefined) {
        camposParaAdicionar[campo] = valorPadrao;
        algumCampoAdicionado = true;
        console.log(`   ➕ Adicionando campo: ${campo} = ${valorPadrao}`);
      } else {
        console.log(`   ✅ Campo já existe: ${campo} = ${masterConfig[campo]}`);
      }
    }

    if (algumCampoAdicionado) {
      await updateDoc(masterDocRef, camposParaAdicionar);
      console.log("\n✅ Campos WhatsApp adicionados com sucesso!");
    } else {
      console.log("\n✅ Todos os campos WhatsApp já existem!");
    }

    // Verificar configuração atualizada
    const masterDocAtualizado = await getDoc(masterDocRef);
    const configAtualizada = masterDocAtualizado.data();

    console.log("\n📋 CONFIGURAÇÃO ATUALIZADA DO MASTER:");
    console.log(`   📊 ID: ${configAtualizada.id}`);
    console.log(`   👤 Entity Type: ${configAtualizada.entityType}`);
    console.log(`   🆔 Entity ID: ${configAtualizada.entityId}`);
    console.log(`   🎤 Voz TTS: ${configAtualizada.openaiVoice}`);
    console.log(`   📱 WhatsApp Conectado: ${configAtualizada.whatsappQrConnected}`);
    console.log(`   📞 Número WhatsApp: ${configAtualizada.whatsappQrPhoneNumber || 'null'}`);
    console.log(`   🕒 Última Conexão: ${configAtualizada.whatsappQrLastConnection || 'null'}`);
    console.log(`   🔥 Firebase Project ID: ${configAtualizada.firebaseProjectId || 'null'}`);
    console.log(`   🔑 Firebase Service Account: ${configAtualizada.firebaseServiceAccount || 'null'}`);

    console.log("\n🎉 Configuração master agora tem os mesmos campos dos clientes!");

  } catch (error) {
    console.error("❌ Erro ao corrigir campos:", error);
  }
}

// Executar correção
corrigirCamposMaster()
  .then(() => {
    console.log("\n✅ Script finalizado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });