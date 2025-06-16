import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugUsuariosCliente() {
  try {
    console.log('🔍 Investigando usuários no Firebase...');
    
    // Buscar na coleção principal de usuários
    console.log('\n📋 USUÁRIOS PRINCIPAIS (coleção "users"):');
    const usersQuery = collection(db, "users");
    const usersSnapshot = await getDocs(usersQuery);
    
    usersSnapshot.docs.forEach((doc) => {
      const userData = doc.data();
      console.log(`- ID: ${doc.id}`);
      console.log(`  Email: ${userData.email}`);
      console.log(`  Nome: ${userData.name || 'N/A'}`);
      console.log(`  Role: ${userData.role}`);
      console.log(`  ClientId: ${userData.clientId || 'N/A'}`);
      console.log(`  Criado em: ${userData.createdAt?.toDate?.() || userData.createdAt || 'N/A'}`);
      console.log('');
    });
    
    // Buscar na coleção de usuários de clientes
    console.log('\n📋 USUÁRIOS DE CLIENTES (coleção "clientUsers"):');
    const clientUsersQuery = collection(db, "clientUsers");
    const clientUsersSnapshot = await getDocs(clientUsersQuery);
    
    if (clientUsersSnapshot.empty) {
      console.log('  Nenhum usuário encontrado na coleção clientUsers');
    } else {
      clientUsersSnapshot.docs.forEach((doc) => {
        const userData = doc.data();
        console.log(`- ID: ${doc.id}`);
        console.log(`  Email: ${userData.email}`);
        console.log(`  Nome: ${userData.name || 'N/A'}`);
        console.log(`  ClientId: ${userData.clientId}`);
        console.log(`  Criado em: ${userData.createdAt?.toDate?.() || userData.createdAt || 'N/A'}`);
        console.log('');
      });
    }
    
    // Buscar especificamente por emails mencionados
    console.log('\n🔍 BUSCA ESPECÍFICA pelos emails mencionados:');
    const emails = ['daniel@grupomaximuns.com.br', 'danielmoreirabraga@gmail.com'];
    
    for (const email of emails) {
      console.log(`\nBuscando: ${email}`);
      
      // Na coleção users
      const userQuery = query(collection(db, "users"), where("email", "==", email));
      const userSnapshot = await getDocs(userQuery);
      
      if (!userSnapshot.empty) {
        userSnapshot.docs.forEach((doc) => {
          const userData = doc.data();
          console.log(`  ✓ Encontrado em "users": ID=${doc.id}, Role=${userData.role}, ClientId=${userData.clientId || 'N/A'}`);
        });
      }
      
      // Na coleção clientUsers
      const clientUserQuery = query(collection(db, "clientUsers"), where("email", "==", email));
      const clientUserSnapshot = await getDocs(clientUserQuery);
      
      if (!clientUserSnapshot.empty) {
        clientUserSnapshot.docs.forEach((doc) => {
          const userData = doc.data();
          console.log(`  ✓ Encontrado em "clientUsers": ID=${doc.id}, ClientId=${userData.clientId}`);
        });
      }
      
      if (userSnapshot.empty && clientUserSnapshot.empty) {
        console.log(`  ✗ Não encontrado em nenhuma coleção`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao investigar usuários:', error);
  }
}

debugUsuariosCliente();