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

async function verificarMasterSettings() {
  console.log("🔍 VERIFICANDO CONFIGURAÇÕES MASTER NO FIREBASE...\n");

  try {
    // 1. Verificar coleção masterSettings
    console.log("📋 1. COLEÇÃO masterSettings:");
    const masterSettingsSnapshot = await getDocs(collection(db, "masterSettings"));
    
    if (masterSettingsSnapshot.empty) {
      console.log("❌ Nenhuma configuração master encontrada");
    } else {
      console.log(`✅ ${masterSettingsSnapshot.size} configuração(ões) master encontrada(s):`);
      
      masterSettingsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`
📄 Documento ID: ${doc.id}
   - masterUserId: ${data.masterUserId}
   - openaiApiKey: ${data.openaiApiKey ? '***DEFINIDA***' : 'null'}
   - gptModel: ${data.gptModel || 'não definido'}
   - updatedAt: ${data.updatedAt ? data.updatedAt.toDate() : 'não definido'}
        `);
      });
    }

    // 2. Verificar usuário master específico
    console.log("\n👑 2. USUÁRIO MASTER ATUAL:");
    const usersSnapshot = await getDocs(collection(db, "users"));
    
    let masterUser = null;
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.role === 'master') {
        masterUser = { id: doc.id, ...userData };
        console.log(`✅ Master encontrado: ${userData.name} (${userData.email})`);
        console.log(`   ID: ${doc.id}`);
      }
    });

    // 3. Verificar configurações específicas do master atual
    if (masterUser) {
      console.log("\n🔧 3. CONFIGURAÇÕES DO MASTER ATUAL:");
      const masterConfigDoc = await getDoc(doc(db, "masterSettings", masterUser.id));
      
      if (masterConfigDoc.exists()) {
        const config = masterConfigDoc.data();
        console.log(`✅ Configurações encontradas para master ${masterUser.id}:`);
        console.log(`   - Chave OpenAI: ${config.openaiApiKey ? '***CONFIGURADA***' : 'NÃO CONFIGURADA'}`);
        console.log(`   - Modelo GPT: ${config.gptModel || 'gpt-4o (padrão)'}`);
        console.log(`   - Última atualização: ${config.updatedAt ? config.updatedAt.toDate() : 'N/A'}`);
      } else {
        console.log(`❌ Nenhuma configuração encontrada para master ${masterUser.id}`);
      }
    }

    // 4. Verificar estrutura de dados
    console.log("\n📊 4. RESUMO DA ESTRUTURA:");
    console.log("Firebase Firestore:");
    console.log("├── masterSettings/ (coleção)");
    console.log("│   └── {masterUserId}/ (documento)");
    console.log("│       ├── masterUserId: string");
    console.log("│       ├── openaiApiKey: string");
    console.log("│       ├── gptModel: string");
    console.log("│       └── updatedAt: timestamp");
    console.log("└── users/ (coleção de usuários)");

  } catch (error) {
    console.error("❌ Erro ao verificar configurações:", error);
  }
}

verificarMasterSettings();