// Teste manual para verificar se o loop infinito foi corrigido
// Simula mensagens WhatsApp diretas ao sistema

import { interactiveInterviewService } from './server/interactiveInterviewService.js';

console.log('🧪 INICIANDO TESTE DE CORREÇÃO DO LOOP INFINITO');
console.log('================================================');

async function testInterviewFlow() {
  const testPhone = '553182956616';
  const testClientId = '1749849987543';
  
  try {
    console.log('\n🔸 ETAPA 1: Enviando resposta "1" para iniciar entrevista');
    await interactiveInterviewService.handleMessage(testPhone, '1', null, testClientId);
    
    // Aguardar um pouco para entrevista iniciar
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🔸 ETAPA 2: Verificando se entrevista foi criada');
    const activeInterviews = interactiveInterviewService.getActiveInterviews();
    const interview = activeInterviews.get(testPhone);
    
    if (!interview) {
      console.log('❌ ERRO: Nenhuma entrevista ativa encontrada');
      return;
    }
    
    console.log(`✅ Entrevista encontrada: pergunta atual ${interview.currentQuestion + 1}/${interview.questions.length}`);
    console.log(`📝 Job: ${interview.jobName}`);
    console.log(`👤 Candidato: ${interview.candidateName}`);
    
    console.log('\n🔸 ETAPA 3: Simulando resposta por áudio para primeira pergunta');
    await interactiveInterviewService.handleMessage(testPhone, 'Minha primeira resposta em áudio', null, testClientId);
    
    // Aguardar processamento
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🔸 ETAPA 4: Verificando se avançou para segunda pergunta');
    const updatedInterview = activeInterviews.get(testPhone);
    
    if (!updatedInterview) {
      console.log('❌ ERRO: Entrevista foi removida inesperadamente');
      return;
    }
    
    console.log(`📍 Pergunta atual após primeira resposta: ${updatedInterview.currentQuestion + 1}/${updatedInterview.questions.length}`);
    console.log(`📊 Respostas coletadas: ${updatedInterview.responses.length}`);
    
    if (updatedInterview.currentQuestion === 1) {
      console.log('✅ SUCESSO: Entrevista avançou corretamente para segunda pergunta');
    } else {
      console.log(`❌ ERRO: Entrevista não avançou corretamente (ainda na pergunta ${updatedInterview.currentQuestion + 1})`);
    }
    
    console.log('\n🔸 ETAPA 5: Simulando resposta para segunda pergunta');
    await interactiveInterviewService.handleMessage(testPhone, 'Minha segunda resposta em áudio', null, testClientId);
    
    // Aguardar processamento
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🔸 ETAPA 6: Verificação final do estado da entrevista');
    const finalInterview = activeInterviews.get(testPhone);
    
    if (!finalInterview) {
      console.log('✅ SUCESSO: Entrevista foi finalizada e removida (se havia apenas 2 perguntas)');
    } else {
      console.log(`📍 Pergunta atual após segunda resposta: ${finalInterview.currentQuestion + 1}/${finalInterview.questions.length}`);
      console.log(`📊 Respostas coletadas: ${finalInterview.responses.length}`);
      
      if (finalInterview.currentQuestion === 2 && finalInterview.questions.length > 2) {
        console.log('✅ SUCESSO: Entrevista avançou corretamente para terceira pergunta');
      } else if (finalInterview.currentQuestion >= finalInterview.questions.length) {
        console.log('✅ SUCESSO: Entrevista deveria estar finalizada');
      } else {
        console.log(`❌ POSSÍVEL PROBLEMA: Estado inesperado da entrevista`);
      }
    }
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error);
  }
  
  console.log('\n================================================');
  console.log('🧪 TESTE DE CORREÇÃO DO LOOP FINALIZADO');
}

// Executar teste
testInterviewFlow().catch(console.error);