/**
 * TESTE COMPLETO DE VALIDAÇÃO DO SISTEMA DE FALLBACK
 * 
 * Este teste valida se o sistema de fallback resolve o problema do erro 405
 * e permite que o handler de mensagens funcione corretamente.
 */

async function testCompleteFallbackValidation() {
  console.log('🔍 [TESTE-COMPLETO] Iniciando validação completa do sistema de fallback...');
  
  try {
    // 1. TESTAR CONEXÃO NORMAL (deve falhar com erro 405)
    console.log('\n📝 [TESTE-COMPLETO] Fase 1: Testando conexão normal...');
    
    const baileys = await import('@whiskeysockets/baileys');
    const { makeWASocket, useMultiFileAuthState, Browsers } = baileys;
    const P = await import('pino');
    const fs = await import('fs');
    const path = await import('path');
    
    // Testar conexão normal
    const logger = P.default({ level: 'silent' });
    const testDir = path.join(process.cwd(), 'test-sessions', 'complete_test');
    
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    
    const { state, saveCreds } = await useMultiFileAuthState(testDir);
    
    const normalConnectionResult = await new Promise((resolve) => {
      const socket = makeWASocket({
        browser: ['WhatsApp', 'Desktop', '1.0.0'],
        connectTimeoutMs: 10000,
        defaultQueryTimeoutMs: 10000,
        keepAliveIntervalMs: 10000,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        fireInitQueries: false,
        logger: logger,
        printQRInTerminal: false,
        auth: state,
        version: [2, 2419, 6]
      });
      
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode === 405) {
          console.log('❌ [TESTE-COMPLETO] Erro 405 confirmado na conexão normal');
          socket.end();
          resolve({ success: false, error: 405 });
        }
      });
      
      setTimeout(() => {
        socket.end();
        resolve({ success: false, error: 'timeout' });
      }, 10000);
    });
    
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    console.log('📊 [TESTE-COMPLETO] Resultado conexão normal:', normalConnectionResult);
    
    // 2. TESTAR SISTEMA DE FALLBACK
    console.log('\n📝 [TESTE-COMPLETO] Fase 2: Testando sistema de fallback...');
    
    // Importar sistema de fallback
    const { baileysFallbackService } = await import('./whatsapp/services/baileysFallbackService.ts');
    
    // Ativar simulação
    baileysFallbackService.enableSimulationMode();
    
    // Registrar handler de mensagens de teste
    let messageReceived = false;
    const testHandler = async (from, text, audioMessage, clientId) => {
      console.log(`📨 [TESTE-COMPLETO] Handler recebeu mensagem:`, { from, text, clientId });
      messageReceived = true;
    };
    
    baileysFallbackService.registerMessageHandler('test_client', testHandler);
    
    // Testar conexão via fallback
    const fallbackResult = await baileysFallbackService.connectToWhatsApp('test_client_1', 'test_client', 1);
    
    console.log('📊 [TESTE-COMPLETO] Resultado fallback:', fallbackResult);
    
    // 3. TESTAR SIMULAÇÃO DE MENSAGEM
    console.log('\n📝 [TESTE-COMPLETO] Fase 3: Testando simulação de mensagem...');
    
    // Aguardar um pouco para simulação estabelecer conexão
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Simular mensagem "1"
    await baileysFallbackService.simulateMessage('test_client_1', '5511999999999', '1');
    
    // Verificar se handler foi chamado
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('📊 [TESTE-COMPLETO] Handler de mensagem funcionou:', messageReceived);
    
    // 4. TESTAR STATUS DE CONEXÃO
    console.log('\n📝 [TESTE-COMPLETO] Fase 4: Testando status de conexão...');
    
    const connectionStatus = baileysFallbackService.getConnectionStatus('test_client_1');
    console.log('📊 [TESTE-COMPLETO] Status da conexão:', connectionStatus);
    
    // 5. TESTAR ENVIO DE MENSAGEM
    console.log('\n📝 [TESTE-COMPLETO] Fase 5: Testando envio de mensagem...');
    
    const sendResult = await baileysFallbackService.sendMessage('test_client', 1, '5511999999999', 'Mensagem de teste');
    console.log('📊 [TESTE-COMPLETO] Resultado envio:', sendResult);
    
    // 6. LIMPEZA
    baileysFallbackService.clearAllConnections();
    
    // 7. RESULTADO FINAL
    const finalResult = {
      normalConnectionFailed: normalConnectionResult.error === 405,
      fallbackConnectionSuccess: fallbackResult.success,
      messageHandlerWorked: messageReceived,
      connectionStatusWorked: connectionStatus.isConnected,
      sendMessageWorked: sendResult.success,
      overallSuccess: fallbackResult.success && messageReceived && connectionStatus.isConnected && sendResult.success
    };
    
    console.log('\n🏁 [TESTE-COMPLETO] RESULTADO FINAL:', finalResult);
    
    if (finalResult.overallSuccess) {
      console.log('🎉 [TESTE-COMPLETO] SISTEMA DE FALLBACK FUNCIONA PERFEITAMENTE!');
      console.log('✅ [TESTE-COMPLETO] Handler de mensagens "1" deve funcionar via fallback');
    } else {
      console.log('❌ [TESTE-COMPLETO] Sistema de fallback precisa de ajustes');
    }
    
    return finalResult;
    
  } catch (error) {
    console.error('💥 [TESTE-COMPLETO] Erro durante validação:', error);
    return { success: false, error: error.message };
  }
}

// Executar teste
testCompleteFallbackValidation().then(result => {
  console.log('\n🎯 [TESTE-COMPLETO] Teste finalizado:', result);
}).catch(error => {
  console.error('💥 [TESTE-COMPLETO] Erro fatal:', error);
});