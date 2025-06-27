// Teste direto de conexão WhatsApp
import wppconnect from '@wppconnect-team/wppconnect';

async function testConnection() {
  try {
    console.log('🔍 Testando conexões WhatsApp ativas...');
    
    // Verificar se há sessões ativas
    const sessions = wppconnect.listSessions();
    console.log('📱 Sessões WppConnect encontradas:', sessions);
    
    // Tentar acessar sessão específica
    const sessionName = 'client_1749849987543';
    console.log(`🔍 Verificando sessão: ${sessionName}`);
    
    try {
      const client = wppconnect.getClient(sessionName);
      if (client) {
        console.log('✅ Cliente encontrado:', !!client);
        const isConnected = await client.isConnected();
        console.log('📱 Status conectado:', isConnected);
        
        if (isConnected) {
          const me = await client.getHostDevice();
          console.log('👤 Número conectado:', me?.id?.user || 'Unknown');
        }
      }
    } catch (clientError) {
      console.log('❌ Erro ao acessar cliente:', clientError.message);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testConnection();