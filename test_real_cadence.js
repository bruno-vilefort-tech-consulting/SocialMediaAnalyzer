// Teste real do sistema de cadência com detecção de "1"
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

// Token válido do Bruno
const BRUNO_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTE0NjU1NTI1NzMiLCJlbWFpbCI6ImJydW5vLnZpbGVmb3J0QGF0dWFycGF5LmNvbS5iciIsInJvbGUiOiJjbGllbnQiLCJjbGllbnRJZCI6MTc1MDE2OTI4Mzc4MCwiaWF0IjoxNzUxNTU1ODI2fQ.W3QbWLMW1lwu5qY8-K_JSZZvgNpXIpkHenDZkT5Bkis';

async function makeRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${BRUNO_TOKEN}`
  };
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });
    
    const data = await response.json();
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testSystemIntegration() {
  console.log('🔥 TESTE DE INTEGRAÇÃO REAL - Sistema de Cadência');
  console.log('=================================================\n');
  
  // Teste 1: Inicializar sistema Round Robin
  console.log('📋 Teste 1: Inicializando sistema Round Robin...');
  const initResult = await makeRequest('/api/user-round-robin/init-slots', 'POST');
  console.log('Resultado:', initResult.success ? '✅ Sucesso' : '❌ Falha', initResult.data);
  
  if (!initResult.success) {
    console.log('❌ Falha na inicialização - abortando teste');
    return;
  }
  
  // Teste 2: Configurar cadência
  console.log('\n⚙️ Teste 2: Configurando cadência...');
  const configResult = await makeRequest('/api/user-round-robin/configure-cadence', 'POST', {
    baseDelay: 500,
    batchSize: 1,
    maxRetries: 3,
    adaptiveMode: false,
    immediateMode: true
  });
  console.log('Resultado:', configResult.success ? '✅ Sucesso' : '❌ Falha', configResult.data);
  
  // Teste 3: Distribuir candidatos
  console.log('\n🔄 Teste 3: Distribuindo candidatos...');
  const candidates = [
    { name: 'Teste Cadência 1', phone: '5511984316526' },
    { name: 'Teste Cadência 2', phone: '5511984316527' }
  ];
  
  const distributeResult = await makeRequest('/api/user-round-robin/distribute-candidates', 'POST', {
    candidates,
    priority: 'high'
  });
  console.log('Resultado:', distributeResult.success ? '✅ Sucesso' : '❌ Falha', distributeResult.data);
  
  // Teste 4: Ativar cadência imediata (simula resposta "1")
  console.log('\n🚀 Teste 4: Ativando cadência imediata (simulando resposta "1")...');
  const immediateResult = await makeRequest('/api/user-round-robin/activate-immediate', 'POST', {
    candidatePhone: '5511984316526'
  });
  console.log('Resultado:', immediateResult.success ? '✅ Sucesso' : '❌ Falha', immediateResult.data);
  
  // Teste 5: Verificar estatísticas
  console.log('\n📊 Teste 5: Verificando estatísticas...');
  const statsResult = await makeRequest('/api/user-round-robin/stats', 'GET');
  console.log('Resultado:', statsResult.success ? '✅ Sucesso' : '❌ Falha', statsResult.data);
  
  // Teste 6: Processar cadência
  console.log('\n🔄 Teste 6: Processando cadência...');
  const processResult = await makeRequest('/api/user-round-robin/process-cadence', 'POST');
  console.log('Resultado:', processResult.success ? '✅ Sucesso' : '❌ Falha', processResult.data);
  
  // Aguardar processamento
  console.log('\n⏱️ Aguardando 3 segundos para processamento...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Teste 7: Verificar estatísticas finais
  console.log('\n📈 Teste 7: Verificando estatísticas finais...');
  const finalStatsResult = await makeRequest('/api/user-round-robin/stats', 'GET');
  console.log('Resultado:', finalStatsResult.success ? '✅ Sucesso' : '❌ Falha', finalStatsResult.data);
  
  // Teste 8: Parar cadência
  console.log('\n🛑 Teste 8: Parando cadência...');
  const stopResult = await makeRequest('/api/user-round-robin/stop-cadence', 'POST');
  console.log('Resultado:', stopResult.success ? '✅ Sucesso' : '❌ Falha', stopResult.data);
  
  // Resumo
  console.log('\n🎉 RESUMO DO TESTE DE INTEGRAÇÃO');
  console.log('================================');
  
  const results = [
    { name: 'Inicialização', success: initResult.success },
    { name: 'Configuração', success: configResult.success },
    { name: 'Distribuição', success: distributeResult.success },
    { name: 'Cadência Imediata', success: immediateResult.success },
    { name: 'Estatísticas', success: statsResult.success },
    { name: 'Processamento', success: processResult.success },
    { name: 'Stats Finais', success: finalStatsResult.success },
    { name: 'Parada', success: stopResult.success }
  ];
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(result => {
    console.log(`${result.success ? '✅' : '❌'} ${result.name}`);
  });
  
  console.log(`\n🏆 RESULTADO: ${passed}/${total} testes passaram`);
  
  if (passed === total) {
    console.log('🎉 SISTEMA DE CADÊNCIA FUNCIONANDO CORRETAMENTE!');
  } else {
    console.log('⚠️ SISTEMA REQUER AJUSTES - Verificar logs para detalhes');
  }
}

// Executar teste
testSystemIntegration().catch(console.error);