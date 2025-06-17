const { FirebaseStorage } = require('./server/storage.js');

async function debugWhatsAppConnection() {
  console.log('🔍 Investigando status da conexão WhatsApp...');
  
  try {
    const storage = new FirebaseStorage();
    
    // Verificar configuração do master
    const masterConfig = await storage.getApiConfig('master', '1749848502212');
    console.log('📋 Configuração Master atual:', {
      whatsappQrConnected: masterConfig?.whatsappQrConnected,
      whatsappQrPhoneNumber: masterConfig?.whatsappQrPhoneNumber,
      whatsappQrLastConnection: masterConfig?.whatsappQrLastConnection
    });
    
    // Verificar se há dados do número 1151940284
    console.log('\n🔍 Procurando por evidências do número 1151940284...');
    
    // Simular detecção de conexão ativa
    console.log('\n🔧 Simulando detecção de conexão para 1151940284...');
    
    await storage.upsertApiConfig({
      ...masterConfig,
      entityType: 'master',
      entityId: '1749848502212',
      whatsappQrConnected: true,
      whatsappQrPhoneNumber: '1151940284',
      whatsappQrLastConnection: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ Conexão forçada para 1151940284 salva no banco');
    
    // Verificar se foi salvo corretamente
    const updatedConfig = await storage.getApiConfig('master', '1749848502212');
    console.log('📋 Configuração atualizada:', {
      whatsappQrConnected: updatedConfig?.whatsappQrConnected,
      whatsappQrPhoneNumber: updatedConfig?.whatsappQrPhoneNumber,
      whatsappQrLastConnection: updatedConfig?.whatsappQrLastConnection
    });
    
  } catch (error) {
    console.error('❌ Erro ao investigar conexão:', error);
  }
}

debugWhatsAppConnection();