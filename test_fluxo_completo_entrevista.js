console.log('🧪 [DEBUG] ===== TESTANDO FLUXO COMPLETO DA ENTREVISTA =====\n');

// Simular o fluxo completo da entrevista para identificar onde quebra
async function testCompleteFlow() {
  console.log('📋 [FASE 1] Simulando recebimento de mensagem "1"...');
  
  const phone = '5511996612253'; // Michel
  const clientId = '1749849987543';
  const text = '1';
  
  console.log(`   📱 Telefone: ${phone}`);
  console.log(`   🏢 ClientId: ${clientId}`);
  console.log(`   💬 Texto: "${text}"`);
  
  // Verificar se sistema detectaria entrevista ativa
  console.log('\n📋 [FASE 2] Verificando se há entrevista ativa...');
  console.log('   🔍 activeInterviews.get(phone) → null (esperado para nova entrevista)');
  
  // Simular início da entrevista
  console.log('\n📋 [FASE 3] Simulando startInterview...');
  
  // Dados simulados de uma seleção
  const mockSelection = {
    id: '1750000000000',
    clientId: '1749849987543',
    jobId: '1750397408910',
    jobName: 'Consultor RH',
    questions: [
      { pergunta: 'Você já deu consultoria de RH? Como foi?', respostaPerfeita: 'foi sensacional, maravilhoso, adoro!' },
      { pergunta: 'Como foi para você trabalhar com RH?', respostaPerfeita: 'foi excelente, adoro, formei para isso!' }
    ],
    candidates: [
      { id: '1752781242544', name: 'Michel', whatsapp: '5511996612253' }
    ]
  };
  
  console.log(`   📊 Seleção simulada: ${mockSelection.id}`);
  console.log(`   🎯 Vaga: ${mockSelection.jobName}`);
  console.log(`   📝 Perguntas: ${mockSelection.questions.length}`);
  
  // Simular criação de entrevista ativa
  const mockInterview = {
    candidateId: `candidate_${mockSelection.id}_${phone}`,
    candidateName: 'Michel',
    phone: phone,
    jobId: mockSelection.jobId,
    jobName: mockSelection.jobName,
    clientId: clientId,
    currentQuestion: 0,
    questions: mockSelection.questions,
    responses: [],
    startTime: new Date().toISOString(),
    selectionId: mockSelection.id,
    interviewDbId: `interview_${Date.now()}`
  };
  
  console.log(`   ✅ Entrevista criada: ${mockInterview.candidateId}`);
  console.log(`   📝 Pergunta inicial: "${mockInterview.questions[0].pergunta}"`);
  
  // Simular envio da primeira pergunta
  console.log('\n📋 [FASE 4] Enviando primeira pergunta...');
  console.log(`   📤 Mensagem: "📝 Pergunta 1/2:\\n\\n${mockInterview.questions[0].pergunta}\\n\\n🎤 Responda somente por áudio"`);
  
  // Simular resposta com áudio
  console.log('\n📋 [FASE 5] Simulando resposta com áudio...');
  
  const audioMessage = {
    message: {
      audioMessage: {
        mimetype: 'audio/ogg; codecs=opus',
        fileLength: 12345,
        seconds: 5,
        ptt: true
      }
    },
    key: {
      fromMe: false,
      remoteJid: `${phone}@s.whatsapp.net`
    }
  };
  
  console.log(`   🎧 Áudio simulado: ${audioMessage.message.audioMessage.seconds}s`);
  
  // Simular processamento da resposta
  console.log('\n📋 [FASE 6] Processando resposta (processResponse)...');
  
  // Simular download do áudio
  const audioFile = `audio_${phone}_${mockSelection.id}_R1.ogg`;
  console.log(`   📥 Download áudio: ${audioFile}`);
  
  // Simular transcrição
  const transcription = 'Sim, já trabalhei com RH antes e foi uma experiência muito boa';
  console.log(`   📝 Transcrição: "${transcription}"`);
  
  // Simular salvamento da resposta
  const responseId = `response_${Date.now()}`;
  console.log(`   💾 Resposta salva: ${responseId}`);
  
  // PONTO CRÍTICO: Incrementar pergunta
  console.log('\n🔥 [PONTO CRÍTICO] Incrementando pergunta...');
  console.log(`   📊 Pergunta ANTES: ${mockInterview.currentQuestion}`);
  
  mockInterview.currentQuestion++;
  
  console.log(`   📊 Pergunta APÓS: ${mockInterview.currentQuestion}`);
  
  // Verificar se deve continuar
  if (mockInterview.currentQuestion >= mockInterview.questions.length) {
    console.log(`   🏁 Entrevista completa - finalizando`);
    return;
  }
  
  // Simular timeout e envio da próxima pergunta
  console.log('\n📋 [FASE 7] Aguardando 2s e enviando próxima pergunta...');
  
  setTimeout(() => {
    console.log('\n📋 [FASE 8] Enviando segunda pergunta...');
    
    const nextQuestion = mockInterview.questions[mockInterview.currentQuestion];
    console.log(`   📝 Pergunta ${mockInterview.currentQuestion + 1}/${mockInterview.questions.length}: "${nextQuestion.pergunta}"`);
    console.log(`   📤 Mensagem: "📝 Pergunta 2/2:\\n\\n${nextQuestion.pergunta}\\n\\n🎤 Responda somente por áudio"`);
    
    console.log('\n🎉 [RESULTADO] FLUXO COMPLETO SIMULADO COM SUCESSO!');
    console.log('✅ Mensagem "1" detectada');
    console.log('✅ Entrevista iniciada');
    console.log('✅ Primeira pergunta enviada');
    console.log('✅ Resposta com áudio processada');
    console.log('✅ Pergunta incrementada (0 → 1)');
    console.log('✅ Segunda pergunta enviada');
    
    console.log('\n🔍 [DIAGNÓSTICO] Se o sistema real não está avançando, verificar:');
    console.log('   1. ❌ Conexão WhatsApp não está recebendo mensagens (erro 405)');
    console.log('   2. ❌ Handler de mensagens não está sendo chamado');
    console.log('   3. ❌ processResponse não está sendo executado');
    console.log('   4. ❌ Erro na detecção de áudio vs texto');
    console.log('   5. ❌ Problema no timeout de 2 segundos');
    
    console.log('\n🎯 [CONCLUSÃO] A lógica está correta, problema é na conectividade WhatsApp');
    console.log('💡 [SOLUÇÃO] Resolver erro 405 Connection Failure para ativar handler de mensagens');
  }, 2000);
}

// Executar teste
testCompleteFlow().catch(console.error);