import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function verificarConexoesWhatsApp() {
  console.log('🔍 Verificando conexões WhatsApp no Firebase...\n');
  
  try {
    // Buscar todas as configurações API
    const apiConfigsRef = collection(db, 'apiConfigs');
    const snapshot = await getDocs(apiConfigsRef);
    
    if (snapshot.empty) {
      console.log('❌ Nenhuma configuração encontrada no Firebase');
      return;
    }
    
    let conexoesAtivas = 0;
    let totalConfigs = 0;
    
    console.log('📋 Configurações encontradas:\n');
    
    snapshot.forEach(doc => {
      const config = doc.data();
      totalConfigs++;
      
      console.log(`📄 Config ID: ${doc.id}`);
      console.log(`   EntityType: ${config.entityType || 'não definido'}`);
      console.log(`   EntityId: ${config.entityId || 'não definido'}`);
      console.log(`   WhatsApp Conectado: ${config.whatsappQrConnected || false}`);
      console.log(`   Telefone: ${config.whatsappQrPhoneNumber || 'não definido'}`);
      
      if (config.whatsappQrLastConnection) {
        const lastConnection = config.whatsappQrLastConnection.toDate ? 
          config.whatsappQrLastConnection.toDate() : 
          new Date(config.whatsappQrLastConnection);
        console.log(`   Última Conexão: ${lastConnection.toLocaleString('pt-BR')}`);
      } else {
        console.log(`   Última Conexão: nunca`);
      }
      
      if (config.whatsappQrConnected) {
        conexoesAtivas++;
        console.log(`   🟢 CONEXÃO ATIVA!`);
      } else {
        console.log(`   🔴 Desconectado`);
      }
      console.log('');
    });
    
    console.log(`📊 RESUMO:`);
    console.log(`   Total de configurações: ${totalConfigs}`);
    console.log(`   Conexões WhatsApp ativas: ${conexoesAtivas}`);
    
    // Filtrar apenas configurações de cliente
    const clientConfigs = [];
    snapshot.forEach(doc => {
      const config = doc.data();
      if (config.entityType === 'client') {
        clientConfigs.push({ id: doc.id, ...config });
      }
    });
    
    if (clientConfigs.length > 0) {
      console.log('\n👥 CLIENTES COM WHATSAPP:');
      clientConfigs.forEach(config => {
        console.log(`   Cliente ID: ${config.entityId}`);
        console.log(`   Status: ${config.whatsappQrConnected ? '🟢 CONECTADO' : '🔴 Desconectado'}`);
        console.log(`   Telefone: ${config.whatsappQrPhoneNumber || 'não definido'}`);
        console.log('');
      });
    } else {
      console.log('\n❌ Nenhuma configuração de cliente encontrada');
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar conexões:', error);
  }
}

verificarConexoesWhatsApp().then(() => {
  console.log('✅ Verificação concluída');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro na verificação:', error);
  process.exit(1);
});