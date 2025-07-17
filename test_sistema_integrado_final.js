/**
 * TESTE FINAL DO SISTEMA INTEGRADO
 * Validação completa após correção de import/export
 * 
 * Data: 17/07/2025
 * Objetivo: Verificar se todas as correções estão funcionando corretamente
 */

console.log('🎯 [TESTE FINAL] Sistema Integrado - Validação Completa');
console.log('📋 [TESTE FINAL] Após correções de import/export');
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

// Função para validar resposta
function validateResponse(response, expected) {
  console.log(`📊 [VALIDAÇÃO] Resposta recebida:`, JSON.stringify(response, null, 2));
  
  if (response.success === expected.success) {
    console.log('✅ [VALIDAÇÃO] Status de sucesso correto');
    return true;
  } else {
    console.log('❌ [VALIDAÇÃO] Status de sucesso incorreto');
    return false;
  }
}

// Função principal de teste
async function runTests() {
  console.log('🚀 [TESTE 1] Testar endpoint de estatísticas');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const statsResponse = await makeRequest('GET', 'http://localhost:5000/api/user-round-robin/stats');
    const statsValid = validateResponse(statsResponse, { success: true });
    console.log(statsValid ? '✅ [TESTE 1] PASSOU' : '❌ [TESTE 1] FALHOU');
    console.log('');
    
    console.log('🚀 [TESTE 2] Testar endpoint de configuração de cadência');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const configData = {
      candidatePhones: ['551199999999', '551198888888', '551197777777'],
      baseDelay: 1000,
      batchSize: 2,
      maxRetries: 3,
      adaptiveMode: false,
      immediateMode: true
    };
    
    const configResponse = await makeRequest('POST', 'http://localhost:5000/api/user-round-robin/configure-cadence', configData);
    const configValid = validateResponse(configResponse, { success: true });
    console.log(configValid ? '✅ [TESTE 2] PASSOU' : '❌ [TESTE 2] FALHOU');
    console.log('');
    
    console.log('🚀 [TESTE 3] Testar endpoint de ativação imediata');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const activateData = {
      phoneNumber: '551199999999',
      clientId: 1750169283780
    };
    
    const activateResponse = await makeRequest('POST', 'http://localhost:5000/api/user-round-robin/activate-immediate', activateData);
    const activateValid = validateResponse(activateResponse, { success: true });
    console.log(activateValid ? '✅ [TESTE 3] PASSOU' : '❌ [TESTE 3] FALHOU');
    console.log('');
    
    console.log('🚀 [TESTE 4] Testar endpoint de trigger "1"');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const triggerData = {
      phoneNumber: '551199999999',
      clientId: 1750169283780
    };
    
    const triggerResponse = await makeRequest('POST', 'http://localhost:5000/api/user-round-robin/test-trigger', triggerData);
    const triggerValid = validateResponse(triggerResponse, { success: true });
    console.log(triggerValid ? '✅ [TESTE 4] PASSOU' : '❌ [TESTE 4] FALHOU');
    console.log('');
    
    console.log('📊 [RESUMO DOS TESTES]');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Estatísticas: ${statsValid ? 'PASSOU' : 'FALHOU'}`);
    console.log(`✅ Configuração: ${configValid ? 'PASSOU' : 'FALHOU'}`);
    console.log(`✅ Ativação: ${activateValid ? 'PASSOU' : 'FALHOU'}`);
    console.log(`✅ Trigger: ${triggerValid ? 'PASSOU' : 'FALHOU'}`);
    console.log('');
    
    const allPassed = statsValid && configValid && activateValid && triggerValid;
    console.log(allPassed ? '🎉 [RESULTADO] TODOS OS TESTES PASSARAM!' : '⚠️ [RESULTADO] ALGUNS TESTES FALHARAM');
    console.log('');
    
    if (allPassed) {
      console.log('🎯 [CONCLUSÃO] Sistema integrado funcionando corretamente!');
      console.log('🔧 [CONCLUSÃO] Correções de import/export aplicadas com sucesso');
      console.log('🚀 [CONCLUSÃO] Sistema pronto para uso em produção');
    } else {
      console.log('❌ [CONCLUSÃO] Ainda existem problemas a serem resolvidos');
    }
    
  } catch (error) {
    console.error('❌ [ERRO] Erro durante os testes:', error);
  }
}

// Executar testes
runTests();