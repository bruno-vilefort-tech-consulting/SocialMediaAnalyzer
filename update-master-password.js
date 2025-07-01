/**
 * Script para atualizar senha do usuário master
 */
import bcrypt from 'bcrypt';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

// Configuração Firebase (usando as mesmas configurações do projeto)
const firebaseConfig = {
  apiKey: "AIzaSyCjmRHu2x2qNz8R9uaKphGLCWMb-mC1TyE",
  authDomain: "ai-interview-system-e0b7f.firebaseapp.com",
  projectId: "ai-interview-system-e0b7f",
  storageBucket: "ai-interview-system-e0b7f.firebasestorage.app",
  messagingSenderId: "547481734076",
  appId: "1:547481734076:web:5ccb3db50b0a7c5e6f8ad8",
  measurementId: "G-RT9K5G6XMR"
};

const app = initializeApp(firebaseConfig);
const firebaseDb = getFirestore(app);

async function updateMasterPassword() {
  try {
    const email = 'daniel@grupomaximuns.com.br';
    const newPassword = 'daniel123';
    
    console.log('🔍 Buscando usuário master:', email);
    
    // Buscar o usuário master
    const q = query(
      collection(firebaseDb, 'users'),
      where('email', '==', email),
      where('role', '==', 'master')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('❌ Usuário master não encontrado');
      return;
    }
    
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('✅ Usuário encontrado:', {
      id: userDoc.id,
      name: userData.name,
      email: userData.email,
      role: userData.role
    });
    
    // Criptografar a nova senha
    console.log('🔐 Criptografando nova senha...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Atualizar a senha no Firebase
    console.log('💾 Atualizando senha no banco...');
    await updateDoc(userDoc.ref, { 
      password: hashedPassword 
    });
    
    console.log('✅ Senha do usuário master atualizada com sucesso!');
    console.log('📧 Email:', email);
    console.log('🔑 Nova senha:', newPassword);
    
  } catch (error) {
    console.error('❌ Erro ao atualizar senha:', error);
  }
}

// Executar o script
updateMasterPassword();