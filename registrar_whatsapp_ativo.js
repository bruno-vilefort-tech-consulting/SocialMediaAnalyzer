import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBexBRhj6Ag1z7Gxs2WfxOPnWz-kJ7rVqc",
  authDomain: "ai-entrevistadora.firebaseapp.com",
  projectId: "ai-entrevistadora",
  storageBucket: "ai-entrevistadora.firebasestorage.app",
  messagingSenderId: "308767559279",
  appId: "1:308767559279:web:2134e6b97efc6b5bf0eeff",
  measurementId: "G-RHCDL7V0M9"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function registrarWhatsAppAtivo() {
  try {
    console.log('🔄 Registrando conexão WhatsApp ativa...');
    
    // Registrar configuração API com WhatsApp conectado
    const apiConfigRef = doc(db, 'apiConfigs', 'master_1749848502212');
    await setDoc(apiConfigRef, {
      id: 1,
      entityType: 'master',
      entityId: '1749848502212',
      openaiVoice: 'nova',
      whatsappQrConnected: true,
      whatsappQrPhoneNumber: '1151940284',
      whatsappQrLastConnection: new Date('2025-06-17T16:10:00.000Z'),
      firebaseProjectId: null,
      firebaseServiceAccount: null,
      updatedAt: new Date()
    }, { merge: true });
    
    console.log('✅ Configuração API atualizada com WhatsApp conectado');
    console.log('📱 Número registrado: 1151940284');
    console.log('⏰ Última conexão: 2025-06-17T16:10:00.000Z');
    
    // Verificar se foi salvo corretamente
    const docSnap = await apiConfigRef.get();
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('📋 Dados salvos:', {
        whatsappQrConnected: data.whatsappQrConnected,
        whatsappQrPhoneNumber: data.whatsappQrPhoneNumber,
        whatsappQrLastConnection: data.whatsappQrLastConnection
      });
    }
    
    console.log('🎉 Conexão WhatsApp registrada com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao registrar WhatsApp:', error);
  }
}

registrarWhatsAppAtivo();