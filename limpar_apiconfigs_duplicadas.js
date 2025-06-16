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

async function limparApiConfigsDuplicadas() {
  console.log("🧹 LIMPANDO API CONFIGS DUPLICADAS...\n");

  try {
    const apiConfigsSnapshot = await getDocs(collection(db, "apiConfigs"));
    let removedCount = 0;
    let validConfigs = [];

    console.log(`📊 Total de configurações encontradas: ${apiConfigsSnapshot.size}`);

    for (const docSnap of apiConfigsSnapshot.docs) {
      const data = docSnap.data();
      const docId = docSnap.id;
      
      console.log(`🔍 Analisando: ${docId}`);
      console.log(`   Tipo: ${data.entityType || 'INDEFINIDO'}`);
      console.log(`   Entity ID: ${data.entityId || 'INDEFINIDO'}`);
      
      // Manter apenas configurações válidas com entityType e entityId definidos
      if (!data.entityType || !data.entityId || 
          data.entityType === "undefined" || data.entityId === "undefined" ||
          docId.includes("undefined")) {
        
        console.log(`🗑️ Removendo configuração inválida: ${docId}`);
        await deleteDoc(doc(db, "apiConfigs", docId));
        removedCount++;
      } else {
        console.log(`✅ Configuração válida mantida: ${docId}`);
        validConfigs.push({ id: docId, ...data });
      }
    }

    console.log(`\n📊 RESULTADO:`);
    console.log(`🗑️ Configurações removidas: ${removedCount}`);
    console.log(`✅ Configurações válidas mantidas: ${validConfigs.length}`);
    
    validConfigs.forEach(config => {
      console.log(`   ✅ ${config.entityType}_${config.entityId}: Voz=${config.openaiVoice || 'N/A'}, WhatsApp=${config.whatsappQrConnected ? 'Conectado' : 'Desconectado'}`);
    });

    console.log("\n🎉 Limpeza de API Configs concluída com sucesso!");

  } catch (error) {
    console.error("❌ Erro durante limpeza:", error);
  }
}

// Executar limpeza
limparApiConfigsDuplicadas()
  .then(() => {
    console.log("\n✅ Script de limpeza finalizado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });