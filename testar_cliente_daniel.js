// Teste completo do sistema WhatsApp para usuário cliente Daniel
import fetch from 'node-fetch';

async function testarClienteDaniel() {
  console.log('🧪 Testando sistema WhatsApp para cliente Daniel...\n');
  
  try {
    // 1. Login como usuário cliente Daniel
    console.log('🔑 Fazendo login como cliente Daniel...');
    const loginData = {
      email: 'danielmoreirabraga@gmail.com',
      password: 'daniel580190'
    };
    
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginData)
    });
    
    const loginResult = await loginResponse.json();
    
    if (!loginResponse.ok || !loginResult.token) {
      console.log('❌ Falha no login:', loginResult.error || 'Token não recebido');
      return;
    }
    
    console.log('✅ Login realizado com sucesso');
    console.log(`   Token recebido: ${loginResult.token.substring(0, 20)}...`);
    console.log(`   Usuário: ${loginResult.user.name}`);
    console.log(`   Role: ${loginResult.user.role}`);
    console.log(`   Cliente ID: ${loginResult.user.clientId}`);
    
    const authHeader = { 'Authorization': `Bearer ${loginResult.token}` };
    const clientId = loginResult.user.clientId;
    
    // 2. Verificar configurações API do cliente
    console.log('\n📡 Verificando configurações API...');
    const configResponse = await fetch(`http://localhost:5000/api/api-config/client/${clientId}`, {
      headers: authHeader
    });
    
    if (configResponse.ok) {
      const config = await configResponse.json();
      console.log('✅ Configuração encontrada:');
      console.log(`   WhatsApp Conectado: ${config.whatsappQrConnected || false}`);
      console.log(`   Telefone: ${config.whatsappQrPhoneNumber || 'não definido'}`);
      console.log(`   Voz TTS: ${config.openaiVoice || 'não definido'}`);
    } else {
      console.log('❌ Erro ao buscar configuração:', configResponse.status);
    }
    
    // 3. Buscar conexões WhatsApp do cliente
    console.log('\n📱 Verificando conexões WhatsApp...');
    const connectionsResponse = await fetch(`http://localhost:5000/api/whatsapp-connections/client/${clientId}`, {
      headers: authHeader
    });
    
    if (connectionsResponse.ok) {
      const connections = await connectionsResponse.json();
      console.log(`✅ Conexões encontradas: ${connections.length}`);
      
      connections.forEach((conn, index) => {
        console.log(`   Conexão ${index + 1}:`);
        console.log(`     ID: ${conn.id}`);
        console.log(`     Nome: ${conn.name}`);
        console.log(`     Status: ${conn.status}`);
        console.log(`     Telefone: ${conn.phoneNumber || 'não conectado'}`);
      });
    } else {
      console.log('❌ Erro ao buscar conexões:', connectionsResponse.status);
    }
    
    // 4. Criar nova conexão WhatsApp
    console.log('\n🔗 Testando criação de nova conexão WhatsApp...');
    const createConnectionData = {
      clientId: parseInt(clientId),
      name: `Teste WhatsApp Cliente ${new Date().getTime()}`
    };
    
    const createResponse = await fetch('http://localhost:5000/api/whatsapp-connections', {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createConnectionData)
    });
    
    if (createResponse.ok) {
      const newConnection = await createResponse.json();
      console.log('✅ Conexão criada com sucesso:');
      console.log(`   ID: ${newConnection.id}`);
      console.log(`   Nome: ${newConnection.name}`);
      console.log(`   Status: ${newConnection.status}`);
      
      // 5. Testar QR Code da nova conexão
      console.log('\n📲 Verificando QR Code...');
      const qrResponse = await fetch(`http://localhost:5000/api/whatsapp-connections/${newConnection.id}/qr`, {
        headers: authHeader
      });
      
      if (qrResponse.ok) {
        const qrData = await qrResponse.json();
        console.log('✅ QR Code disponível:');
        console.log(`   QR Code: ${qrData.qrCode ? 'Gerado' : 'Aguardando...'}`);
        console.log(`   Status: ${qrData.status}`);
      } else {
        console.log('❌ Erro ao buscar QR Code:', qrResponse.status);
      }
      
    } else {
      const error = await createResponse.text();
      console.log('❌ Erro ao criar conexão:', createResponse.status, error);
    }
    
    // 6. Testar endpoint de teste de mensagem (se houver conexão)
    console.log('\n💬 Testando sistema de teste de mensagem...');
    const testMessageData = {
      phoneNumber: '5511984316526',
      message: 'Teste de mensagem do sistema cliente'
    };
    
    const testResponse = await fetch('http://localhost:5000/api/whatsapp-test', {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMessageData)
    });
    
    if (testResponse.ok) {
      const testResult = await testResponse.json();
      console.log('✅ Teste de mensagem:');
      console.log(`   Sucesso: ${testResult.success}`);
      console.log(`   Mensagem: ${testResult.message}`);
    } else {
      console.log('❌ Erro no teste de mensagem:', testResponse.status);
    }
    
    console.log('\n🎯 Teste completo do sistema cliente finalizado');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testarClienteDaniel().then(() => {
  console.log('✅ Verificação do sistema cliente concluída');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro:', error);
  process.exit(1);
});