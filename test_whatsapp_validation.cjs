// Script para testar a validação bidirecional de números WhatsApp
const fetch = require('node-fetch');

// Token do usuário bruno.claro@yahoo.com
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTEzODUwNzUxNTkiLCJlbWFpbCI6ImJydW5vLmNsYXJvQHlhaG9vLmNvbSIsInJvbGUiOiJjbGllbnQiLCJjbGllbnRJZCI6MTc0OTg0OTk4NzU0MywiaWF0IjoxNzUyODE4MTE0fQ.pJ_oeHYWW2GDq8OQR6eXcxM3KlI1WKUCh6qI1FG1Gqs";

async function testBidirectionalValidation() {
  console.log('🧪 [TESTE] Iniciando testes de validação bidirecional WhatsApp\n');

  // Números de teste para validar as diferentes estratégias
  const testNumbers = [
    {
      description: "Número com 9º dígito (novo formato)",
      phone: "5511987654321",
      expected: "Deve testar: original, sem 9, com 9"
    },
    {
      description: "Número sem 9º dígito (formato antigo MG)",  
      phone: "553187654321",
      expected: "Deve testar: original, sem 9, com 9"
    },
    {
      description: "Número real para teste", 
      phone: "5531991505564",
      expected: "Deve encontrar versão válida se existir"
    },
    {
      description: "Número sem código do país",
      phone: "11987654321", 
      expected: "Deve adicionar 55 e testar todas variações"
    }
  ];

  for (const test of testNumbers) {
    console.log(`📱 [TESTE] ${test.description}`);
    console.log(`   Número: ${test.phone}`);
    console.log(`   Expectativa: ${test.expected}`);
    
    try {
      const response = await fetch('http://localhost:5000/api/whatsapp/validate-number', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone: test.phone })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        if (result.isValid) {
          console.log(`   ✅ VÁLIDO: ${result.validatedNumber} (testado: ${result.testedNumber})`);
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
  
  console.log('🎉 [TESTE] Validação bidirecional concluída!');
  console.log('\n📊 [ANÁLISE] Verificações implementadas:');
  console.log('   ✓ Adiciona código do país (55) se necessário');
  console.log('   ✓ Testa número original');
  console.log('   ✓ Remove 9º dígito (números antigos MG)');
  console.log('   ✓ Adiciona 9º dígito (números novos)');
  console.log('   ✓ Remove duplicatas');
  console.log('   ✓ Valida cada candidato via Baileys onWhatsApp()');
  console.log('   ✓ Retorna primeiro número válido encontrado');
}

// Executar teste
testBidirectionalValidation().catch(console.error);