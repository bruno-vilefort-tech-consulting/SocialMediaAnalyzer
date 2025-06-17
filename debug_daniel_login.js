import bcrypt from 'bcrypt';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBQgCJpJ-kKnUdNPDbCr_HpFPa5YhgArcs",
  authDomain: "ai-interview-system-3.firebaseapp.com",
  projectId: "ai-interview-system-3",
  storageBucket: "ai-interview-system-3.firebasestorage.app",
  messagingSenderId: "1004710083810",
  appId: "1:1004710083810:web:a8b73c84e34f98e25c71e9"
};

const app = initializeApp(firebaseConfig);
const firebaseDb = getFirestore(app);

async function debugDanielLogin() {
  try {
    console.log('🔍 Buscando usuário Daniel Braga...');
    
    const usersRef = collection(firebaseDb, 'users');
    const q = query(usersRef, where("email", "==", "danielmoreirabraga@gmail.com"));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('❌ Usuário não encontrado no Firebase');
      return;
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('👤 Dados do usuário encontrado:', {
      id: userDoc.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      hasPassword: !!userData.password,
      passwordLength: userData.password ? userData.password.length : 0,
      passwordPreview: userData.password ? userData.password.substring(0, 10) + '...' : 'NENHUMA'
    });
    
    const plaintextPassword = 'daniel580190';
    console.log('🔐 Testando senha:', plaintextPassword);
    
    if (userData.password) {
      const isValid = await bcrypt.compare(plaintextPassword, userData.password);
      console.log('✅ Senha válida?', isValid);
      
      if (!isValid) {
        console.log('🔧 Gerando novo hash para a senha...');
        const newHash = await bcrypt.hash(plaintextPassword, 10);
        console.log('🆕 Novo hash:', newHash);
        
        // Atualizar no Firebase
        await updateDoc(doc(firebaseDb, 'users', userDoc.id), {
          password: newHash
        });
        
        console.log('💾 Senha atualizada no Firebase');
        
        // Testar novamente
        const revalidate = await bcrypt.compare(plaintextPassword, newHash);
        console.log('✅ Nova senha válida?', revalidate);
      }
    } else {
      console.log('⚠️ Usuário não tem senha definida, criando uma...');
      const newHash = await bcrypt.hash(plaintextPassword, 10);
      
      await updateDoc(doc(firebaseDb, 'users', userDoc.id), {
        password: newHash
      });
      
      console.log('💾 Senha criada no Firebase');
    }
    
    console.log('🎉 Debug concluído');
    
  } catch (error) {
    console.error('❌ Erro no debug:', error);
  }
}

debugDanielLogin();