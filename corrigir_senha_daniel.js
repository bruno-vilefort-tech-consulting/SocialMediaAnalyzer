import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import bcrypt from 'bcrypt';

const firebaseConfig = {
  apiKey: 'AIzaSyC4LQwmDDGLjSLCEDlqFzGV2iaNsyUHHj8',
  authDomain: 'ai-interview-system-437213.firebaseapp.com',
  projectId: 'ai-interview-system-437213',
  storageBucket: 'ai-interview-system-437213.appspot.com',
  messagingSenderId: '1014974755093',
  appId: '1:1014974755093:web:83d4b7a8b87c2aaf0b31b8'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function corrigirSenhaDaniel() {
  try {
    console.log('🔧 Corrigindo senha do usuário Daniel Braga...');
    
    // Criptografar a senha "580190"
    const senhaTexto = '580190';
    const saltRounds = 10;
    const senhaCriptografada = await bcrypt.hash(senhaTexto, saltRounds);
    
    console.log('🔐 Senha original:', senhaTexto);
    console.log('🔐 Hash gerado:', senhaCriptografada);
    
    // Atualizar o usuário no Firebase
    const userRef = doc(db, 'users', '1750131049173');
    await updateDoc(userRef, {
      password: senhaCriptografada,
      updatedAt: new Date()
    });
    
    console.log('✅ Senha do Daniel Braga atualizada com hash bcrypt');
    
    // Testar se a senha funciona
    const senhaCorreta = await bcrypt.compare(senhaTexto, senhaCriptografada);
    console.log('🧪 Teste de comparação:', senhaCorreta ? 'PASSOU' : 'FALHOU');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir senha:', error);
  }
}

corrigirSenhaDaniel();