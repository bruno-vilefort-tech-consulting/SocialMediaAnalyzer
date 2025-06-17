import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBkdDBY_Yr-oPABZhOO-sHmLgNJVOKOb2g",
  authDomain: "ai-interview-platform.firebaseapp.com",
  projectId: "ai-interview-platform",
  storageBucket: "ai-interview-platform.firebasestorage.app",
  messagingSenderId: "134751027900",
  appId: "1:134751027900:web:4c3eabf9b8e73b2e4c6f1e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarUsuarios() {
  try {
    console.log('🔍 Verificando todos os usuários no Firebase...\n');
    
    const usersSnapshot = await getDocs(collection(db, "users"));
    
    console.log(`📊 Total de usuários: ${usersSnapshot.size}\n`);
    
    usersSnapshot.docs.forEach((doc, index) => {
      const userData = doc.data();
      console.log(`${index + 1}. Usuário:`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Nome: ${userData.name}`);
      console.log(`   Email: ${userData.email}`);
      console.log(`   Role: ${userData.role}`);
      console.log(`   ClientId: ${userData.clientId} (tipo: ${typeof userData.clientId})`);
      console.log(`   Status: ${userData.status}`);
      console.log(`   Created: ${userData.createdAt ? userData.createdAt.toDate() : 'N/A'}`);
      console.log('   ---');
    });
    
    // Verificar especificamente Daniel Braga
    const danielBraga = usersSnapshot.docs.find(doc => {
      const data = doc.data();
      return data.name === 'Daniel Braga' || data.email?.includes('daniel.braga');
    });
    
    if (danielBraga) {
      console.log('\n🎯 Daniel Braga encontrado:');
      const data = danielBraga.data();
      console.log(`   ID: ${danielBraga.id}`);
      console.log(`   Nome: ${data.name}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Role: ${data.role}`);
      console.log(`   ClientId: ${data.clientId} (tipo: ${typeof data.clientId})`);
      console.log(`   Status: ${data.status}`);
    } else {
      console.log('\n❌ Daniel Braga não encontrado');
    }
    
    // Verificar clientId 1749849987543
    const clientUsers = usersSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.clientId === 1749849987543 && data.role === 'client';
    });
    
    console.log(`\n🔍 Usuários com clientId 1749849987543: ${clientUsers.length}`);
    clientUsers.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.name} (${data.email})`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

verificarUsuarios();