import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { rmSync } from 'fs';
import { existsSync } from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyBOBJzHqVZLjjZuDYKNgBOKPnYWhvMC9oU",
  authDomain: "grupo-maximus-8a4c5.firebaseapp.com",
  projectId: "grupo-maximus-8a4c5",
  storageBucket: "grupo-maximus-8a4c5.firebasestorage.app",
  messagingSenderId: "851847516926",
  appId: "1:851847516926:web:fe30eb7ae5e0e61b0f3456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function limparWhatsAppCompleto() {
  console.log('🧹 Limpando todas as conexões WhatsApp...');
  
  try {
    // 1. Desconectar todas as configurações WhatsApp no Firebase
    const apiConfigsRef = collection(db, 'apiConfigs');
    const snapshot = await getDocs(apiConfigsRef);
    
    let desconectados = 0;
    
    for (const docSnap of snapshot.docs) {
      const config = docSnap.data();
      
      if (config.whatsappQrConnected) {
        console.log(`📱 Desconectando: ${config.entityType}/${config.entityId}`);
        
        await updateDoc(doc(db, 'apiConfigs', docSnap.id), {
          whatsappQrConnected: false,
          whatsappQrPhoneNumber: null,
          whatsappQrLastConnection: null
        });
        
        desconectados++;
      }
    }
    
    console.log(`✅ ${desconectados} conexões desconectadas no Firebase`);
    
    // 2. Limpar diretório de sessões WhatsApp
    const sessionsPath = './whatsapp-sessions';
    if (existsSync(sessionsPath)) {
      rmSync(sessionsPath, { recursive: true, force: true });
      console.log('🗂️ Diretório whatsapp-sessions removido');
    }
    
    console.log('✅ Limpeza completa do WhatsApp concluída');
    
  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
  }
}

limparWhatsAppCompleto().then(() => {
  console.log('🎯 Sistema limpo - pronto para testes de conexão por cliente');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro:', error);
  process.exit(1);
});