/**
 * TESTE ESPECÍFICO PARA RESOLVER ERRO 405 - VERSÃO CORRIGIDA
 */

async function testBaileysConnectionFixed() {
  console.log('🔍 [TESTE-405-FIX] Iniciando diagnóstico com logger corrigido...');
  
  try {
    const baileys = await import('@whiskeysockets/baileys');
    const { makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = baileys;
    const P = await import('pino');
    const fs = await import('fs');
    const path = await import('path');
    
    // Logger correto para Baileys
    const logger = P.default({ level: 'silent' });
    
    console.log('📦 [TESTE-405-FIX] Baileys carregado com logger correto');
    
    // Configuração simplificada que deve funcionar
    const workingConfig = {
      browser: ['WhatsApp', 'Desktop', '1.0.0'],
      connectTimeoutMs: 15000,
      defaultQueryTimeoutMs: 15000,
      keepAliveIntervalMs: 15000,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      fireInitQueries: false,
      logger: logger,
      printQRInTerminal: false,
      version: [2, 2419, 6]
    };
    
    console.log('🧪 [TESTE-405-FIX] Testando configuração simplificada...');
    
    // Criar diretório de teste
    const testDir = path.join(process.cwd(), 'test-sessions', 'fix_test');
    
    // Limpar diretório se existir
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    fs.mkdirSync(testDir, { recursive: true });
    
    // Carregar estado de autenticação
    const { state, saveCreds } = await useMultiFileAuthState(testDir);
    
    // Criar socket com configuração corrigida
    const socket = makeWASocket({
      ...workingConfig,
      auth: state
    });
    
    console.log('✅ [TESTE-405-FIX] Socket criado com sucesso');
    
    // Testar conexão por 15 segundos
    const testResult = await new Promise((resolve) => {
      let resolved = false;
      let connectionAttempts = 0;
      
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        connectionAttempts++;
        
        console.log(`📡 [TESTE-405-FIX] Update ${connectionAttempts}:`, {
          connection,
          hasQR: !!qr,
          qrLength: qr ? qr.length : 0,
          errorCode: lastDisconnect?.error?.output?.statusCode
        });
        
        if (connection === 'open' && !resolved) {
          resolved = true;
          console.log('✅ [TESTE-405-FIX] CONECTADO COM SUCESSO!');
          resolve({ success: true, reason: 'Connected' });
        }
        
        if (qr && !resolved) {
          resolved = true;
          console.log(`📱 [TESTE-405-FIX] QR Code gerado com ${qr.length} caracteres!`);
          resolve({ success: true, reason: 'QR Generated', qrLength: qr.length });
        }
        
        if (connection === 'close' && !resolved) {
          const errorCode = lastDisconnect?.error?.output?.statusCode;
          console.log(`❌ [TESTE-405-FIX] Conexão fechada com erro ${errorCode}`);
          
          if (errorCode === 405) {
            resolved = true;
            resolve({ success: false, reason: 'Error 405' });
          } else {
            // Outros erros podem ser tratados diferentemente
            resolved = true;
            resolve({ success: false, reason: `Error ${errorCode}` });
          }
        }
      });
      
      // Timeout de 15 segundos
      setTimeout(() => {
        if (!resolved) {
          console.log('⏰ [TESTE-405-FIX] Timeout após 15s');
          resolve({ success: false, reason: 'Timeout' });
        }
      }, 15000);
    });
    
    // Fechar socket
    socket.end();
    
    // Limpar diretório de teste
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    console.log('📊 [TESTE-405-FIX] Resultado:', testResult);
    
    return testResult;
    
  } catch (error) {
    console.log('❌ [TESTE-405-FIX] Erro geral:', error.message);
    return { success: false, reason: error.message };
  }
}

// Executar teste
testBaileysConnectionFixed().then(result => {
  console.log('\n🏁 [TESTE-405-FIX] Resultado final:', result);
  
  if (result.success) {
    console.log('🎉 [TESTE-405-FIX] CONFIGURAÇÃO FUNCIONOU! Aplicando correção...');
  } else {
    console.log('❌ [TESTE-405-FIX] Problema persistente:', result.reason);
  }
}).catch(error => {
  console.error('💥 [TESTE-405-FIX] Erro fatal:', error);
});