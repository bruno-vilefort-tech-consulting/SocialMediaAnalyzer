import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

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

async function corrigirUsuarioClientId() {
  try {
    console.log("\n🔧 CORRIGINDO USUARIO SEM CLIENTID:");
    console.log("===================================");

    // 1. Buscar usuários de cliente sem clientId
    const allUsersSnapshot = await getDocs(collection(db, "users"));
    
    let usuariosCorrigidos = 0;
    
    for (const userDoc of allUsersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Se é um usuário cliente mas não tem clientId
      if (userData.role === 'client' && !userData.clientId) {
        console.log(`\n🔍 Usuário sem clientId encontrado:`);
        console.log(`   Nome: ${userData.name}`);
        console.log(`   Email: ${userData.email}`);
        console.log(`   ID: ${userDoc.id}`);
        
        // Como só temos um cliente ativo (1749849987543), vamos associar a ele
        const clientId = 1749849987543;
        
        console.log(`   ➕ Adicionando clientId: ${clientId}`);
        
        await updateDoc(doc(db, "users", userDoc.id), {
          clientId: clientId
        });
        
        usuariosCorrigidos++;
        console.log(`   ✅ Usuário corrigido com sucesso!`);
      }
    }
    
    console.log(`\n✅ Total de usuários corrigidos: ${usuariosCorrigidos}`);
    
    // 2. Verificar se agora a busca funciona
    console.log("\n🔍 TESTANDO BUSCA APÓS CORREÇÃO:");
    console.log("================================");
    
    const clientUsersQuery = query(
      collection(db, "users"), 
      where("role", "==", "client"),
      where("clientId", "==", 1749849987543)
    );
    
    const clientUsersSnapshot = await getDocs(clientUsersQuery);
    console.log(`📊 Usuários encontrados para clientId 1749849987543: ${clientUsersSnapshot.size}`);
    
    clientUsersSnapshot.docs.forEach((doc, index) => {
      const userData = doc.data();
      console.log(`   ${index + 1}. ${userData.name} (${userData.email}) - ClientId: ${userData.clientId}`);
    });

  } catch (error) {
    console.error("❌ Erro ao corrigir usuário:", error);
  }
}

corrigirUsuarioClientId();