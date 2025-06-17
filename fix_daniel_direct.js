import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'fake-key',
  authDomain: 'fake-domain',
  projectId: 'fake-project-id',
  storageBucket: 'fake-bucket',
  messagingSenderId: '123456789',
  appId: 'fake-app-id'
};

const app = initializeApp(firebaseConfig);
const firebaseDb = getFirestore(app);

async function fixDanielClientId() {
  try {
    console.log('🔧 Corrigindo clientId do usuário Daniel Braga...');
    
    const danielUserId = '1750131049173';
    const correctClientId = 1749849987543; // Grupo Maximuns
    
    await updateDoc(doc(firebaseDb, 'users', danielUserId), {
      clientId: correctClientId,
      updatedAt: new Date()
    });
    
    console.log('✅ ClientId do Daniel atualizado para:', correctClientId);
    
  } catch (error) {
    console.error('❌ Erro ao corrigir clientId:', error.message);
  }
}

fixDanielClientId();