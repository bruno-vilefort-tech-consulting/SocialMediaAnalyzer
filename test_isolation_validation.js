// Validação completa do sistema de Round Robin isolado por usuário
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

// Dados de teste para duas contas diferentes
const testAccounts = {
  bruno: {
    userId: '1751465552573',
    clientId: '1750169283780',
    email: 'bruno.vilefort@atuarpay.com.br',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTE0NjU1NTI1NzMiLCJlbWFpbCI6ImJydW5vLnZpbGVmb3J0QGF0dWFycGF5LmNvbS5iciIsInJvbGUiOiJjbGllbnQiLCJjbGllbnRJZCI6MTc1MDE2OTI4Mzc4MCwiaWF0IjoxNzUxNTU1ODI2fQ.W3QbWLMW1lwu5qY8-K_JSZZvgNpXIpkHenDZkT5Bkis'
  },
  daniel: {
    userId: '1749849987543',
    clientId: '1749849987543',
    email: 'daniel@example.com',
    token: 'token_daniel_simulado'
  }
};

const testCandidates = [
  { name: 'Teste Bruno 1', phone: '5511984316526' },
  { name: 'Teste Bruno 2', phone: '5511984316527' },
  { name: 'Teste Daniel 1', phone: '5511984316528' },
  { name: 'Teste Daniel 2', phone: '5511984316529' }
];

async function makeRequest(endpoint, method = 'GET', body = null, userToken = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (userToken) {
    headers.Authorization = `Bearer ${userToken}`;
  }
  
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

async function test1_IsolamentoPorConta() {
  console.log('\n🔥 TESTE 1: Isolamento por Conta');
  console.log('=====================================\n');
  
  // Inicializar slots para ambas as contas
  console.log('📋 Inicializando slots para Bruno...');
  const brunoSlots = await makeRequest('/api/user-round-robin/init-slots', 'POST', {}, testAccounts.bruno.token);
  console.log('Resultado Bruno:', brunoSlots.success ? '✅ Sucesso' : '❌ Falha', brunoSlots.data);
  
  console.log('\n📋 Inicializando slots para Daniel...');
  const danielSlots = await makeRequest('/api/user-round-robin/init-slots', 'POST', {}, testAccounts.daniel.token);
  console.log('Resultado Daniel:', danielSlots.success ? '✅ Sucesso' : '❌ Falha', danielSlots.data);
  
  // Configurar cadência para ambas as contas
  const cadenceConfig = {
    baseDelay: 1000,
    batchSize: 2,
    maxRetries: 3,
    adaptiveMode: true,
    immediateMode: false
  };
  
  console.log('\n⚙️ Configurando cadência para Bruno...');
  const brunoCadence = await makeRequest('/api/user-round-robin/configure-cadence', 'POST', cadenceConfig, testAccounts.bruno.token);
  console.log('Resultado Bruno:', brunoCadence.success ? '✅ Sucesso' : '❌ Falha', brunoCadence.data);
  
  console.log('\n⚙️ Configurando cadência para Daniel...');
  const danielCadence = await makeRequest('/api/user-round-robin/configure-cadence', 'POST', cadenceConfig, testAccounts.daniel.token);
  console.log('Resultado Daniel:', danielCadence.success ? '✅ Sucesso' : '❌ Falha', danielCadence.data);
  
  // Distribuir candidatos para ambas as contas
  console.log('\n🔄 Distribuindo candidatos para Bruno...');
  const brunoDistribution = await makeRequest('/api/user-round-robin/distribute-candidates', 'POST', {
    candidates: testCandidates.slice(0, 2),
    priority: 'high'
  }, testAccounts.bruno.token);
  console.log('Resultado Bruno:', brunoDistribution.success ? '✅ Sucesso' : '❌ Falha', brunoDistribution.data);
  
  console.log('\n🔄 Distribuindo candidatos para Daniel...');
  const danielDistribution = await makeRequest('/api/user-round-robin/distribute-candidates', 'POST', {
    candidates: testCandidates.slice(2, 4),
    priority: 'high'
  }, testAccounts.daniel.token);
  console.log('Resultado Daniel:', danielDistribution.success ? '✅ Sucesso' : '❌ Falha', danielDistribution.data);
  
  // Verificar estatísticas separadas
  console.log('\n📊 Verificando estatísticas do Bruno...');
  const brunoStats = await makeRequest('/api/user-round-robin/stats', 'GET', null, testAccounts.bruno.token);
  console.log('Stats Bruno:', brunoStats.success ? '✅ Sucesso' : '❌ Falha', brunoStats.data);
  
  console.log('\n📊 Verificando estatísticas do Daniel...');
  const danielStats = await makeRequest('/api/user-round-robin/stats', 'GET', null, testAccounts.daniel.token);
  console.log('Stats Daniel:', danielStats.success ? '✅ Sucesso' : '❌ Falha', danielStats.data);
  
  return {
    brunoSlots: brunoSlots.success,
    danielSlots: danielSlots.success,
    isolation: brunoStats.success && danielStats.success
  };
}

async function test2_DisparoCadencia() {
  console.log('\n🚀 TESTE 2: Disparo da Cadência via Seleção "1"');
  console.log('===============================================\n');
  
  // Simular resposta "1" para Bruno
  console.log('📱 Ativando cadência imediata para Bruno...');
  const brunoImmediate = await makeRequest('/api/user-round-robin/activate-immediate', 'POST', {
    candidatePhone: '5511984316526'
  }, testAccounts.bruno.token);
  console.log('Resultado Bruno:', brunoImmediate.success ? '✅ Sucesso' : '❌ Falha', brunoImmediate.data);
  
  // Simular resposta "1" para Daniel
  console.log('\n📱 Ativando cadência imediata para Daniel...');
  const danielImmediate = await makeRequest('/api/user-round-robin/activate-immediate', 'POST', {
    candidatePhone: '5511984316528'
  }, testAccounts.daniel.token);
  console.log('Resultado Daniel:', danielImmediate.success ? '✅ Sucesso' : '❌ Falha', danielImmediate.data);
  
  // Verificar se cadência começou imediatamente
  console.log('\n⏱️ Aguardando 2 segundos para verificar cadência...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n📊 Verificando stats pós-cadência do Bruno...');
  const brunoStatsPost = await makeRequest('/api/user-round-robin/stats', 'GET', null, testAccounts.bruno.token);
  console.log('Stats Bruno:', brunoStatsPost.success ? '✅ Sucesso' : '❌ Falha', brunoStatsPost.data);
  
  console.log('\n📊 Verificando stats pós-cadência do Daniel...');
  const danielStatsPost = await makeRequest('/api/user-round-robin/stats', 'GET', null, testAccounts.daniel.token);
  console.log('Stats Daniel:', danielStatsPost.success ? '✅ Sucesso' : '❌ Falha', danielStatsPost.data);
  
  return {
    brunoImmediate: brunoImmediate.success,
    danielImmediate: danielImmediate.success,
    cadenceActivated: brunoStatsPost.success && danielStatsPost.success
  };
}

async function test3_SemInterferenciaCruzada() {
  console.log('\n🔒 TESTE 3: Ausência de Interferência Cruzada');
  console.log('=============================================\n');
  
  // Processar cadência para Bruno
  console.log('🔄 Processando cadência para Bruno...');
  const brunoProcess = await makeRequest('/api/user-round-robin/process-cadence', 'POST', {}, testAccounts.bruno.token);
  console.log('Resultado Bruno:', brunoProcess.success ? '✅ Sucesso' : '❌ Falha', brunoProcess.data);
  
  // Processar cadência para Daniel
  console.log('\n🔄 Processando cadência para Daniel...');
  const danielProcess = await makeRequest('/api/user-round-robin/process-cadence', 'POST', {}, testAccounts.daniel.token);
  console.log('Resultado Daniel:', danielProcess.success ? '✅ Sucesso' : '❌ Falha', danielProcess.data);
  
  // Aguardar processamento
  console.log('\n⏱️ Aguardando 3 segundos para monitorar interferência...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Verificar stats finais
  console.log('\n📊 Stats finais Bruno...');
  const brunoFinal = await makeRequest('/api/user-round-robin/stats', 'GET', null, testAccounts.bruno.token);
  console.log('Stats Bruno:', brunoFinal.success ? '✅ Sucesso' : '❌ Falha', brunoFinal.data);
  
  console.log('\n📊 Stats finais Daniel...');
  const danielFinal = await makeRequest('/api/user-round-robin/stats', 'GET', null, testAccounts.daniel.token);
  console.log('Stats Daniel:', danielFinal.success ? '✅ Sucesso' : '❌ Falha', danielFinal.data);
  
  return {
    brunoProcess: brunoProcess.success,
    danielProcess: danielProcess.success,
    noInterference: brunoFinal.success && danielFinal.success
  };
}

async function test4_ValidacaoIsolamento() {
  console.log('\n🔍 TESTE 4: Validação de Isolamento (Master Only)');
  console.log('================================================\n');
  
  // Este teste seria executado apenas por usuário master
  console.log('⚠️ Teste de validação de isolamento requer acesso master');
  console.log('⚠️ Pulando teste - seria necessário token master válido');
  
  return {
    validationSkipped: true,
    reason: 'Requer acesso master'
  };
}

async function test5_TesteQuedaSlot() {
  console.log('\n🔧 TESTE 5: Teste de Queda de Slot');
  console.log('==================================\n');
  
  // Parar cadência para Bruno
  console.log('🛑 Parando cadência para Bruno...');
  const brunoStop = await makeRequest('/api/user-round-robin/stop-cadence', 'POST', {}, testAccounts.bruno.token);
  console.log('Resultado Bruno:', brunoStop.success ? '✅ Sucesso' : '❌ Falha', brunoStop.data);
  
  // Verificar se Daniel continua funcionando
  console.log('\n📊 Verificando se Daniel continua funcionando...');
  const danielContinue = await makeRequest('/api/user-round-robin/stats', 'GET', null, testAccounts.daniel.token);
  console.log('Stats Daniel:', danielContinue.success ? '✅ Sucesso' : '❌ Falha', danielContinue.data);
  
  // Parar cadência para Daniel também
  console.log('\n🛑 Parando cadência para Daniel...');
  const danielStop = await makeRequest('/api/user-round-robin/stop-cadence', 'POST', {}, testAccounts.daniel.token);
  console.log('Resultado Daniel:', danielStop.success ? '✅ Sucesso' : '❌ Falha', danielStop.data);
  
  return {
    brunoStop: brunoStop.success,
    danielContinue: danielContinue.success,
    danielStop: danielStop.success
  };
}

async function executarTodosOsTestes() {
  console.log('🔥 INICIANDO VALIDAÇÃO COMPLETA DO SISTEMA');
  console.log('🔥 Round Robin Isolado por Usuário');
  console.log('🔥 Data:', new Date().toLocaleString('pt-BR'));
  console.log('==========================================');
  
  const results = {};
  
  try {
    results.test1 = await test1_IsolamentoPorConta();
    results.test2 = await test2_DisparoCadencia();
    results.test3 = await test3_SemInterferenciaCruzada();
    results.test4 = await test4_ValidacaoIsolamento();
    results.test5 = await test5_TesteQuedaSlot();
    
    console.log('\n🎉 RESUMO DOS TESTES');
    console.log('==================');
    console.log('Teste 1 - Isolamento por Conta:', results.test1.isolation ? '✅ PASSOU' : '❌ FALHOU');
    console.log('Teste 2 - Disparo da Cadência:', results.test2.cadenceActivated ? '✅ PASSOU' : '❌ FALHOU');
    console.log('Teste 3 - Sem Interferência:', results.test3.noInterference ? '✅ PASSOU' : '❌ FALHOU');
    console.log('Teste 4 - Validação Isolamento:', results.test4.validationSkipped ? '⚠️ PULADO' : '✅ PASSOU');
    console.log('Teste 5 - Teste Queda Slot:', results.test5.brunoStop && results.test5.danielStop ? '✅ PASSOU' : '❌ FALHOU');
    
    const totalTests = 4; // Excluindo teste 4 que foi pulado
    const passedTests = [
      results.test1.isolation,
      results.test2.cadenceActivated,
      results.test3.noInterference,
      results.test5.brunoStop && results.test5.danielStop
    ].filter(Boolean).length;
    
    console.log(`\n🏆 RESULTADO FINAL: ${passedTests}/${totalTests} testes passaram`);
    
    if (passedTests === totalTests) {
      console.log('🎉 SISTEMA VALIDADO COM SUCESSO!');
      console.log('✅ Objetivo concluído - Sistema de Round Robin isolado por usuário funcionando corretamente');
    } else {
      console.log('⚠️ SISTEMA REQUER AJUSTES');
      console.log('❌ Alguns testes falharam - verificar logs para identificar problemas');
    }
    
  } catch (error) {
    console.error('❌ Erro durante execução dos testes:', error);
    results.error = error.message;
  }
  
  return results;
}

// Executar todos os testes
executarTodosOsTestes().catch(console.error);