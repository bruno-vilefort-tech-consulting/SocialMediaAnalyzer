import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function limparEstruturaAntiga() {
  console.log("🧹 LIMPANDO ESTRUTURAS ANTIGAS DO FIREBASE...\n");

  try {
    console.log("📋 1. REMOVENDO MASTER SETTINGS ANTIGAS (MANTENDO GLOBAL)");
    
    const masterSettingsSnapshot = await getDocs(collection(db, "masterSettings"));
    let removedCount = 0;
    
    for (const docSnap of masterSettingsSnapshot.docs) {
      if (docSnap.id !== "global") {
        console.log(`🗑️ Removendo masterSettings/${docSnap.id}`);
        await deleteDoc(doc(db, "masterSettings", docSnap.id));
        removedCount++;
      }
    }
    
    console.log(`✅ ${removedCount} configuração(ões) master antiga(s) removida(s)`);

    console.log("\n📋 2. REMOVENDO CONFIGURAÇÃO API ANTIGA");
    
    try {
      await deleteDoc(doc(db, "config", "api"));
      console.log("✅ Configuração API antiga removida");
    } catch (error) {
      console.log("ℹ️ Configuração API antiga não encontrada (já removida)");
    }

    console.log("\n📋 3. LIMPANDO API CONFIGS MAL FORMADAS");
    
    const apiConfigsSnapshot = await getDocs(collection(db, "apiConfigs"));
    let cleanedCount = 0;
    
    for (const docSnap of apiConfigsSnapshot.docs) {
      const data = docSnap.data();
      
      // Remove configurações com entityType ou entityId indefinidos
      if (!data.entityType || !data.entityId || 
          data.entityType === "undefined" || data.entityId === "undefined") {
        console.log(`🗑️ Removendo apiConfig mal formada: ${docSnap.id}`);
        await deleteDoc(doc(db, "apiConfigs", docSnap.id));
        cleanedCount++;
      }
    }
    
    console.log(`✅ ${cleanedCount} configuração(ões) API mal formada(s) removida(s)`);

    console.log("\n📋 4. VERIFICANDO RESULTADO FINAL");
    
    // Verificar resultado
    const finalMasterSettings = await getDocs(collection(db, "masterSettings"));
    const finalApiConfigs = await getDocs(collection(db, "apiConfigs"));
    
    console.log(`📊 Master Settings restantes: ${finalMasterSettings.size} (deve ser 1 - global)`);
    console.log(`📊 API Configs restantes: ${finalApiConfigs.size}`);
    
    finalApiConfigs.forEach((doc) => {
      const data = doc.data();
      console.log(`   ✅ ${data.entityType}_${data.entityId}: Voz=${data.openaiVoice || 'N/A'}, WhatsApp=${data.whatsappQrConnected ? 'Sim' : 'Não'}`);
    });

    console.log("\n🎉 LIMPEZA CONCLUÍDA COM SUCESSO!");
    console.log("\n📊 ESTRUTURA FINAL:");
    console.log("├── masterSettings/global (OpenAI compartilhada)");
    console.log("└── apiConfigs/ (configurações específicas por entidade)");
    console.log("    └── master_1749848502212 (TTS + WhatsApp para o master)");

  } catch (error) {
    console.error("❌ Erro durante limpeza:", error);
  }
}

// Executar limpeza
limparEstruturaAntiga()
  .then(() => {
    console.log("\n✅ Script de limpeza finalizado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });