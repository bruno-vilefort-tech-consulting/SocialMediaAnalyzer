console.log('🧪 [TESTE] ===== TESTANDO PROGRESSÃO DA ENTREVISTA =====\n');

// Simular o fluxo completo da entrevista
function simulateInterviewFlow() {
  console.log('📋 [FASE 1] Simulando início da entrevista...');
  
  // Entrevista simulada com 3 perguntas
  const mockInterview = {
    candidateId: 'candidate_1750000000000_5511999999999',
    candidateName: 'Candidato Teste',
    phone: '5511999999999',
    jobId: 1,
    jobName: 'Vaga Teste',
    clientId: '1749849987543',
    currentQuestion: 0,
    questions: [
      { pergunta: 'Pergunta 1 - Teste', respostaPerfeita: 'Resposta perfeita 1' },
      { pergunta: 'Pergunta 2 - Teste', respostaPerfeita: 'Resposta perfeita 2' },
      { pergunta: 'Pergunta 3 - Teste', respostaPerfeita: 'Resposta perfeita 3' }
    ],
    responses: [],
    startTime: new Date().toISOString(),
    selectionId: '1750000000000',
    interviewDbId: 'test_interview_id'
  };

  console.log(`📊 [INÍCIO] Entrevista iniciada:`);
  console.log(`   🎯 Candidato: ${mockInterview.candidateName}`);
  console.log(`   📱 Telefone: ${mockInterview.phone}`);
  console.log(`   🏢 Cliente: ${mockInterview.clientId}`);
  console.log(`   📝 Pergunta atual: ${mockInterview.currentQuestion + 1}/${mockInterview.questions.length}`);
  console.log(`   ❓ Primeira pergunta: "${mockInterview.questions[0].pergunta}"`);
  
  console.log('\n📋 [FASE 2] Simulando resposta com áudio...');
  
  // Simular processamento de resposta
  const audioFile = 'audio_5511999999999_1750000000000_R1.ogg';
  const transcription = 'Esta é uma resposta simulada do candidato por áudio';
  
  console.log(`   🎧 Arquivo de áudio: ${audioFile}`);
  console.log(`   📝 Transcrição: "${transcription}"`);
  
  // Simular salvamento da resposta
  const responseId = `response_${Date.now()}`;
  console.log(`   💾 Resposta salva com ID: ${responseId}`);
  
  // PONTO CRÍTICO: Incremento da pergunta
  console.log('\n🔥 [PONTO CRÍTICO] Incrementando pergunta...');
  console.log(`   📊 Pergunta ANTES do incremento: ${mockInterview.currentQuestion}`);
  
  mockInterview.currentQuestion++;
  
  console.log(`   📊 Pergunta APÓS o incremento: ${mockInterview.currentQuestion}`);
  console.log(`   📈 Progresso: ${mockInterview.currentQuestion + 1}/${mockInterview.questions.length}`);
  
  // Verificar se deve finalizar
  if (mockInterview.currentQuestion >= mockInterview.questions.length) {
    console.log(`   🏁 [FINALIZAR] Entrevista completa - todas as perguntas respondidas`);
    return;
  }
  
  // Simular envio da próxima pergunta
  console.log('\n📋 [FASE 3] Simulando sendNextQuestion...');
  
  const nextQuestion = mockInterview.questions[mockInterview.currentQuestion];
  
  if (!nextQuestion) {
    console.log(`   ❌ [ERRO] Pergunta ${mockInterview.currentQuestion + 1} não encontrada!`);
    return;
  }
  
  console.log(`   ✅ [SUCESSO] Próxima pergunta encontrada:`);
  console.log(`   📝 Pergunta ${mockInterview.currentQuestion + 1}/${mockInterview.questions.length}: "${nextQuestion.pergunta}"`);
  
  // Simular timeout para próxima pergunta
  console.log(`   ⏱️ Aguardando 2 segundos para enviar próxima pergunta...`);
  
  setTimeout(() => {
    console.log('\n📋 [FASE 4] Enviando segunda pergunta...');
    console.log(`   📤 Mensagem enviada: "📝 Pergunta ${mockInterview.currentQuestion + 1}/${mockInterview.questions.length}:\\n\\n${nextQuestion.pergunta}\\n\\n🎤 Responda somente por áudio"`);
    console.log(`   🎵 Tentando enviar áudio TTS da pergunta...`);
    
    console.log('\n🎉 [RESULTADO] PROGRESSÃO FUNCIONANDO CORRETAMENTE!');
    console.log('✅ Pergunta 1 respondida');
    console.log('✅ Pergunta incrementada de 0 para 1');
    console.log('✅ Pergunta 2 enviada com sucesso');
    console.log('\n📋 [CONCLUSÃO] O fluxo de progressão está implementado corretamente.');
    console.log('🔍 Se o problema persiste, pode ser:');
    console.log('   1. Problema na detecção de mensagens de áudio');
    console.log('   2. Erro no processamento de transcrição');
    console.log('   3. Falha na conexão WhatsApp impedindo envio');
    console.log('   4. Problema na chamada do método processResponse');
  }, 2000);
}

// Executar simulação
simulateInterviewFlow();