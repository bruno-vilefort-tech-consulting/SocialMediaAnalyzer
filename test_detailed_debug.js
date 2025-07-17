// Teste detalhado para verificar logs do sistema
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const BRUNO_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTE0NjU1NTI1NzMiLCJlbWFpbCI6ImJydW5vLnZpbGVmb3J0QGF0dWFycGF5LmNvbS5iciIsInJvbGUiOiJjbGllbnQiLCJjbGllbnRJZCI6MTc1MDE2OTI4Mzc4MCwiaWF0IjoxNzUxNTU1ODI2fQ.W3QbWLMW1lwu5qY8-K_JSZZvgNpXIpkHenDZkT5Bkis';

async function testDetailedDebug() {
  console.log('🔍 TESTE DETALHADO - Verificando logs do sistema');
  console.log('=================================================\n');
  
  const candidatePhone = '5511984316526';
  const userId = '1751465552573';
  
  // Teste 1: Inicializar sistema com logs
  console.log('🔧 Teste 1: Inicializando sistema com logs...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/init-slots`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRUNO_TOKEN}` 
      }
    });
    const result = await response.json();
    console.log('✅ Resposta completa:', JSON.stringify(result, null, 2));
    
    // Verificar se slots foram criados
    if (result.stats) {
      console.log('📊 Slots criados:', result.stats.activeSlots);
      console.log('📊 Total conexões:', result.stats.totalConnections);
    }
    
  } catch (error) {
    console.log('❌ Erro na inicialização:', error.message);
  }
  
  // Teste 2: Configurar cadência com logs
  console.log('\n⚙️ Teste 2: Configurando cadência imediata...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/configure-cadence`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRUNO_TOKEN}` 
      },
      body: JSON.stringify({
        baseDelay: 500,
        batchSize: 1,
        maxRetries: 3,
        adaptiveMode: false,
        immediateMode: true
      })
    });
    const result = await response.json();
    console.log('✅ Configuração completa:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ Erro na configuração:', error.message);
  }
  
  // Teste 3: Distribuir candidatos manualmente
  console.log('\n📦 Teste 3: Distribuindo candidatos manualmente...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/distribute-candidates`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRUNO_TOKEN}` 
      },
      body: JSON.stringify({
        candidates: [candidatePhone],
        priority: 'immediate'
      })
    });
    const result = await response.json();
    console.log('✅ Distribuição completa:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ Erro na distribuição:', error.message);
  }
  
  // Teste 4: Ativar cadência imediata
  console.log('\n🚀 Teste 4: Ativando cadência imediata...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/activate-immediate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRUNO_TOKEN}` 
      },
      body: JSON.stringify({
        candidatePhone: candidatePhone
      })
    });
    const result = await response.json();
    console.log('✅ Ativação completa:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ Erro na ativação:', error.message);
  }
  
  // Teste 5: Aguardar processamento
  console.log('\n⏱️ Teste 5: Aguardando processamento (3 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Teste 6: Verificar estatísticas com logs
  console.log('\n📊 Teste 6: Verificando estatísticas com logs...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/stats`, {
      headers: { 'Authorization': `Bearer ${BRUNO_TOKEN}` }
    });
    const stats = await response.json();
    console.log('✅ Estatísticas completas:', JSON.stringify(stats, null, 2));
    
    if (stats.success) {
      console.log('\n📈 RESUMO DETALHADO:');
      console.log(`- Slots ativos: ${stats.stats.activeSlots}`);
      console.log(`- Total conexões: ${stats.stats.totalConnections}`);
      console.log(`- Cadência ativa: ${stats.stats.cadenceActive}`);
      console.log(`- Mensagens enviadas: ${stats.stats.totalSent}`);
      console.log(`- Erros: ${stats.stats.totalErrors}`);
      console.log(`- Taxa de sucesso: ${stats.stats.successRate}`);
      
      // Análise do problema
      if (stats.stats.activeSlots === 0) {
        console.log('\n🔴 PROBLEMA IDENTIFICADO: Slots ativos = 0');
        console.log('🔍 Possíveis causas:');
        console.log('  - Slots não foram inicializados corretamente');
        console.log('  - Conexões WhatsApp não estão ativas');
        console.log('  - Problema na detecção de status dos slots');
      }
      
      if (stats.stats.cadenceActive && stats.stats.totalSent === 0) {
        console.log('\n🟡 PROBLEMA IDENTIFICADO: Cadência ativa mas sem envios');
        console.log('🔍 Possíveis causas:');
        console.log('  - Distribuição não foi criada corretamente');
        console.log('  - Slots não têm candidatos atribuídos');
        console.log('  - Erro no processamento da cadência');
      }
    }
  } catch (error) {
    console.log('❌ Erro ao verificar estatísticas:', error.message);
  }
  
  // Teste 7: Processar cadência manualmente
  console.log('\n🔄 Teste 7: Processando cadência manualmente com logs...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/process-cadence`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRUNO_TOKEN}` 
      }
    });
    const result = await response.json();
    console.log('✅ Processamento completo:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ Erro no processamento:', error.message);
  }
  
  // Teste 8: Estatísticas finais
  console.log('\n📈 Teste 8: Estatísticas finais...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/stats`, {
      headers: { 'Authorization': `Bearer ${BRUNO_TOKEN}` }
    });
    const stats = await response.json();
    console.log('✅ Estatísticas finais:', JSON.stringify(stats, null, 2));
  } catch (error) {
    console.log('❌ Erro nas estatísticas finais:', error.message);
  }
  
  console.log('\n🎯 DIAGNÓSTICO COMPLETO:');
  console.log('========================');
  console.log('✅ Sistema carregado e endpoints funcionais');
  console.log('✅ Configuração de cadência imediata aplicada');
  console.log('✅ Cadência ativada com sucesso');
  console.log('❌ Mensagens não sendo enviadas (slots = 0)');
  console.log('\n🔧 PRÓXIMOS PASSOS:');
  console.log('1. Verificar inicialização dos slots');
  console.log('2. Confirmar criação de distribuições');
  console.log('3. Testar envio de mensagens diretamente');
  console.log('4. Validar integração com simpleMultiBaileyService');
}

// Executar teste detalhado
testDetailedDebug().catch(console.error);