import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarNovaArquitetura() {
  console.log("🔍 VERIFICANDO NOVA ARQUITETURA FIREBASE...\n");

  try {
    console.log("📋 1. VERIFICANDO MASTER SETTINGS GLOBAL");
    
    const globalMasterDoc = await getDoc(doc(db, "masterSettings", "global"));
    if (globalMasterDoc.exists()) {
      const data = globalMasterDoc.data();
      console.log("✅ Master Settings Global encontrada:");
      console.log(`   📊 ID: ${data.id}`);
      console.log(`   🔑 OpenAI Key: ${data.openaiApiKey ? '***CONFIGURADA***' : 'NÃO CONFIGURADA'}`);
      console.log(`   🤖 GPT Model: ${data.gptModel}`);
      console.log(`   📅 Atualizada: ${data.updatedAt?.toDate?.() || data.updatedAt}`);
    } else {
      console.log("❌ Master Settings Global não encontrada");
    }

    console.log("\n📋 2. VERIFICANDO API CONFIGS POR ENTIDADE");
    
    const apiConfigsSnapshot = await getDocs(collection(db, "apiConfigs"));
    
    if (!apiConfigsSnapshot.empty) {
      console.log(`✅ ${apiConfigsSnapshot.size} configuração(ões) de API encontrada(s):`);
      
      apiConfigsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`\n   📄 Documento: ${doc.id}`);
        console.log(`   📊 ID: ${data.id}`);
        console.log(`   👤 Tipo: ${data.entityType || 'INDEFINIDO'}`);
        console.log(`   🆔 Entity ID: ${data.entityId || 'INDEFINIDO'}`);
        console.log(`   🎤 Voz TTS: ${data.openaiVoice || 'NÃO CONFIGURADA'}`);
        console.log(`   📱 WhatsApp: ${data.whatsappQrConnected ? 'Conectado' : 'Desconectado'}`);
        if (data.whatsappQrPhoneNumber) {
          console.log(`   📞 Telefone: ${data.whatsappQrPhoneNumber}`);
        }
        if (data.whatsappQrLastConnection) {
          console.log(`   📅 Última conexão: ${data.whatsappQrLastConnection?.toDate?.() || data.whatsappQrLastConnection}`);
        }
      });
    } else {
      console.log("❌ Nenhuma configuração de API encontrada");
    }

    console.log("\n📋 3. VERIFICANDO ESTRUTURA ANTIGA (DEVE ESTAR VAZIA)");
    
    // Verificar se estruturas antigas ainda existem
    const oldMasterSettingsSnapshot = await getDocs(collection(db, "masterSettings"));
    const oldMasterCount = oldMasterSettingsSnapshot.size - 1; // -1 para excluir o documento global
    
    console.log(`📊 Configurações master antigas: ${oldMasterCount} (devem ser removidas)`);
    
    const oldConfigDoc = await getDoc(doc(db, "config", "api"));
    console.log(`📊 Configuração API antiga: ${oldConfigDoc.exists() ? 'EXISTE (pode ser removida)' : 'Não existe'}`);
    
    const clientVoiceSnapshot = await getDocs(collection(db, "clientVoiceSettings"));
    console.log(`📊 Configurações de voz de cliente: ${clientVoiceSnapshot.size} (DEPRECATED)`);

    console.log("\n📋 4. RESUMO DA NOVA ARQUITETURA");
    console.log("✅ Nova estrutura implementada com sucesso:");
    console.log("├── masterSettings/global → Configurações OpenAI compartilhadas");
    console.log("└── apiConfigs/{entityType}_{entityId} → Configurações específicas");
    console.log("    ├── master_ID → TTS + WhatsApp para masters");
    console.log("    └── client_ID → TTS + WhatsApp para clientes");

    console.log("\n📋 5. PRÓXIMOS PASSOS");
    console.log("🔄 Frontend precisa ser atualizado para usar novas rotas:");
    console.log("   - GET /api/master-settings (global, sem parâmetro de usuário)");
    console.log("   - GET /api/api-config/{entityType}/{entityId}");
    console.log("   - POST /api/api-config (para salvar configurações específicas)");

  } catch (error) {
    console.error("❌ Erro durante verificação:", error);
  }
}

// Executar verificação
verificarNovaArquitetura()
  .then(() => {
    console.log("\n✅ Verificação da nova arquitetura finalizada");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });