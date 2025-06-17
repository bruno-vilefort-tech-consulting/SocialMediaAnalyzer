import { initializeApp } from 'firebase/app';
import { getFirestore, collection, setDoc, doc } from 'firebase/firestore';
import bcrypt from 'bcrypt';

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

async function criarUsuario() {
  try {
    console.log('🔧 Criando usuário Daniel Braga...');
    
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
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

criarUsuario();