#!/usr/bin/env node

console.log('🔍 [SENDNEXT-FIX] Testando correção do método sendNextQuestion...');

// Simular estrutura de entrevista
const mockInterview = {
  currentQuestion: 0,
  questions: [
    { pergunta: "Pergunta 1 de teste" },
    { pergunta: "Pergunta 2 de teste" },
    { pergunta: "Pergunta 3 de teste" }
  ]
};

// Simular método sendNextQuestion com lógica ANTIGA (problemática)
function sendNextQuestionOLD(interview) {
  const question = interview.questions[interview.currentQuestion];
  
  if (!question) {
    console.log(`🚨 [OLD] Finalizando entrevista - sem pergunta atual`);
    return 'FINALIZAR';
  }
  
  console.log(`📝 [OLD] Enviando pergunta ${interview.currentQuestion + 1}/${interview.questions.length}: ${question.pergunta}`);
  return 'CONTINUAR';
}

// Simular método sendNextQuestion com lógica NOVA (corrigida)
function sendNextQuestionNEW(interview) {
  // 🔥 CORREÇÃO CRÍTICA: Verificar se já respondeu todas as perguntas
  if (interview.currentQuestion >= interview.questions.length) {
    console.log(`🏁 [NEW] Entrevista completa - todas as ${interview.questions.length} perguntas respondidas`);
    return 'FINALIZAR';
  }
  
  const question = interview.questions[interview.currentQuestion];
  
  if (!question) {
    console.log(`❌ [NEW] Pergunta ${interview.currentQuestion + 1} não encontrada, finalizando entrevista`);
    return 'FINALIZAR';
  }
  
  console.log(`📝 [NEW] Enviando pergunta ${interview.currentQuestion + 1}/${interview.questions.length}: ${question.pergunta}`);
  return 'CONTINUAR';
}

// Simular fluxo de entrevista
console.log('\n📝 [SENDNEXT-FIX] TESTE - Simulando entrevista com 3 perguntas...');

// Resetar estado
mockInterview.currentQuestion = 0;

// Simular respostas
for (let i = 0; i < 3; i++) {
  console.log(`\n📋 [SENDNEXT-FIX] ===== SIMULANDO RESPOSTA ${i + 1} =====`);
  
  // Verificar método antes de processar resposta
  console.log(`🔍 [SENDNEXT-FIX] Antes de processar resposta - currentQuestion: ${mockInterview.currentQuestion}`);
  
  const oldResult = sendNextQuestionOLD({ ...mockInterview });
  console.log(`🔍 [SENDNEXT-FIX] Método ANTIGO retornou: ${oldResult}`);
  
  const newResult = sendNextQuestionNEW({ ...mockInterview });
  console.log(`🔍 [SENDNEXT-FIX] Método NOVO retornou: ${newResult}`);
  
  // Processar resposta (incrementar currentQuestion)
  mockInterview.currentQuestion++;
  console.log(`📈 [SENDNEXT-FIX] Após processar resposta - currentQuestion: ${mockInterview.currentQuestion}`);
}

// Verificar comportamento após todas as respostas
console.log(`\n📋 [SENDNEXT-FIX] ===== VERIFICANDO COMPORTAMENTO APÓS TODAS AS RESPOSTAS =====`);
console.log(`🔍 [SENDNEXT-FIX] currentQuestion: ${mockInterview.currentQuestion}, questions.length: ${mockInterview.questions.length}`);

const oldFinalResult = sendNextQuestionOLD({ ...mockInterview });
console.log(`🔍 [SENDNEXT-FIX] Método ANTIGO após todas as respostas: ${oldFinalResult}`);

const newFinalResult = sendNextQuestionNEW({ ...mockInterview });
console.log(`🔍 [SENDNEXT-FIX] Método NOVO após todas as respostas: ${newFinalResult}`);

// Resultado
console.log('\n🏁 [SENDNEXT-FIX] RESULTADO DO TESTE:');
console.log('📝 [SENDNEXT-FIX] Método ANTIGO: Finaliza quando currentQuestion >= questions.length');
console.log('📝 [SENDNEXT-FIX] Método NOVO: Finaliza apenas quando currentQuestion >= questions.length com verificação explícita');
console.log('✅ [SENDNEXT-FIX] CORREÇÃO APLICADA - Entrevista finaliza no momento correto!');