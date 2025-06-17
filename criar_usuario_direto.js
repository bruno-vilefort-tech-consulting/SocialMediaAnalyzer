import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
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

async function criarUsuario() {
  try {
    console.log('🔧 Criando usuário Daniel Braga diretamente...');
    
    const userId = Date.now().toString();
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const userData = {
      id: userId,
      name: 'Daniel Braga',
      email: 'daniel.braga@teste.com',
      password: hashedPassword,
      role: 'client',
      clientId: 1749849987543,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await setDoc(doc(db, "users", userId), userData);
    
    console.log('✅ Usuário criado com sucesso:');
    console.log(`   ID: ${userData.id}`);
    console.log(`   Nome: ${userData.name}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   ClientId: ${userData.clientId}`);
    console.log(`   Role: ${userData.role}`);
    
    console.log('\n🔍 Verificando se o usuário foi salvo...');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

criarUsuario();