import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrarNovaArquitetura() {
  console.log("🔄 MIGRANDO PARA NOVA ARQUITETURA...\n");

  try {
    console.log("📋 1. MIGRAÇÃO MASTER SETTINGS - DE POR USUÁRIO PARA GLOBAL");
    
    // 1. Buscar todas as configurações masterSettings por usuário
    const masterSettingsSnapshot = await getDocs(collection(db, "masterSettings"));
    
    if (!masterSettingsSnapshot.empty) {
      console.log(`✅ ${masterSettingsSnapshot.size} configuração(ões) master encontrada(s)`);
      
      // Pegar a primeira configuração válida para migrar para global
      let configToMigrate = null;
      masterSettingsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.openaiApiKey && !configToMigrate) {
          configToMigrate = {
            openaiApiKey: data.openaiApiKey,
            gptModel: data.gptModel || 'gpt-4o',
            updatedAt: new Date()
          };
          console.log(`📤 Migrando configuração do master ${doc.id} para global`);
        }
      });
      
      if (configToMigrate) {
        // Salvar na estrutura global
        await setDoc(doc(db, "masterSettings", "global"), {
          id: 1,
          ...configToMigrate
        });
        console.log("✅ Configuração OpenAI migrada para estrutura global");
      } else {
        console.log("ℹ️ Nenhuma configuração OpenAI válida encontrada para migrar");
      }
    } else {
      console.log("ℹ️ Nenhuma configuração master encontrada");
    }

    console.log("\n📋 2. MIGRAÇÃO API CONFIGS - CRIAÇÃO DA NOVA ESTRUTURA");
    
    // 2. Migrar configurações antigas de WhatsApp QR para nova estrutura
    const oldConfigDoc = await getDoc(doc(db, "config", "api"));
    
    if (oldConfigDoc.exists()) {
      const oldConfig = oldConfigDoc.data();
      console.log("📤 Migrando configuração WhatsApp antiga para nova estrutura");
      
      // Criar configuração para master (assumindo que é do master principal)
      const masterApiConfig = {
        entityType: 'master',
        entityId: '1749848502212', // ID do master atual
        openaiVoice: 'nova', // Voz padrão
        whatsappQrConnected: oldConfig.whatsappQrConnected || false,
        whatsappQrPhoneNumber: oldConfig.whatsappQrPhoneNumber || null,
        whatsappQrLastConnection: oldConfig.whatsappQrLastConnection || null,
        updatedAt: new Date()
      };
      
      await setDoc(doc(db, "apiConfigs", "master_1749848502212"), {
        id: Date.now(),
        ...masterApiConfig
      });
      
      console.log("✅ Configuração WhatsApp migrada para estrutura master");
    } else {
      console.log("ℹ️ Nenhuma configuração antiga de API encontrada");
    }

    console.log("\n📋 3. MIGRAÇÃO CLIENT VOICE SETTINGS PARA API CONFIGS");
    
    // 3. Migrar configurações de voz de clientes para nova estrutura
    const clientVoiceSnapshot = await getDocs(collection(db, "clientVoiceSettings"));
    
    if (!clientVoiceSnapshot.empty) {
      console.log(`✅ ${clientVoiceSnapshot.size} configuração(ões) de voz de cliente encontrada(s)`);
      
      for (const voiceDoc of clientVoiceSnapshot.docs) {
        const voiceData = voiceDoc.data();
        
        const clientApiConfig = {
          entityType: 'client',
          entityId: voiceData.clientId.toString(),
          openaiVoice: voiceData.openaiVoice || 'nova',
          whatsappQrConnected: false, // Clientes iniciam sem WhatsApp conectado
          whatsappQrPhoneNumber: null,
          whatsappQrLastConnection: null,
          updatedAt: new Date()
        };
        
        await setDoc(doc(db, "apiConfigs", `client_${voiceData.clientId}`), {
          id: Date.now(),
          ...clientApiConfig
        });
        
        console.log(`📤 Migrada configuração de voz do cliente ${voiceData.clientId}`);
      }
      
      console.log("✅ Todas configurações de voz de clientes migradas");
    } else {
      console.log("ℹ️ Nenhuma configuração de voz de cliente encontrada");
    }

    console.log("\n📋 4. VERIFICAÇÃO DA NOVA ESTRUTURA");
    
    // Verificar estrutura global masterSettings
    const globalMasterDoc = await getDoc(doc(db, "masterSettings", "global"));
    if (globalMasterDoc.exists()) {
      const data = globalMasterDoc.data();
      console.log("✅ Master Settings Global:");
      console.log(`   - OpenAI Key: ${data.openaiApiKey ? '***CONFIGURADA***' : 'NÃO CONFIGURADA'}`);
      console.log(`   - GPT Model: ${data.gptModel}`);
    }
    
    // Verificar novas apiConfigs
    const apiConfigsSnapshot = await getDocs(collection(db, "apiConfigs"));
    console.log(`✅ API Configs: ${apiConfigsSnapshot.size} configuração(ões) específica(s)`);
    
    apiConfigsSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`   📄 ${data.entityType} ${data.entityId}:`);
      console.log(`      - Voz TTS: ${data.openaiVoice}`);
      console.log(`      - WhatsApp: ${data.whatsappQrConnected ? 'Conectado' : 'Desconectado'}`);
    });

    console.log("\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!");
    console.log("\n📊 NOVA ARQUITETURA:");
    console.log("├── masterSettings/global (OpenAI compartilhada)");
    console.log("└── apiConfigs/ (configurações específicas por entidade)");
    console.log("    ├── master_ID (voz TTS + WhatsApp QR para masters)");
    console.log("    └── client_ID (voz TTS + WhatsApp QR para clientes)");

  } catch (error) {
    console.error("❌ Erro durante migração:", error);
  }
}

// Executar migração
migrarNovaArquitetura()
  .then(() => {
    console.log("\n✅ Script de migração finalizado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });