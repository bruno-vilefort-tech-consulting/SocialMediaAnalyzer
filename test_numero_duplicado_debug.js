/**
 * TESTE ESPECÍFICO - NÚMERO DUPLICADO DEBUG
 * Investigar problema de roteamento com número 553182956616
 * 
 * Data: 17/07/2025
 * Objetivo: Verificar como o sistema está resolvendo candidatos duplicados
 */

console.log('🔍 [DEBUG-DUPLICADO] Teste específico para número 553182956616');
console.log('');

// Função para fazer requisições
async function makeRequest(method, url, data = null) {
  const { default: fetch } = await import('node-fetch');
  
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTE0NjU1NTI1NzMiLCJlbWFpbCI6ImJydW5vLnZpbGVmb3J0QGF0dWFycGF5LmNvbS5iciIsInJvbGUiOiJjbGllbnQiLCJjbGllbnRJZCI6MTc1MDE2OTI4Mzc4MCwiaWF0IjoxNzUxNTU1ODI2fQ.W3QbWLMW1lwu5qY8-K_JSZZvgNpXIpkHenDZkT5Bkis'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, options);
  return await response.json();
}

async function runTests() {
  try {
    console.log('🔍 [TESTE 1] Buscar candidatos do cliente 1750169283780');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const candidatesResponse = await makeRequest('GET', 'http://localhost:5000/api/candidates');
    const candidatesWithNumber = candidatesResponse.filter(c => c.whatsapp === '553182956616');
    
    console.log('📋 Candidatos encontrados com número 553182956616:');
    candidatesWithNumber.forEach(c => {
      console.log(`  - ${c.name} (ID: ${c.id}) - Cliente: ${c.clientId} - Email: ${c.email}`);
    });
    
    console.log('');
    console.log('🔍 [TESTE 2] Simular mensagem "1" para 553182956616');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const triggerResponse = await makeRequest('POST', 'http://localhost:5000/api/user-round-robin/test-trigger', {
      phoneNumber: '553182956616',
      clientId: 1750169283780
    });
    
    console.log('📊 Resposta do trigger:');
    console.log(JSON.stringify(triggerResponse, null, 2));
    
    console.log('');
    console.log('🔍 [TESTE 3] Verificar qual candidato foi usado');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Aguardar um pouco para o processamento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Buscar estatísticas para ver se cadência foi ativada
    const statsResponse = await makeRequest('GET', 'http://localhost:5000/api/user-round-robin/stats');
    
    console.log('📊 Estatísticas após trigger:');
    console.log(JSON.stringify(statsResponse, null, 2));
    
    console.log('');
    console.log('🔍 [RESUMO]');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👥 Total candidatos com número: ${candidatesWithNumber.length}`);
    console.log(`✅ Trigger executado: ${triggerResponse.success ? 'SIM' : 'NÃO'}`);
    console.log(`🎯 Cadência ativa: ${statsResponse.stats?.cadenceActive ? 'SIM' : 'NÃO'}`);
    console.log(`⚡ Slots ativos: ${statsResponse.stats?.activeSlots || 0}`);
    
    if (candidatesWithNumber.length > 1) {
      console.log('');
      console.log('⚠️  [PROBLEMA IDENTIFICADO] Número duplicado encontrado!');
      console.log('   Sistema precisa priorizar candidato do cliente correto.');
    }
    
  } catch (error) {
    console.error('❌ [ERRO] Erro durante os testes:', error);
  }
}

// Executar testes
runTests();