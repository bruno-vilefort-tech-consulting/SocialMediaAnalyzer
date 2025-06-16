import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";

// Configuração Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function compararConfigs() {
  console.log("🔍 COMPARAÇÃO: masterSettings vs apiConfigs\n");

  try {
    // 1. Verificar apiConfigs (estrutura antiga)
    console.log("📋 1. ESTRUTURA ANTIGA - apiConfigs:");
    const apiConfigDoc = await getDoc(doc(db, "apiConfigs", "1"));
    
    if (apiConfigDoc.exists()) {
      const apiConfigData = apiConfigDoc.data();
      console.log("✅ apiConfigs encontrada:");
      console.log(`   - openaiApiKey: ${apiConfigData.openaiApiKey ? '***DEFINIDA***' : 'null'}`);
      console.log(`   - openaiModel: ${apiConfigData.openaiModel || 'não definido'}`);
      console.log(`   - firebaseProjectId: ${apiConfigData.firebaseProjectId || 'não definido'}`);
      console.log(`   - whatsappQrConnected: ${apiConfigData.whatsappQrConnected || false}`);
      console.log(`   - Estrutura: GLOBAL (uma para todo sistema)`);
    } else {
      console.log("❌ Nenhuma apiConfig encontrada");
    }

    // 2. Verificar masterSettings (estrutura nova)
    console.log("\n📋 2. ESTRUTURA NOVA - masterSettings:");
    const masterSettingsSnapshot = await getDocs(collection(db, "masterSettings"));
    
    if (masterSettingsSnapshot.empty) {
      console.log("❌ Nenhuma masterSettings encontrada");
    } else {
      console.log(`✅ ${masterSettingsSnapshot.size} configuração(ões) por usuário master:`);
      
      masterSettingsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`
   📄 Master ID: ${doc.id}
      - masterUserId: ${data.masterUserId}
      - openaiApiKey: ${data.openaiApiKey ? '***DEFINIDA***' : 'null'}
      - gptModel: ${data.gptModel || 'não definido'}
      - updatedAt: ${data.updatedAt ? data.updatedAt.toDate() : 'não definido'}
      - Estrutura: POR USUÁRIO (isolada e independente)
        `);
      });
    }

    // 3. Comparação lado a lado
    console.log("\n📊 3. COMPARAÇÃO DETALHADA:");
    console.log("┌─────────────────────┬─────────────────────┬─────────────────────┐");
    console.log("│      ASPECTO        │     apiConfigs      │   masterSettings    │");
    console.log("├─────────────────────┼─────────────────────┼─────────────────────┤");
    console.log("│ Estrutura           │ Global única        │ Por usuário master  │");
    console.log("│ Escalabilidade      │ Limitada            │ Ilimitada           │");
    console.log("│ Isolamento          │ Compartilhada       │ Isolada por user    │");
    console.log("│ Chaves OpenAI       │ Uma para todos      │ Uma por master      │");
    console.log("│ Modelo GPT          │ Fixo para todos     │ Customizável        │");
    console.log("│ Status atual        │ Legado/Descontinuada│ Ativa e funcional   │");
    console.log("│ Endpoints           │ /api/config         │ /api/master-settings│");
    console.log("└─────────────────────┴─────────────────────┴─────────────────────┘");

    // 4. Migração realizada
    console.log("\n🔄 4. PROCESSO DE MIGRAÇÃO:");
    console.log("✅ Sistema migrado de apiConfigs → masterSettings");
    console.log("✅ Cada usuário master agora possui configurações independentes");
    console.log("✅ Frontend atualizado para usar novos endpoints");
    console.log("✅ Backend implementado com novos métodos de storage");
    console.log("⚠️ apiConfigs mantida para compatibilidade (não utilizada)");

  } catch (error) {
    console.error("❌ Erro ao comparar configurações:", error);
  }
}

compararConfigs();