
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

async function testWhatsAppConnection() {
  console.log('🧪 Testando conexão WhatsApp direta...\n');

  try {
    console.log('📱 Iniciando autenticação...');
    const { state, saveCreds } = await useMultiFileAuthState('./whatsapp-auth-test');

    console.log('🔗 Criando socket WhatsApp...');
    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      connectTimeoutMs: 30000,
      defaultQueryTimeoutMs: 30000,
      keepAliveIntervalMs: 10000,
      retryRequestDelayMs: 2000,
      maxMsgRetryCount: 5,
      qrTimeout: 60000,
      browser: ['Replit Test Bot', 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      shouldSyncHistoryMessage: () => false,
      emitOwnEvents: false,
      getMessage: async () => ({ conversation: 'placeholder' })
    });

    let isConnected = false;
    let phoneNumber = null;

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
      
      console.log('\n📱 [CONNECTION UPDATE]:', { 
        connection, 
        hasQR: !!qr,
        hasDisconnect: !!lastDisconnect,
        receivedPendingNotifications 
      });

      if (qr) {
        console.log('\n🔄 QR Code recebido!');
        console.log('📱 Escaneie o QR Code no terminal com seu WhatsApp');
        
        try {
          const qrDataUrl = await qrcode.toDataURL(qr);
          console.log('✅ QR Code data URL gerado:', qrDataUrl.substring(0, 50) + '...');
        } catch (qrError) {
          console.error('❌ Erro ao gerar QR data URL:', qrError.message);
        }
      }

      if (connection === 'connecting') {
        console.log('🔗 Conectando ao WhatsApp...');
      }

      if (connection === 'open') {
        console.log('✅ CONECTADO AO WHATSAPP!');
        isConnected = true;
        phoneNumber = socket.user?.id?.split(':')[0] || 'Número não detectado';
        console.log(`📞 Número conectado: ${phoneNumber}`);
        console.log('🎉 Teste de conexão bem-sucedido!');
        
        // Testar envio de mensagem para o próprio número
        try {
          console.log('\n📤 Testando envio de mensagem...');
          await socket.sendMessage(`${phoneNumber}@s.whatsapp.net`, { 
            text: '🧪 Teste de conexão WhatsApp via Replit - Sistema funcionando!' 
          });
          console.log('✅ Mensagem de teste enviada com sucesso!');
        } catch (msgError) {
          console.error('❌ Erro ao enviar mensagem de teste:', msgError.message);
        }
        
        // Desconectar após 10 segundos
        setTimeout(() => {
          console.log('\n🔌 Desconectando após teste...');
          socket.logout();
        }, 10000);
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        const errorCode = lastDisconnect?.error?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || 'Desconhecido';
        
        console.log(`\n🔌 Conexão fechada: ${errorMessage} (código: ${errorCode})`);
        console.log(`🔄 Deve reconectar: ${shouldReconnect}`);
        
        if (isConnected) {
          console.log('✅ Teste concluído - conexão funcionou!');
        } else {
          console.log('❌ Teste falhou - conexão não estabelecida');
        }
        
        process.exit(isConnected ? 0 : 1);
      }
    });

    socket.ev.on('creds.update', saveCreds);

    // Timeout para o teste
    setTimeout(() => {
      if (!isConnected) {
        console.log('\n⏰ Timeout do teste - conexão não estabelecida em 2 minutos');
        console.log('❌ Verifique se você escaneou o QR Code corretamente');
        process.exit(1);
      }
    }, 120000); // 2 minutos

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    process.exit(1);
  }
}

testWhatsAppConnection();
