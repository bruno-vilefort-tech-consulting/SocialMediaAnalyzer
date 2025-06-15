import { storage } from './server/storage.js';

async function getTranscriptions() {
  try {
    console.log('Buscando transcrições de áudio...');
    
    // Buscar entrevistas recentes
    const interviews = await storage.getInterviews();
    
    console.log(`Total de entrevistas encontradas: ${interviews.length}`);
    
    // Buscar as mais recentes primeiro
    const recentInterviews = interviews
      .filter(interview => interview.candidateName === 'daniel moreira')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
    
    for (let i = 0; i < recentInterviews.length; i++) {
      const interview = recentInterviews[i];
      console.log(`\n--- ENTREVISTA ${i + 1} ---`);
      console.log(`Candidato: ${interview.candidateName}`);
      console.log(`Vaga: ${interview.jobName}`);
      console.log(`Data: ${interview.createdAt}`);
      console.log(`Status: ${interview.status}`);
      
      // Buscar respostas desta entrevista
      const responses = await storage.getResponsesByInterviewId(interview.id);
      console.log(`Respostas: ${responses.length}`);
      
      responses.forEach((response, idx) => {
        console.log(`  Pergunta ${idx + 1}: ${response.questionText}`);
        console.log(`  Transcrição: "${response.responseText}"`);
        console.log(`  Arquivo: ${response.audioFile || 'Sem áudio'}`);
        console.log(`  ---`);
      });
    }
    
  } catch (error) {
    console.error('Erro ao buscar transcrições:', error.message);
  }
}

getTranscriptions();