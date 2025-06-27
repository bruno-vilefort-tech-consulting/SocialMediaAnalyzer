/**
 * Script para restaurar conexão WhatsApp perdida
 * Utiliza os arquivos de sessão existentes para reconectar
 */

import wppConnect from '@wppconnect-team/wppconnect';
import path from 'path';

async function restoreConnection() {
  const clientId = '1749849987543';
  
  try {
    console.log(`🔄 Restaurando conexão WhatsApp para cliente ${clientId}...`);
    
    const client = await wppConnect.create({
      session: `client_${clientId}`,
      folderNameToken: 'tokens',
      headless: true,
      devtools: false,
      useChrome: false,
      debug: false,
      logQR: false,
      browserWS: '',
      disableWelcome: true,
      updatesLog: false,
      autoClose: 60000,
      createPathFileToken: true,
    });

    console.log(`✅ Cliente WppConnect criado, verificando conexão...`);
    
    // Aguardar conexão estabelecer
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verificar se está conectado
    const hostDevice = await client.getHostDevice();
    
    if (hostDevice && hostDevice.wid && hostDevice.wid.user) {
      console.log(`🎉 Conexão restaurada com sucesso!`);
      console.log(`📱 Número conectado: +${hostDevice.wid.user}`);
      
      // Testar envio de mensagem
      console.log(`📤 Testando envio de mensagem...`);
      await client.sendText('5511984316526@c.us', 'Conexão WhatsApp restaurada automaticamente!');
      console.log(`✅ Mensagem enviada com sucesso!`);
      
    } else {
      console.log(`❌ Falha ao obter informações do dispositivo`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao restaurar conexão:', error);
  }
}

restoreConnection();