/**
 * TESTE ESPECÍFICO PARA RESOLVER ERRO 405 "Connection Failure"
 * 
 * Este script testa diferentes configurações do Baileys para identificar
 * qual configuração funciona no ambiente Replit atual.
 */

async function testBaileysConnection() {
  console.log('🔍 [TESTE-405] Iniciando diagnóstico do erro 405...');
  
  try {
    // Importar Baileys dinamicamente
    const baileys = await import('@whiskeysockets/baileys');
    const { makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = baileys;
    
    console.log('📦 [TESTE-405] Baileys carregado:', {
      version: baileys.version || 'N/A',
      hasMakeWASocket: typeof makeWASocket === 'function',
      hasBrowsers: typeof Browsers === 'object'
    });
    
    const fs = await import('fs');
    const path = await import('path');
    
    // Configurações de teste
    const testConfigs = [
      {
        name: 'Configuração 1: Padrão Replit',
        config: {
          browser: Browsers.ubuntu('ReplicWhatsApp'),
          connectTimeoutMs: 30000,
          defaultQueryTimeoutMs: 30000,
          keepAliveIntervalMs: 30000,
          syncFullHistory: false,
          markOnlineOnConnect: false,
          fireInitQueries: false,
          logger: { level: 'silent' },
          printQRInTerminal: false
        }
      },
      {
        name: 'Configuração 2: Minimal',
        config: {
          browser: ['WhatsApp', 'Desktop', '1.0.0'],
          connectTimeoutMs: 20000,
          defaultQueryTimeoutMs: 20000,
          keepAliveIntervalMs: 20000,
          syncFullHistory: false,
          markOnlineOnConnect: false,
          fireInitQueries: false,
          logger: { level: 'silent' },
          printQRInTerminal: false
        }
      },
      {
        name: 'Configuração 3: Legacy',
        config: {
          browser: ['WhatsApp', 'Chrome', '4.0.0'],
          connectTimeoutMs: 15000,
          defaultQueryTimeoutMs: 15000,
          keepAliveIntervalMs: 15000,
          syncFullHistory: false,
          markOnlineOnConnect: false,
          fireInitQueries: false,
          logger: { level: 'silent' },
          printQRInTerminal: false
        }
      }
    ];
    
    for (let i = 0; i < testConfigs.length; i++) {
      const { name, config } = testConfigs[i];
      
      console.log(`\n🧪 [TESTE-405] Testando ${name}...`);
      
      try {
        // Criar diretório de teste
        const testDir = path.join(process.cwd(), 'test-sessions', `test_${i + 1}`);
        
        // Limpar diretório se existir
        if (fs.existsSync(testDir)) {
          fs.rmSync(testDir, { recursive: true, force: true });
        }
        
        fs.mkdirSync(testDir, { recursive: true });
        
        // Carregar estado de autenticação
        const { state, saveCreds } = await useMultiFileAuthState(testDir);
        
        // Criar socket com configuração de teste
        const socket = makeWASocket({
          ...config,
          auth: state,
          version: [2, 2419, 6]
        });
        
        console.log(`✅ [TESTE-405] Socket criado para ${name}`);
        
        // Testar conexão por 10 segundos
        const testResult = await new Promise((resolve) => {
          let resolved = false;
          let connectionAttempts = 0;
          
          socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            connectionAttempts++;
            
            console.log(`📡 [TESTE-405] ${name} - Update ${connectionAttempts}:`, {
              connection,
              hasQR: !!qr,
              errorCode: lastDisconnect?.error?.output?.statusCode
            });
            
            if (connection === 'open' && !resolved) {
              resolved = true;
              console.log(`✅ [TESTE-405] ${name} - CONECTADO!`);
              resolve({ success: true, reason: 'Connected' });
            }
            
            if (qr && !resolved) {
              resolved = true;
              console.log(`📱 [TESTE-405] ${name} - QR Code gerado!`);
              resolve({ success: true, reason: 'QR Generated' });
            }
            
            if (connection === 'close' && !resolved) {
              const errorCode = lastDisconnect?.error?.output?.statusCode;
              console.log(`❌ [TESTE-405] ${name} - Conexão fechada com erro ${errorCode}`);
              
              if (errorCode === 405) {
                resolved = true;
                resolve({ success: false, reason: 'Error 405', config: name });
              }
            }
          });
          
          // Timeout de 10 segundos
          setTimeout(() => {
            if (!resolved) {
              console.log(`⏰ [TESTE-405] ${name} - Timeout após 10s`);
              resolve({ success: false, reason: 'Timeout', config: name });
            }
          }, 10000);
        });
        
        // Fechar socket
        socket.end();
        
        // Limpar diretório de teste
        if (fs.existsSync(testDir)) {
          fs.rmSync(testDir, { recursive: true, force: true });
        }
        
        console.log(`📊 [TESTE-405] Resultado ${name}:`, testResult);
        
        // Se esta configuração funcionou, usar ela
        if (testResult.success) {
          console.log(`\n🎉 [TESTE-405] CONFIGURAÇÃO FUNCIONOU: ${name}`);
          console.log('🔧 [TESTE-405] Configuração vencedora:', JSON.stringify(config, null, 2));
          
          // Salvar configuração que funcionou
          return {
            success: true,
            workingConfig: config,
            configName: name
          };
        }
        
      } catch (testError) {
        console.log(`❌ [TESTE-405] Erro ao testar ${name}:`, testError.message);
      }
    }
    
    console.log('\n❌ [TESTE-405] Nenhuma configuração funcionou');
    return { success: false, reason: 'All configurations failed' };
    
  } catch (error) {
    console.log('❌ [TESTE-405] Erro geral:', error.message);
    return { success: false, reason: error.message };
  }
}

// Executar teste
testBaileysConnection().then(result => {
  console.log('\n🏁 [TESTE-405] Resultado final:', result);
}).catch(error => {
  console.error('💥 [TESTE-405] Erro fatal:', error);
});