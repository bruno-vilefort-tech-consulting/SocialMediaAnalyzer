/**
 * Script para testar o status do sistema WhatsApp e simular uma entrevista interativa
 */

async function testWhatsAppStatus() {
  console.log('🔍 [STATUS] Testando sistema WhatsApp e TTS...\n');
  
  try {
    // 1. Verificar conexões WhatsApp do cliente
    console.log('1️⃣ Verificando conexões WhatsApp...');
    const { simpleMultiBaileyService } = await import('./whatsapp/services/simpleMultiBailey.ts');
    const clientId = '1749849987543';
    const clientConnections = await simpleMultiBaileyService.getClientConnections(clientId);
    
    console.log('📊 [STATUS] Resultado das conexões:', {
      hasConnections: !!clientConnections,
      activeConnections: clientConnections?.activeConnections || 0,
      totalConnections: clientConnections?.connections?.length || 0
    });
    
    if (!clientConnections || clientConnections.activeConnections === 0) {
      console.log('❌ [STATUS] Nenhuma conexão WhatsApp ativa');
      console.log('💡 [STATUS] Conecte pelo menos uma instância na página Configurações antes de testar');
      return;
    }
    
    console.log('✅ [STATUS] Conexões WhatsApp disponíveis!\n');
    
    // 2. Testar sistema interativo de entrevistas
    console.log('2️⃣ Simulando início de entrevista interativa...');
    const { interactiveInterviewService } = await import('./server/interactiveInterviewService.js');
    
    const testPhone = '5511984316526';
    const testMessage = '1'; // Comando para iniciar entrevista
    
    console.log(`📱 [STATUS] Simulando mensagem "${testMessage}" do número ${testPhone}`);
    
    // Simular handleMessage
    await interactiveInterviewService.handleMessage(testPhone + '@s.whatsapp.net', testMessage, null, clientId);
    
    console.log('✅ [STATUS] Simulação de entrevista executada!');
    console.log('📋 [STATUS] Verifique os logs acima para detalhes do processo TTS');
    
  } catch (error) {
    console.error('❌ [STATUS] Erro no teste:', error);
  }
}

// Executar teste
testWhatsAppStatus().catch(console.error);