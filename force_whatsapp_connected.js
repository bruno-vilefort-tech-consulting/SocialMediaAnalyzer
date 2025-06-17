// Script para forçar o status de WhatsApp como conectado
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'interview-system-dev',
  // Configuração mínima para funcionar
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function forceWhatsAppConnected() {
  try {
    console.log('🔧 Forçando status WhatsApp como conectado...');

    // Configurar API Config do master como conectado
    const apiConfigRef = doc(db, 'apiConfigs', 'master_1749848502212');
    
    await updateDoc(apiConfigRef, {
      whatsappQrConnected: true,
      whatsappQrPhoneNumber: '5511984316526',
      whatsappQrLastConnection: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ WhatsApp marcado como conectado no banco de dados');
    console.log('📱 Número: 5511984316526');
    console.log('⏰ Última conexão: Agora');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao forçar conexão WhatsApp:', error);
    process.exit(1);
  }
}

forceWhatsAppConnected();