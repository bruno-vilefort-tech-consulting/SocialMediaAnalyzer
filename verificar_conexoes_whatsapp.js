import { FirebaseStorage } from './server/storage.ts';

async function verificarConexoesWhatsApp() {
  console.log('🔍 Verificando conexões WhatsApp ativas no Firebase...\n');
  
  const storage = new FirebaseStorage();
  
  try {
    // Verificar apiConfigs para conexões WhatsApp
    console.log('📋 Verificando apiConfigs...');
    const apiConfigsSnapshot = await storage.firestore.collection('apiConfigs').get();
    
    if (apiConfigsSnapshot.empty) {
      console.log('❌ Nenhuma apiConfig encontrada');
      return;
    }
    
    let conexoesAtivas = 0;
    let totalConfigs = 0;
    
    apiConfigsSnapshot.forEach(doc => {
      const config = doc.data();
      totalConfigs++;
      
      console.log(`\n📄 Config ID: ${doc.id}`);
      console.log(`   EntityType: ${config.entityType || 'não definido'}`);
      console.log(`   EntityId: ${config.entityId || 'não definido'}`);
      console.log(`   WhatsApp Conectado: ${config.whatsappQrConnected || false}`);
      console.log(`   Telefone: ${config.whatsappQrPhoneNumber || 'não definido'}`);
      console.log(`   Última Conexão: ${config.whatsappQrLastConnection ? new Date(config.whatsappQrLastConnection.toDate()).toLocaleString('pt-BR') : 'nunca'}`);
      
      if (config.whatsappQrConnected) {
        conexoesAtivas++;
        console.log(`   🟢 CONEXÃO ATIVA!`);
      } else {
        console.log(`   🔴 Desconectado`);
      }
    });
    
    console.log(`\n📊 RESUMO:`);
    console.log(`   Total de configurações: ${totalConfigs}`);
    console.log(`   Conexões ativas: ${conexoesAtivas}`);
    
    // Verificar se há dados específicos do cliente
    console.log('\n📋 Verificando configurações por cliente...');
    
    const clientConfigs = apiConfigsSnapshot.docs.filter(doc => {
      const config = doc.data();
      return config.entityType === 'client';
    });
    
    if (clientConfigs.length === 0) {
      console.log('❌ Nenhuma configuração de cliente encontrada');
    } else {
      console.log(`✅ Encontradas ${clientConfigs.length} configurações de cliente`);
      
      clientConfigs.forEach(doc => {
        const config = doc.data();
        console.log(`\n👤 Cliente ID: ${config.entityId}`);
        console.log(`   WhatsApp: ${config.whatsappQrConnected ? '🟢 CONECTADO' : '🔴 Desconectado'}`);
        console.log(`   Telefone: ${config.whatsappQrPhoneNumber || 'não definido'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar conexões:', error);
  }
}

verificarConexoesWhatsApp().then(() => {
  console.log('\n✅ Verificação concluída');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro na verificação:', error);
  process.exit(1);
});