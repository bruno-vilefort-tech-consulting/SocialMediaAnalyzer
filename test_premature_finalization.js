/**
 * INVESTIGAÇÃO DA FINALIZAÇÃO PREMATURA DE ENTREVISTAS
 * 
 * Este script investiga por que as entrevistas estão finalizando com apenas
 * 2 respostas em vez de aguardar todas as perguntas.
 */

import { storage } from './server/storage.ts';
import { interactiveInterviewService } from './server/interactiveInterviewService.ts';

async function investigatePrematureFinalization() {
  console.log('🔍 [PREMATURE-FINALIZATION] Iniciando investigação da finalização prematura...');
  
  try {
    // 1. VERIFICAR ESTRUTURA DE JOBS E PERGUNTAS
    console.log('\n📝 [PREMATURE-FINALIZATION] Verificando estrutura de jobs e perguntas...');
    
    // Buscar jobs disponíveis
    const jobs = await storage.getAllJobs();
    console.log(`📊 [PREMATURE-FINALIZATION] Jobs encontrados: ${jobs.length}`);
    
    if (jobs.length > 0) {
      const firstJob = jobs[0];
      console.log(`📝 [PREMATURE-FINALIZATION] Job exemplo: ${firstJob.nomeVaga}`);
      console.log(`📝 [PREMATURE-FINALIZATION] Total de perguntas: ${firstJob.perguntas?.length || 0}`);
      
      if (firstJob.perguntas && firstJob.perguntas.length > 0) {
        console.log(`📝 [PREMATURE-FINALIZATION] Perguntas:`);
        firstJob.perguntas.forEach((pergunta, index) => {
          console.log(`  ${index + 1}. ${pergunta.pergunta}`);
        });
      }
    }
    
    // 2. SIMULAR ENTREVISTA COMPLETA
    console.log('\n📝 [PREMATURE-FINALIZATION] Simulando entrevista completa...');
    
    const testPhone = '553182230538';
    const testClientId = '1750169283780';
    
    // Verificar se há entrevista ativa
    const activeInterviews = interactiveInterviewService.getActiveInterviews();
    console.log(`📊 [PREMATURE-FINALIZATION] Entrevistas ativas: ${activeInterviews.size}`);
    
    for (const [phone, interview] of activeInterviews) {
      console.log(`📱 [PREMATURE-FINALIZATION] Entrevista ativa: ${phone}`);
      console.log(`👤 [PREMATURE-FINALIZATION] Candidato: ${interview.candidateName}`);
      console.log(`📝 [PREMATURE-FINALIZATION] Pergunta atual: ${interview.currentQuestion + 1}/${interview.questions.length}`);
      console.log(`📝 [PREMATURE-FINALIZATION] Respostas: ${interview.responses.length}`);
      console.log(`📝 [PREMATURE-FINALIZATION] Perguntas disponíveis: ${interview.questions.length}`);
      
      // Verificar se a pergunta atual existe
      const currentQuestion = interview.questions[interview.currentQuestion];
      console.log(`❓ [PREMATURE-FINALIZATION] Pergunta atual existe: ${currentQuestion ? 'SIM' : 'NÃO'}`);
      
      if (currentQuestion) {
        console.log(`📝 [PREMATURE-FINALIZATION] Texto da pergunta: "${currentQuestion.pergunta}"`);
      } else {
        console.log(`🚨 [PREMATURE-FINALIZATION] PROBLEMA: Pergunta atual não existe!`);
        console.log(`📝 [PREMATURE-FINALIZATION] currentQuestion: ${interview.currentQuestion}`);
        console.log(`📝 [PREMATURE-FINALIZATION] questions.length: ${interview.questions.length}`);
      }
    }
    
    // 3. SIMULAR FLUXO DE PERGUNTAS
    console.log('\n📝 [PREMATURE-FINALIZATION] Simulando fluxo de perguntas...');
    
    if (activeInterviews.size > 0) {
      const [phone, interview] = activeInterviews.entries().next().value;
      
      console.log(`📝 [PREMATURE-FINALIZATION] Simulando resposta para pergunta ${interview.currentQuestion + 1}`);
      
      // Simular resposta
      const mockResponse = {
        questionId: interview.currentQuestion,
        questionText: interview.questions[interview.currentQuestion]?.pergunta || 'Pergunta não encontrada',
        responseText: 'Resposta simulada',
        audioFile: null,
        timestamp: new Date().toISOString()
      };
      
      interview.responses.push(mockResponse);
      interview.currentQuestion++;
      
      console.log(`📝 [PREMATURE-FINALIZATION] Após resposta simulada:`);
      console.log(`📝 [PREMATURE-FINALIZATION] Pergunta atual: ${interview.currentQuestion + 1}/${interview.questions.length}`);
      console.log(`📝 [PREMATURE-FINALIZATION] Respostas: ${interview.responses.length}`);
      
      // Verificar se próxima pergunta existe
      const nextQuestion = interview.questions[interview.currentQuestion];
      console.log(`❓ [PREMATURE-FINALIZATION] Próxima pergunta existe: ${nextQuestion ? 'SIM' : 'NÃO'}`);
      
      if (!nextQuestion) {
        console.log(`🚨 [PREMATURE-FINALIZATION] PROBLEMA: Próxima pergunta não existe!`);
        console.log(`📝 [PREMATURE-FINALIZATION] Isso causará finalização prematura`);
        console.log(`📝 [PREMATURE-FINALIZATION] currentQuestion: ${interview.currentQuestion}`);
        console.log(`📝 [PREMATURE-FINALIZATION] questions.length: ${interview.questions.length}`);
        
        // Verificar se deveria haver mais perguntas
        if (interview.currentQuestion < interview.questions.length) {
          console.log(`✅ [PREMATURE-FINALIZATION] Ainda há perguntas disponíveis`);
          console.log(`📝 [PREMATURE-FINALIZATION] Pergunta ${interview.currentQuestion + 1}: ${interview.questions[interview.currentQuestion].pergunta}`);
        } else {
          console.log(`⚠️ [PREMATURE-FINALIZATION] Todas as perguntas foram respondidas`);
        }
      }
    }
    
    // 4. VERIFICAR LÓGICA DE FINALIZAÇÃO
    console.log('\n📝 [PREMATURE-FINALIZATION] Verificando lógica de finalização...');
    
    // Simular condição de finalização
    const mockInterview = {
      candidateName: 'Bruno Teste',
      currentQuestion: 2,
      questions: [
        { pergunta: 'Pergunta 1' },
        { pergunta: 'Pergunta 2' },
        { pergunta: 'Pergunta 3' }
      ],
      responses: [
        { questionId: 0, responseText: 'Resposta 1' },
        { questionId: 1, responseText: 'Resposta 2' }
      ]
    };
    
    console.log(`📝 [PREMATURE-FINALIZATION] Mock interview:`);
    console.log(`📝 [PREMATURE-FINALIZATION] Pergunta atual: ${mockInterview.currentQuestion + 1}/${mockInterview.questions.length}`);
    console.log(`📝 [PREMATURE-FINALIZATION] Respostas: ${mockInterview.responses.length}`);
    
    const currentQuestionExists = mockInterview.questions[mockInterview.currentQuestion];
    console.log(`❓ [PREMATURE-FINALIZATION] Pergunta atual existe: ${currentQuestionExists ? 'SIM' : 'NÃO'}`);
    
    if (!currentQuestionExists) {
      console.log(`🚨 [PREMATURE-FINALIZATION] PROBLEMA IDENTIFICADO: sendNextQuestion finalizará prematuramente!`);
      console.log(`📝 [PREMATURE-FINALIZATION] Lógica atual: if (!question) { finishInterview(); }`);
      console.log(`📝 [PREMATURE-FINALIZATION] Correção necessária: verificar se todas as perguntas foram respondidas`);
    }
    
    // 5. RESULTADO DA INVESTIGAÇÃO
    console.log('\n🏁 [PREMATURE-FINALIZATION] RESULTADO DA INVESTIGAÇÃO:');
    console.log(`📝 [PREMATURE-FINALIZATION] Problema identificado: sendNextQuestion finaliza quando currentQuestion >= questions.length`);
    console.log(`📝 [PREMATURE-FINALIZATION] Isso é correto APENAS se todas as perguntas foram respondidas`);
    console.log(`📝 [PREMATURE-FINALIZATION] Solução: verificar se currentQuestion < questions.length antes de finalizar`);
    
    console.log('\n🎯 [PREMATURE-FINALIZATION] Investigação concluída!');
    
  } catch (error) {
    console.error('❌ [PREMATURE-FINALIZATION] Erro na investigação:', error);
  }
}

// Executar investigação
investigatePrematureFinalization();