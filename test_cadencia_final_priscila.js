import fetch from 'node-fetch';

// Configuração do teste
const phone = '553182956616';
const clientId = '1750169283780';
const userId = '1751465552573';

const headers = {
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTE0NjU1NTI1NzMiLCJlbWFpbCI6ImJydW5vLnZpbGVmb3J0QGF0dWFycGF5LmNvbS5iciIsInJvbGUiOiJjbGllbnQiLCJjbGllbnRJZCI6MTc1MDE2OTI4Mzc4MCwiaWF0IjoxNzUxNTU1ODI2fQ.W3QbWLMW1lwu5qY8-K_JSZZvgNpXIpkHenDZkT5Bkis',
  'Content-Type': 'application/json'
};

async function makeRequest(method, path, data = null) {
  const options = {
    method: method,
    headers: headers
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`http://localhost:5000${path}`, options);
  return await response.json();
}

async function testCadenciaPriscila() {
  console.log('🔍 [TESTE FINAL] Verificando cadência para Priscila Comercial');
  console.log('📞 Telefone:', phone);
  console.log('👤 ClientId:', clientId);
  console.log('🆔 UserId:', userId);
  console.log('');

  try {
    // 1. Verificar estatísticas
    console.log('📊 [STATS] Verificando estatísticas...');
    const stats = await makeRequest('GET', '/api/user-round-robin/stats');
    console.log('📊 [STATS] Resultado:', JSON.stringify(stats, null, 2));
    
    // 2. Verificar slots de WhatsApp
    console.log('');
    console.log('📱 [WHATSAPP] Verificando conexões WhatsApp...');
    const whatsapp = await makeRequest('GET', '/api/multi-whatsapp/connections');
    console.log('📱 [WHATSAPP] Conexões ativas:', whatsapp.activeConnections);
    
    // 3. Processar cadência mais uma vez
    console.log('');
    console.log('⚡ [PROCESS] Processando cadência...');
    const process = await makeRequest('POST', '/api/user-round-robin/process-cadence');
    console.log('⚡ [PROCESS] Resultado:', JSON.stringify(process, null, 2));
    
    // 4. Verificar estatísticas finais
    console.log('');
    console.log('📊 [STATS FINAL] Verificando estatísticas finais...');
    const finalStats = await makeRequest('GET', '/api/user-round-robin/stats');
    console.log('📊 [STATS FINAL] Resultado:', JSON.stringify(finalStats, null, 2));
    
    // 5. Resumo final
    console.log('');
    console.log('🎯 [RESUMO FINAL] Status do sistema:');
    console.log('✅ Cadência ativa:', finalStats.stats?.cadenceActive || false);
    console.log('⚡ Slots ativos:', finalStats.stats?.activeSlots || 0);
    console.log('📤 Mensagens enviadas:', finalStats.stats?.totalSent || 0);
    console.log('📱 Conexões WhatsApp:', whatsapp.activeConnections);
    
    if (finalStats.stats?.cadenceActive) {
      console.log('🎉 [SUCESSO] Cadência funcionando para Priscila Comercial!');
    } else {
      console.log('⚠️ [ALERTA] Cadência não está ativa');
    }
    
  } catch (error) {
    console.error('❌ [ERRO] Erro durante teste:', error.message);
  }
}

testCadenciaPriscila();