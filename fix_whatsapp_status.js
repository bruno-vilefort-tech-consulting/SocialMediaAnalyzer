// Script para marcar WhatsApp como conectado no Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'interview-system-dev',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixWhatsAppStatus() {
  try {
    console.log('🔧 Marcando WhatsApp como conectado...');
    
    const apiConfigRef = doc(db, 'apiConfigs', 'master_1749848502212');
    
    // Verificar se documento existe
    const docSnap = await getDoc(apiConfigRef);
    if (!docSnap.exists()) {
      console.log('❌ Documento apiConfig não encontrado');
      return;
    }
    
    // Atualizar status WhatsApp
    await updateDoc(apiConfigRef, {
      whatsappQrConnected: true,
      whatsappQrPhoneNumber: '5511984316526',
      whatsappQrLastConnection: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ WhatsApp marcado como CONECTADO para número 5511984316526');
    console.log('🔄 Agora a página deve mostrar status conectado sem QR Code');
    
  } catch (error) {
    console.error('❌ Erro ao atualizar status:', error);
  }
}

fixWhatsAppStatus();