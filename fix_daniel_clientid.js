import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'fake-key',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'fake-domain',
  projectId: process.env.FIREBASE_PROJECT_ID || 'fake-project-id',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'fake-bucket',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.FIREBASE_APP_ID || 'fake-app-id'
};

const app = initializeApp(firebaseConfig);
const firebaseDb = getFirestore(app);

async function fixDanielClientId() {
  try {
    console.log('🔧 Corrigindo clientId do usuário Daniel Braga...');
    
    const danielUserId = '1750131049173';
    const correctClientId = 1749849987543; // Grupo Maximuns
    
    // Buscar dados atuais
    const userDoc = await getDoc(doc(firebaseDb, 'users', danielUserId));
    if (!userDoc.exists()) {
      console.log('❌ Usuário Daniel não encontrado');
      return;
    }
    
    const userData = userDoc.data();
    console.log('📋 Dados atuais do Daniel:', {
      id: danielUserId,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      clientId: userData.clientId,
      clientIdType: typeof userData.clientId
    });
    
    // Atualizar clientId
    await updateDoc(doc(firebaseDb, 'users', danielUserId), {
      clientId: correctClientId,
      updatedAt: new Date()
    });
    
    console.log('✅ ClientId do Daniel atualizado para:', correctClientId);
    
    // Verificar se foi salvo corretamente
    const updatedDoc = await getDoc(doc(firebaseDb, 'users', danielUserId));
    const updatedData = updatedDoc.data();
    console.log('🔍 Dados após atualização:', {
      clientId: updatedData.clientId,
      clientIdType: typeof updatedData.clientId
    });
    
  } catch (error) {
    console.error('❌ Erro ao corrigir clientId:', error);
  }
}

fixDanielClientId();