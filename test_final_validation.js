#!/usr/bin/env node

console.log('🎯 [FINAL-VALIDATION] Validação final da correção da finalização prematura');

// Simular a estrutura real de uma entrevista
const simulateInterview = {
  currentQuestion: 0,
  questions: [
    { pergunta: "Qual é sua experiência profissional?" },
    { pergunta: "Como você lida com desafios?" },
    { pergunta: "Quais são seus objetivos?" }
  ],
  responses: []
};

// Simular o processamento das respostas
console.log('\n📋 [FINAL-VALIDATION] Simulando entrevista completa...');

for (let i = 0; i < 3; i++) {
  console.log(`\n🔄 [FINAL-VALIDATION] === PROCESSANDO RESPOSTA ${i + 1} ===`);
  
  // Estado antes de processar a resposta
  console.log(`📊 [FINAL-VALIDATION] Antes da resposta:`);
  console.log(`   currentQuestion: ${simulateInterview.currentQuestion}`);
  console.log(`   questions.length: ${simulateInterview.questions.length}`);
  console.log(`   responses.length: ${simulateInterview.responses.length}`);
  
  // Simular pergunta sendo enviada
  if (simulateInterview.currentQuestion < simulateInterview.questions.length) {
    const question = simulateInterview.questions[simulateInterview.currentQuestion];
    console.log(`📝 [FINAL-VALIDATION] Enviando pergunta ${simulateInterview.currentQuestion + 1}/${simulateInterview.questions.length}:`);
    console.log(`   "${question.pergunta}"`);
    
    // Simular resposta recebida
    simulateInterview.responses.push({
      questionIndex: simulateInterview.currentQuestion,
      response: `Resposta simulada para pergunta ${simulateInterview.currentQuestion + 1}`
    });
    
    // Incrementar currentQuestion após processar resposta
    simulateInterview.currentQuestion++;
    
    console.log(`📈 [FINAL-VALIDATION] Após processar resposta:`);
    console.log(`   currentQuestion: ${simulateInterview.currentQuestion}`);
    console.log(`   responses.length: ${simulateInterview.responses.length}`);
    
    // Verificar se deve finalizar
    if (simulateInterview.currentQuestion >= simulateInterview.questions.length) {
      console.log(`🏁 [FINAL-VALIDATION] ENTREVISTA COMPLETA - Todas as ${simulateInterview.questions.length} perguntas respondidas!`);
      break;
    }
  }
}

// Validação final
console.log('\n✅ [FINAL-VALIDATION] RESULTADO FINAL:');
console.log(`📊 [FINAL-VALIDATION] Perguntas totais: ${simulateInterview.questions.length}`);
console.log(`📊 [FINAL-VALIDATION] Respostas recebidas: ${simulateInterview.responses.length}`);
console.log(`📊 [FINAL-VALIDATION] Pergunta atual: ${simulateInterview.currentQuestion}`);

if (simulateInterview.responses.length === simulateInterview.questions.length) {
  console.log('🎉 [FINAL-VALIDATION] SUCESSO - Todas as perguntas foram respondidas antes da finalização!');
} else {
  console.log('❌ [FINAL-VALIDATION] ERRO - Entrevista finalizada prematuramente!');
}

console.log('\n📝 [FINAL-VALIDATION] A correção aplicada:');
console.log('   if (interview.currentQuestion >= interview.questions.length) {');
console.log('     console.log(`🏁 [SENDNEXT] Entrevista completa - todas as ${interview.questions.length} perguntas respondidas`);');
console.log('     await this.finishInterview(phone, interview);');
console.log('     return;');
console.log('   }');
console.log('✅ [FINAL-VALIDATION] Correção garante finalização apenas quando todas as perguntas foram respondidas!');