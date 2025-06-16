import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function investigarConexaoAtiva() {
  console.log("🔍 INVESTIGANDO ONDE ESTÁ A CONEXÃO ATIVA DO WHATSAPP...\n");

  try {
    // Verificar todas as coleções possíveis que podem ter dados de conexão
    const colecoesPossíveis = [
      'whatsappConnections',
      'whatsappSessions', 
      'connections',
      'sessions',
      'whatsappAuth',
      'baileys',
      'qrConnections',
      'activeConnections'
    ];

    for (const nomeColecao of colecoesPossíveis) {
      console.log(`📋 VERIFICANDO COLEÇÃO: ${nomeColecao}`);
      try {
        const snapshot = await getDocs(collection(db, nomeColecao));
        
        if (snapshot.empty) {
          console.log(`   📊 Coleção vazia ou não existe`);
        } else {
          console.log(`   ✅ ${snapshot.size} documento(s) encontrado(s):`);
          
          snapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`\n   📄 Documento ${index + 1}: ${doc.id}`);
            
            // Listar todos os campos do documento
            Object.keys(data).forEach(campo => {
              const valor = data[campo];
              if (typeof valor === 'string' && valor.includes('whatsapp')) {
                console.log(`     🔍 ${campo}: ${valor}`);
              } else if (campo.toLowerCase().includes('phone') || campo.toLowerCase().includes('number')) {
                console.log(`     📞 ${campo}: ${valor}`);
              } else if (campo.toLowerCase().includes('connect') || campo.toLowerCase().includes('active')) {
                console.log(`     🔗 ${campo}: ${valor}`);
              } else if (campo.toLowerCase().includes('time') || campo.toLowerCase().includes('date')) {
                console.log(`     🕒 ${campo}: ${valor}`);
              } else {
                console.log(`     📊 ${campo}: ${typeof valor === 'object' ? JSON.stringify(valor).substring(0, 100) + '...' : valor}`);
              }
            });
          });
        }
      } catch (error) {
        console.log(`   ❌ Erro ao acessar coleção: ${error.message}`);
      }
      console.log("");
    }

    // Verificar se há dados de conexão em outras estruturas
    console.log("📋 VERIFICANDO DADOS GERAIS DO SISTEMA:");
    
    // Verificar coleção de configurações do sistema
    try {
      const systemSnapshot = await getDocs(collection(db, "systemConfig"));
      if (!systemSnapshot.empty) {
        console.log("✅ Configurações do sistema encontradas:");
        systemSnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log(`   📄 ${doc.id}:`, data);
        });
      }
    } catch (error) {
      console.log("📊 Sem configurações de sistema");
    }

    console.log("\n📋 RESUMO DA INVESTIGAÇÃO:");
    console.log("🔍 Analisando onde a conexão ativa está sendo mantida...");
    console.log("💡 A conexão pode estar apenas em memória (Baileys) sem persistência no BD");
    console.log("🔧 Necessário verificar o código que salva a conexão quando estabelecida");

  } catch (error) {
    console.error("❌ Erro na investigação:", error);
  }
}

// Executar investigação
investigarConexaoAtiva()
  .then(() => {
    console.log("\n✅ Investigação finalizada");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });