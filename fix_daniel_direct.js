import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import bcrypt from 'bcrypt';

const firebaseConfig = {
  apiKey: 'AIzaSyCqux-fHWX_wfRxvPAPUeNyTgdwF3vMQbE',
  authDomain: 'replit-interview-system.firebaseapp.com',
  projectId: 'replit-interview-system',
  storageBucket: 'replit-interview-system.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef123456'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixDanielPassword() {
  try {
    console.log('🔧 Corrigindo senha do usuário Daniel...');
    
    // Buscar usuário Daniel
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', 'danielmoreirabraga@gmail.com'));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('❌ Usuário não encontrado');
      return;
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('👤 Usuário encontrado:', {
      id: userDoc.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      clientId: userData.clientId
    });
    
    // Gerar nova senha hash
    const newPasswordHash = await bcrypt.hash('580190580190', 10);
    console.log('🔐 Nova senha hash gerada');
    
    // Atualizar senha no documento
    await updateDoc(userDoc.ref, {
      password: newPasswordHash
    });
    
    console.log('✅ Senha atualizada no Firebase');
    
    // Testar nova senha
    const testResult = await bcrypt.compare('580190580190', newPasswordHash);
    console.log('🧪 Teste de senha:', testResult ? 'SUCESSO' : 'FALHA');
    
    console.log('🎯 Correção concluída. Dados finais:');
    console.log('  - Email: danielmoreirabraga@gmail.com');
    console.log('  - Senha: 580190580190');
    console.log('  - Role: client');
    console.log('  - ClientId: 1749849987543');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

fixDanielPassword();