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

async function verificarListasCandidatos() {
  console.log("🔍 VERIFICANDO LISTAS DE CANDIDATOS E ATRIBUIÇÕES POR CLIENTE...\n");

  try {
    // 1. Verificar clientes existentes
    console.log("📋 1. CLIENTES CADASTRADOS:");
    const clientsSnapshot = await getDocs(collection(db, "clients"));
    const clients = [];
    clientsSnapshot.forEach((doc) => {
      const client = { id: doc.id, ...doc.data() };
      clients.push(client);
      console.log(`   🏢 ID: ${client.id} | Nome: ${client.companyName} | CNPJ: ${client.cnpj}`);
    });

    // 2. Verificar listas de candidatos
    console.log("\n📋 2. LISTAS DE CANDIDATOS:");
    const listsSnapshot = await getDocs(collection(db, "candidateLists"));
    const lists = [];
    listsSnapshot.forEach((doc) => {
      const list = { id: doc.id, ...doc.data() };
      lists.push(list);
      
      const clientName = clients.find(c => c.id == list.clientId)?.companyName || "⚠️ Cliente não encontrado";
      console.log(`   📝 ID: ${list.id} | Nome: ${list.name} | Cliente ID: ${list.clientId || 'null'} (${clientName})`);
      console.log(`      📅 Criado: ${list.createdAt ? new Date(list.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A'}`);
      console.log(`      📄 Descrição: ${list.description || 'Sem descrição'}`);
    });

    // 3. Verificar candidatos
    console.log("\n📋 3. CANDIDATOS CADASTRADOS:");
    const candidatesSnapshot = await getDocs(collection(db, "candidates"));
    const candidates = [];
    candidatesSnapshot.forEach((doc) => {
      const candidate = { id: doc.id, ...doc.data() };
      candidates.push(candidate);
      
      const clientName = clients.find(c => c.id == candidate.clientId)?.companyName || "⚠️ Cliente não encontrado";
      const listName = lists.find(l => l.id == candidate.listId)?.name || "⚠️ Lista não encontrada";
      
      console.log(`   👤 ID: ${candidate.id} | Nome: ${candidate.name}`);
      console.log(`      📱 WhatsApp: ${candidate.whatsapp} | Email: ${candidate.email}`);
      console.log(`      🏢 Cliente ID: ${candidate.clientId || 'null'} (${clientName})`);
      console.log(`      📝 Lista ID: ${candidate.listId || 'null'} (${listName})`);
    });

    // 4. Análise dos problemas
    console.log("\n📋 4. ANÁLISE DOS PROBLEMAS:");
    
    // Verificar listas sem clientId
    const listsSemCliente = lists.filter(list => !list.clientId);
    if (listsSemCliente.length > 0) {
      console.log(`   ⚠️ ${listsSemCliente.length} lista(s) sem clientId:`);
      listsSemCliente.forEach(list => {
        console.log(`      - ID: ${list.id} | Nome: ${list.name}`);
      });
    }

    // Verificar candidatos sem clientId
    const candidatosSemCliente = candidates.filter(candidate => !candidate.clientId);
    if (candidatosSemCliente.length > 0) {
      console.log(`   ⚠️ ${candidatosSemCliente.length} candidato(s) sem clientId:`);
      candidatosSemCliente.forEach(candidate => {
        console.log(`      - ID: ${candidate.id} | Nome: ${candidate.name}`);
      });
    }

    // Verificar candidatos com clientId inválido
    const candidatosClienteInvalido = candidates.filter(candidate => 
      candidate.clientId && !clients.find(c => c.id == candidate.clientId)
    );
    if (candidatosClienteInvalido.length > 0) {
      console.log(`   ⚠️ ${candidatosClienteInvalido.length} candidato(s) com clientId inválido:`);
      candidatosClienteInvalido.forEach(candidate => {
        console.log(`      - ID: ${candidate.id} | Nome: ${candidate.name} | Cliente ID: ${candidate.clientId}`);
      });
    }

    // 5. Resumo por cliente
    console.log("\n📋 5. RESUMO POR CLIENTE:");
    clients.forEach(client => {
      const clientLists = lists.filter(list => list.clientId == client.id);
      const clientCandidates = candidates.filter(candidate => candidate.clientId == client.id);
      
      console.log(`   🏢 ${client.companyName} (ID: ${client.id}):`);
      console.log(`      📝 Listas: ${clientLists.length}`);
      console.log(`      👤 Candidatos: ${clientCandidates.length}`);
      
      if (clientLists.length > 0) {
        clientLists.forEach(list => {
          const listCandidates = candidates.filter(candidate => candidate.listId == list.id);
          console.log(`         - Lista "${list.name}": ${listCandidates.length} candidatos`);
        });
      }
    });

    console.log("\n📋 6. AÇÕES NECESSÁRIAS:");
    if (listsSemCliente.length > 0 || candidatosSemCliente.length > 0 || candidatosClienteInvalido.length > 0) {
      console.log("🔧 É necessário corrigir as atribuições de cliente:");
      console.log("   1. Atribuir clientId às listas sem cliente");
      console.log("   2. Atribuir clientId aos candidatos sem cliente");
      console.log("   3. Corrigir clientIds inválidos");
    } else {
      console.log("✅ Todas as listas e candidatos estão corretamente atribuídos aos clientes");
    }

  } catch (error) {
    console.error("❌ Erro na verificação:", error);
  }
}

// Executar verificação
verificarListasCandidatos()
  .then(() => {
    console.log("\n✅ Verificação finalizada");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });