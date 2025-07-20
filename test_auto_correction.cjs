// Script para testar a correção automática de números WhatsApp
const fetch = require('node-fetch');

// Token do usuário bruno.claro@yahoo.com
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTEzODUwNzUxNTkiLCJlbWFpbCI6ImJydW5vLmNsYXJvQHlhaG9vLmNvbSIsInJvbGUiOiJjbGllbnQiLCJjbGllbnRJZCI6MTc0OTg0OTk4NzU0MywiaWF0IjoxNzUyODE4MTE0fQ.pJ_oeHYWW2GDq8OQR6eXcxM3KlI1WKUCh6qI1FG1Gqs";

async function testAutoCorrection() {
  console.log('🧪 [TESTE] Iniciando teste de correção automática WhatsApp\n');

  // Testes específicos para correção automática
  const testCases = [
    {
      description: "Número sem 9º dígito (deve ser corrigido para formato com 9)",
      input: "551196612253",
      expected: "5511996612253",
      shouldCorrect: true
    },
    {
      description: "Número já correto com 9º dígito",
      input: "5511996612253", 
      expected: "5511996612253",
      shouldCorrect: false
    },
    {
      description: "Número MG sem 9º dígito (pode permanecer sem 9 se válido)",
      input: "553187654321",
      expected: "553187654321 ou 5531987654321",
      shouldCorrect: "depends"
    }
  ];

  for (const test of testCases) {
    console.log(`📱 [TESTE] ${test.description}`);
    console.log(`   Input: ${test.input}`);
    console.log(`   Esperado: ${test.expected}`);
    
    try {
      const response = await fetch('http://localhost:5000/api/whatsapp/validate-number', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone: test.input })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        if (result.isValid) {
          const corrected = result.validatedNumber !== test.input;
          console.log(`   ✅ VÁLIDO: ${result.validatedNumber}`);
          console.log(`   📊 Número original: ${result.originalNumber || test.input}`);
          console.log(`   🔧 Foi corrigido: ${corrected ? 'SIM' : 'NÃO'}`);
          
          if (corrected) {
            console.log(`   ⚡ CORREÇÃO: ${test.input} → ${result.validatedNumber}`);
          }
          
          // Validar se correção atende expectativa
          if (test.shouldCorrect === true && !corrected) {
            console.log(`   ⚠️ ATENÇÃO: Esperava correção mas não houve`);
          } else if (test.shouldCorrect === false && corrected) {
            console.log(`   ⚠️ ATENÇÃO: Não esperava correção mas houve`);
          }
          
        } else {
          console.log(`   ❌ INVÁLIDO: ${result.error}`);
          if (result.testedNumbers) {
            console.log(`   🔍 Números testados: ${result.testedNumbers.join(', ')}`);
          }
        }
      } else {
        console.log(`   ⚠️ ERRO HTTP ${response.status}: ${result.error || 'Erro desconhecido'}`);
      }
      
    } catch (error) {
      console.log(`   💥 ERRO DE REDE: ${error.message}`);
    }
    
    console.log(''); // Linha em branco entre testes
  }
  
  console.log('🎉 [TESTE] Teste de correção automática concluído!');
  console.log('\n📊 [ANÁLISE] Comportamento esperado:');
  console.log('   ✓ Números sem 9º dígito → Testados COM e SEM 9º dígito');
  console.log('   ✓ Primeiro número válido encontrado → Retornado como correto');
  console.log('   ✓ Frontend mostra notificação: "Número corrigido automaticamente!"');
  console.log('   ✓ Banco de dados salva número VALIDADO, não o original digitado');
}

// Executar teste
testAutoCorrection().catch(console.error);