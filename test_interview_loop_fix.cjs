// Teste direto do sistema de entrevistas para verificar se o loop foi corrigido

async function testInterviewLoop() {
  console.log('🧪 TESTE DIRETO DO LOOP INFINITO - VERSÃO CORRIGIDA');
  console.log('===============================================');
  
  try {
    // Importar diretamente o serviço usando import dinâmico
    const { interactiveInterviewService } = await import('./server/interactiveInterviewService.ts');
    
    const testPhone = '553182956616';
    const testClientId = '1749849987543';
    
    console.log('📱 Testando sequência de mensagens:');
    console.log('1. Mensagem "1" para iniciar entrevista');
    console.log('2. Primeira resposta de áudio');  
    console.log('3. Segunda resposta de áudio');
    console.log('');
    
    // Mensagem 1: Iniciar entrevista
    console.log('📤 [STEP 1] Enviando mensagem "1"...');
    await interactiveInterviewService.handleMessage(testPhone, '1', null, testClientId);
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar estado
    const activeInterviews = interactiveInterviewService.getActiveInterviews();
    let interview = activeInterviews.get(testPhone);
    
    console.log('📊 [STEP 1] Estado após iniciar:', {
      entrevistaAtiva: !!interview,
      perguntaAtual: interview?.currentQuestion,
      totalPerguntas: interview?.questions?.length,
      nomeVaga: interview?.jobName
    });
    
    if (!interview) {
      console.log('❌ [ERRO] Entrevista não foi criada corretamente');
      return;
    }
    
    // Mensagem 2: Primeira resposta
    console.log('📤 [STEP 2] Enviando primeira resposta...');
    await interactiveInterviewService.handleMessage(testPhone, 'Primeira resposta teste', null, testClientId);
    
    // Aguardar processamento
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    interview = activeInterviews.get(testPhone);
    console.log('📊 [STEP 2] Estado após primeira resposta:', {
      entrevistaAtiva: !!interview,
      perguntaAtual: interview?.currentQuestion,
      totalPerguntas: interview?.questions?.length,
      respostasContadas: interview?.responses?.length
    });
    
    // Mensagem 3: Segunda resposta
    console.log('📤 [STEP 3] Enviando segunda resposta...');
    await interactiveInterviewService.handleMessage(testPhone, 'Segunda resposta teste', null, testClientId);
    
    // Aguardar processamento
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    interview = activeInterviews.get(testPhone);
    console.log('📊 [STEP 3] Estado após segunda resposta:', {
      entrevistaAtiva: !!interview,
      perguntaAtual: interview?.currentQuestion,
      totalPerguntas: interview?.questions?.length,
      respostasContadas: interview?.responses?.length,
      finalizou: !interview
    });
    
    // Teste concluído
    console.log('');
    console.log('✅ TESTE CONCLUÍDO');
    console.log('==================');
    
    if (!interview) {
      console.log('🎉 SUCESSO: Entrevista finalizada corretamente após 2 respostas');
      console.log('🔧 LOOP INFINITO CORRIGIDO!');
    } else {
      console.log('❌ PROBLEMA: Entrevista ainda ativa, pode estar em loop');
      console.log('🔄 Pergunta atual:', interview.currentQuestion);
      console.log('📝 Total de perguntas:', interview.questions.length);
    }
    
  } catch (error) {
    console.error('❌ [ERRO] Falha no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testInterviewLoop().catch(console.error);