const { wppConnectClientModule } = require('./server/wppConnectClientModule.ts');

async function testarWppConnectDireto() {
  console.log('🔧 [TESTE DIRETO] Iniciando teste do WPPConnect...');
  
  try {
    const clientId = '1749849987543';
    console.log(`🔧 [TESTE DIRETO] Testando conexão para cliente ${clientId}`);
    
    const resultado = await wppConnectClientModule.connectClient(clientId);
    
    console.log('🔧 [TESTE DIRETO] Resultado da conexão:', resultado);
    
    if (resultado.success) {
      console.log('✅ [TESTE DIRETO] Conexão iniciada com sucesso');
      if (resultado.qrCode) {
        console.log('📱 [TESTE DIRETO] QR Code gerado com sucesso');
      }
    } else {
      console.log('❌ [TESTE DIRETO] Falha na conexão:', resultado.message);
    }
    
  } catch (error) {
    console.error('❌ [TESTE DIRETO] Erro no teste:', error);
    console.error('❌ [TESTE DIRETO] Stack:', error.stack);
  }
}

testarWppConnectDireto();