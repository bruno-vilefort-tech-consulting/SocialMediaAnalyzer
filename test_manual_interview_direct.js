#!/usr/bin/env node

// TESTE MANUAL DIRETO DO FLUXO DE ENTREVISTA
// Simula diretamente uma mensagem "1" seguida de respostas de áudio

console.log('🚀 TESTE MANUAL DIRETO - VERIFICAÇÃO DA CORREÇÃO DO LOOP INFINITO');
console.log('================================================================');

const testData = {
  phone: '553182956616',
  clientId: '1749849987543',
  testCases: [
    { message: '1', description: 'Inicia entrevista' },
    { message: 'Primeira resposta de áudio', description: 'Resposta pergunta 1' },
    { message: 'Segunda resposta de áudio', description: 'Resposta pergunta 2' },
    { message: 'Terceira resposta de áudio', description: 'Resposta pergunta 3 (se existir)' }
  ]
};

console.log(`📱 Telefone: ${testData.phone}`);
console.log(`🏢 Cliente: ${testData.clientId}`);
console.log('');

console.log('💡 INSTRUÇÃO MANUAL:');
console.log('1. Abra o terminal separado');
console.log('2. Execute cada comando sequencialmente');
console.log('3. Aguarde processamento completo entre comandos');
console.log('4. Monitore logs do servidor para verificar comportamento');
console.log('');

testData.testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. ${testCase.description}:`);
  console.log(`curl -X POST "http://localhost:5000/api/whatsapp/message" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"phone": "${testData.phone}", "message": "${testCase.message}", "clientId": "${testData.clientId}"}'`);
  console.log('');
});

console.log('🔍 LOGS A MONITORAR:');
console.log('- [UNIFIED] - Criação/gerenciamento de entrevista unificada');
console.log('- [START-QUESTION] - Envio da primeira pergunta');
console.log('- [INTERVIEW-ADVANCE] - Avanço entre perguntas');
console.log('- [NEXT-QUESTION] - Envio da próxima pergunta');
console.log('- [INTERVIEW-FINISH] - Finalização da entrevista');
console.log('- [FINISH] - Remoção da entrevista da memória');
console.log('');

console.log('✅ RESULTADO ESPERADO:');
console.log('- Mensagem "1" → Inicia entrevista e envia pergunta 1');
console.log('- Primeira resposta → Avança para pergunta 2');
console.log('- Segunda resposta → Avança para pergunta 3 (ou finaliza se só tem 2)');
console.log('- Terceira resposta → Finaliza entrevista completamente');
console.log('- NÃO deve repetir perguntas em loop infinito');
console.log('');

console.log('❌ FALHA SE:');
console.log('- Pergunta 1 for enviada múltiplas vezes');
console.log('- Interview não avançar após receber resposta');
console.log('- Sistema travar em qualquer pergunta específica');
console.log('- Entrevista não finalizar após última pergunta');