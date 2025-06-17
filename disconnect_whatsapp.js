// Script para desconectar WhatsApp e limpar sessão
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'interview-system-dev',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function disconnectWhatsApp() {
  try {
    console.log('🔌 Desconectando WhatsApp...');
    
    const apiConfigRef = doc(db, 'apiConfigs', 'master_1749848502212');
    
    // Verificar se documento existe
    const docSnap = await getDoc(apiConfigRef);
    if (!docSnap.exists()) {
      console.log('❌ Documento apiConfig não encontrado');
      return;
    }
    
    // Marcar como desconectado
    await updateDoc(apiConfigRef, {
      whatsappQrConnected: false,
      whatsappQrPhoneNumber: null,
      whatsappQrLastConnection: null,
      updatedAt: new Date()
    });
    
    console.log('✅ WhatsApp desconectado com sucesso');
    console.log('🆕 Agora você pode fazer uma nova conexão');
    
  } catch (error) {
    console.error('❌ Erro ao desconectar:', error);
  }
}

disconnectWhatsApp();