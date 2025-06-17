import { FirebaseStorage } from './server/storage.ts';

async function desconectarWhatsApp() {
  console.log('🔌 Desconectando WhatsApp e limpando dados...');
  
  const storage = new FirebaseStorage();
  
  try {
    // Buscar todas as configurações com WhatsApp conectado
    const configs = await storage.getAllApiConfigs();
    
    for (const config of configs) {
      if (config.whatsappQrConnected) {
        console.log(`📱 Desconectando WhatsApp da config: ${config.entityType}/${config.entityId}`);
        
        // Atualizar configuração para desconectado
        await storage.updateApiConfig(config.entityType, config.entityId, {
          whatsappQrConnected: false,
          whatsappQrPhoneNumber: null,
          whatsappQrLastConnection: null
        });
        
        console.log(`✅ WhatsApp desconectado para ${config.entityType}/${config.entityId}`);
      }
    }
    
    console.log('🧹 Limpando sessões do diretório whatsapp-sessions...');
    
  } catch (error) {
    console.error('❌ Erro ao desconectar WhatsApp:', error);
  }
}

desconectarWhatsApp().then(() => {
  console.log('✅ Desconexão concluída');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro na desconexão:', error);
  process.exit(1);
});