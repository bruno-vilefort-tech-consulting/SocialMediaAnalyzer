import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDGpAHia_wEmrhnmYjrPJmMIIQmod_2tHs",
  authDomain: "replit-interview-system.firebaseapp.com",
  projectId: "replit-interview-system",
  storageBucket: "replit-interview-system.firebasestorage.app",
  messagingSenderId: "1092163565832",
  appId: "1:1092163565832:web:b6902ba81c50eff0b98800"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarUsuarios() {
  try {
    console.log("\n🔍 VERIFICANDO USUÁRIOS NO FIREBASE:");
    console.log("========================================");

    // 1. Buscar todos os usuários
    const usersSnapshot = await getDocs(collection(db, "users"));
    
    if (usersSnapshot.empty) {
      console.log("❌ Nenhum usuário encontrado na coleção 'users'");
      return;
    }

    console.log(`✅ ${usersSnapshot.size} usuário(s) encontrado(s):\n`);
    
    usersSnapshot.docs.forEach((doc, index) => {
      const user = doc.data();
      console.log(`📄 Usuário ${index + 1}:`);
      console.log(`   🆔 ID: ${doc.id}`);
      console.log(`   👤 Nome: ${user.name}`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🏷️ Role: ${user.role}`);
      console.log(`   🏢 Cliente ID: ${user.clientId || 'N/A'}`);
      console.log(`   📅 Criado em: ${user.createdAt?.toDate?.() || user.createdAt || 'N/A'}`);
      console.log("");
    });

    // 2. Verificar especificamente usuários de clientes
    console.log("\n🏢 VERIFICANDO USUÁRIOS POR TIPO:");
    console.log("===================================");
    
    const masterQuery = query(collection(db, "users"), where("role", "==", "master"));
    const clientQuery = query(collection(db, "users"), where("role", "==", "client"));
    
    const masterSnapshot = await getDocs(masterQuery);
    const clientSnapshot = await getDocs(clientQuery);
    
    console.log(`👑 Masters: ${masterSnapshot.size}`);
    console.log(`🏢 Clientes: ${clientSnapshot.size}`);
    
    if (clientSnapshot.size > 0) {
      console.log("\n📋 USUÁRIOS CLIENTES DETALHADOS:");
      clientSnapshot.docs.forEach((doc, index) => {
        const user = doc.data();
        console.log(`   ${index + 1}. ${user.name} (${user.email}) - Cliente ID: ${user.clientId}`);
      });
    }

    // 3. Verificar clientes existentes
    console.log("\n🏢 VERIFICANDO CLIENTES:");
    console.log("========================");
    
    const clientsSnapshot = await getDocs(collection(db, "clients"));
    console.log(`✅ ${clientsSnapshot.size} cliente(s) encontrado(s):\n`);
    
    clientsSnapshot.docs.forEach((doc, index) => {
      const client = doc.data();
      console.log(`   ${index + 1}. ${client.companyName} (ID: ${doc.id})`);
    });

  } catch (error) {
    console.error("❌ Erro ao verificar usuários:", error);
  }
}

verificarUsuarios();