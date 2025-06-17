import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import bcrypt from 'bcrypt';

const firebaseConfig = {
  apiKey: "AIzaSyAFvUSbvTuXuo6KVt4ApG2OSOvXs7AkRx4",
  authDomain: "entrevistaia-cf7b4.firebaseapp.com",
  projectId: "entrevistaia-cf7b4",
  storageBucket: "entrevistaia-cf7b4.firebasestorage.app",
  messagingSenderId: "746157638477",
  appId: "1:746157638477:web:0d55b46c3fbf9a72e8ed04"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

async function testarCriacaoUsuarioInterface() {
  try {
    console.log('🔧 Simulando criação de usuário via interface...');
    
    const clientId = 1749849987543; // Grupo Maximus
    
    console.log('📋 Dados que seriam enviados do frontend:');
    const userData = {
      name: 'Thiago Moreira',
      email: 'thiago.moreira@teste.com',
      password: '123456'
    };
    console.log(userData);
    
    console.log('\n🔍 Verificando se email já existe...');
    const emailQuery = query(collection(db, "users"), where("email", "==", userData.email));
    const emailSnapshot = await getDocs(emailQuery);
    
    if (!emailSnapshot.empty) {
      console.log('❌ Email já existe no sistema');
      return;
    }
    
    console.log('✅ Email disponível');
    
    console.log('\n🔧 Processando criação como o backend faria...');
    const userId = Date.now().toString();
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const userDocument = {
      id: userId,
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      role: 'client',
      clientId: clientId,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('💾 Salvando usuário no Firebase...');
    await setDoc(doc(db, "users", userId), userDocument);
    
    console.log('✅ Usuário criado com sucesso:');
    console.log(`   ID: ${userDocument.id}`);
    console.log(`   Nome: ${userDocument.name}`);
    console.log(`   Email: ${userDocument.email}`);
    console.log(`   ClientId: ${userDocument.clientId}`);
    console.log(`   Role: ${userDocument.role}`);
    
    console.log('\n🔍 Verificando usuários do cliente após criação...');
    const clientUsersQuery = query(collection(db, "users"), where("clientId", "==", clientId));
    const clientUsersSnapshot = await getDocs(clientUsersQuery);
    
    console.log(`📊 Total de usuários do cliente ${clientId}: ${clientUsersSnapshot.size}`);
    clientUsersSnapshot.docs.forEach((doc, index) => {
      const user = doc.data();
      console.log(`   ${index + 1}. ${user.name} (${user.email}) - ID: ${doc.id}`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

testarCriacaoUsuarioInterface();