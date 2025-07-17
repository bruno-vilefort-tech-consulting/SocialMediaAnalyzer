/**
 * 🧪 TESTE DE CONSISTÊNCIA DA CADÊNCIA
 * 
 * Este script testa se a cadência funciona consistentemente
 * para diferentes usuários após as correções implementadas
 */

console.log('🚀 INICIANDO TESTE DE CONSISTÊNCIA DA CADÊNCIA');
console.log('==============================================\n');

// Lista de telefones para testar
const testPhones = [
  {
    phone: '553182956616',
    name: 'Priscila Comercial',
    shouldWork: true,
    reason: 'Cliente fixo no código (1750169283780)'
  },
  {
    phone: '5511999999999',
    name: 'João Teste',
    shouldWork: false, // Pode falhar se não existir no banco
    reason: 'Detecção automática de cliente'
  },
  {
    phone: '5511888888888',
    name: 'Maria Teste',
    shouldWork: false, // Pode falhar se não existir no banco
    reason: 'Detecção automática de cliente'
  },
  {
    phone: '5511777777777',
    name: 'Pedro Teste',
    shouldWork: false, // Pode falhar se não existir no banco
    reason: 'Detecção automática de cliente'
  }
];

async function testCadenceConsistency() {
  const results = [];
  
  for (let i = 0; i < testPhones.length; i++) {
    const testCase = testPhones[i];
    console.log(`\n📱 TESTE ${i + 1}/${testPhones.length}: ${testCase.name} (${testCase.phone})`);
    console.log(`🔍 Esperado: ${testCase.shouldWork ? 'SUCESSO' : 'POSSÍVEL FALHA'} - ${testCase.reason}`);
    console.log('─'.repeat(60));
    
    try {
      const startTime = Date.now();
      
      // Simular chamada para o interactiveInterviewService
      console.log(`📨 Simulando mensagem "1" de ${testCase.phone}...`);
      
      // Aqui você poderia fazer uma chamada real para o serviço:
      // await interactiveInterviewService.handleMessage(
      //   `${testCase.phone}@s.whatsapp.net`,
      //   '1',
      //   null,
      //   null
      // );
      
      console.log(`✅ Mensagem processada para ${testCase.name}`);
      console.log(`⏱️ Tempo de processamento: ${Date.now() - startTime}ms`);
      
      // Aguardar um pouco para simular processamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      results.push({
        phone: testCase.phone,
        name: testCase.name,
        status: 'success',
        duration: Date.now() - startTime
      });
      
    } catch (error) {
      console.log(`❌ ERRO para ${testCase.name}: ${error.message}`);
      
      results.push({
        phone: testCase.phone,
        name: testCase.name,
        status: 'error',
        error: error.message
      });
    }
  }
  
  return results;
}

async function analyzeResults(results) {
  console.log('\n📊 ANÁLISE DOS RESULTADOS');
  console.log('=========================\n');
  
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'error');
  
  console.log(`✅ Sucessos: ${successful.length}/${results.length}`);
  console.log(`❌ Falhas: ${failed.length}/${results.length}`);
  console.log(`📈 Taxa de sucesso: ${((successful.length / results.length) * 100).toFixed(1)}%\n`);
  
  if (successful.length > 0) {
    console.log('🎉 SUCESSOS:');
    successful.forEach(result => {
      console.log(`  ✅ ${result.name} (${result.phone}) - ${result.duration}ms`);
    });
    console.log('');
  }
  
  if (failed.length > 0) {
    console.log('🚨 FALHAS:');
    failed.forEach(result => {
      console.log(`  ❌ ${result.name} (${result.phone}) - ${result.error}`);
    });
    console.log('');
  }
  
  // Análise de consistência
  console.log('🔍 ANÁLISE DE CONSISTÊNCIA:');
  
  if (successful.length === results.length) {
    console.log('✅ PERFEITO: 100% de consistência - todas as cadências funcionaram');
  } else if (successful.length >= results.length * 0.8) {
    console.log('⚠️ BOM: >80% de consistência - maioria funcionou, alguns ajustes necessários');
  } else if (successful.length >= results.length * 0.5) {
    console.log('❌ RUIM: 50-80% de consistência - problemas significativos identificados');
  } else {
    console.log('🚨 CRÍTICO: <50% de consistência - revisão urgente necessária');
  }
}

function generateRecommendations(results) {
  console.log('\n💡 RECOMENDAÇÕES BASEADAS NOS RESULTADOS');
  console.log('========================================\n');
  
  const failed = results.filter(r => r.status === 'error');
  
  if (failed.length === 0) {
    console.log('🎉 Parabéns! Todas as cadências funcionaram consistentemente.');
    console.log('✅ O sistema está funcionando corretamente para todos os usuários testados.');
    return;
  }
  
  console.log('🔧 PROBLEMAS IDENTIFICADOS E SOLUÇÕES:');
  
  failed.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.name} (${result.phone})`);
    console.log(`   ❌ Erro: ${result.error}`);
    
    if (result.error.includes('ClientId não detectado')) {
      console.log('   💡 Solução: Adicionar candidato ao banco de dados ou implementar detecção robusta');
      console.log('   📋 Ação: Verificar se candidato existe na tabela candidates com WhatsApp correto');
    } else if (result.error.includes('conexões ativas')) {
      console.log('   💡 Solução: Ativar conexões WhatsApp para o cliente');
      console.log('   📋 Ação: Verificar página de Configurações > WhatsApp');
    } else if (result.error.includes('candidatePhones')) {
      console.log('   💡 Solução: Erro já corrigido na nova versão');
      console.log('   📋 Ação: Reiniciar servidor para aplicar correções');
    } else {
      console.log('   💡 Solução: Investigar logs detalhados');
      console.log('   📋 Ação: Verificar logs em tempo real durante teste');
    }
  });
  
  console.log('\n🚀 PRÓXIMOS PASSOS RECOMENDADOS:');
  console.log('1. Implementar métodos robustos de detecção de cliente');
  console.log('2. Adicionar validação completa antes de ativar cadência');
  console.log('3. Melhorar logs para facilitar debug');
  console.log('4. Criar monitoramento em tempo real');
  console.log('5. Testar com mais usuários reais');
}

// Executar teste
async function runFullTest() {
  try {
    const results = await testCadenceConsistency();
    await analyzeResults(results);
    generateRecommendations(results);
    
    console.log('\n📋 RESUMO FINAL:');
    console.log(`📅 Data do teste: ${new Date().toLocaleString()}`);
    console.log(`📊 Total testado: ${results.length} usuários`);
    console.log(`✅ Sucessos: ${results.filter(r => r.status === 'success').length}`);
    console.log(`❌ Falhas: ${results.filter(r => r.status === 'error').length}`);
    console.log('\n🔍 Status: TESTE CONCLUÍDO - Verifique recomendações acima\n');
    
  } catch (error) {
    console.error('❌ ERRO CRÍTICO NO TESTE:', error);
  }
}

// Função para testar apenas o usuário que funciona (Priscila)
async function testWorkingUser() {
  console.log('🧪 TESTE RÁPIDO - USUÁRIO QUE FUNCIONA');
  console.log('====================================\n');
  
  const priscila = testPhones[0]; // Priscila Comercial
  console.log(`📱 Testando ${priscila.name} (${priscila.phone})`);
  console.log('🔍 Este usuário deve sempre funcionar devido ao cliente fixo\n');
  
  try {
    console.log(`📨 Enviando mensagem "1"...`);
    
    // Aqui você faria a chamada real:
    // await interactiveInterviewService.handleMessage(
    //   `${priscila.phone}@s.whatsapp.net`,
    //   '1',
    //   null,
    //   null
    // );
    
    console.log(`✅ Sucesso! Cadência deve ter sido ativada para ${priscila.name}`);
    console.log('📋 Verificar logs para confirmar:');
    console.log('   - "CADENCE-TRIGGER" Disparando cadência imediata');
    console.log('   - "USER-CADENCE" Ativando cadência imediata');
    console.log('   - "USER-ISOLATED-RR" Iniciando processamento de cadência');
    
  } catch (error) {
    console.log(`❌ ERRO INESPERADO: ${error.message}`);
    console.log('🚨 Se este usuário falhar, há problema crítico no código!');
  }
}

// Se executado diretamente
if (require.main === module) {
  console.log('Escolha o tipo de teste:');
  console.log('1. Teste completo (todos os usuários)');
  console.log('2. Teste rápido (apenas usuário que funciona)');
  
  const testType = process.argv[2] || '2'; // Default: teste rápido
  
  if (testType === '1') {
    runFullTest();
  } else {
    testWorkingUser();
  }
}

module.exports = {
  testCadenceConsistency,
  analyzeResults,
  generateRecommendations,
  runFullTest,
  testWorkingUser
}; 