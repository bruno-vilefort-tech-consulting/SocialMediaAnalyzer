// Script simples para verificar dados do Daniel Moreira no sistema
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function verificarDaniel() {
  try {
    // Fazer request direto para o sistema
    const response = await fetch('http://localhost:5000/api/interview-responses', {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log('❌ Erro na API:', response.status);
      return;
    }
    
    const data = await response.json();
    console.log('📊 Total de entrevistas encontradas:', data.length);
    
    // Filtrar entrevistas do Daniel
    const danielInterviews = data.filter(interview => 
      interview.candidateName?.toLowerCase().includes('daniel') ||
      interview.phone?.includes('11984316526')
    );
    
    console.log('\n🔍 ENTREVISTAS DO DANIEL MOREIRA:');
    console.log(`Total: ${danielInterviews.length}`);
    
    danielInterviews.forEach((interview, index) => {
      console.log(`\n${index + 1}. Entrevista ID: ${interview.id}`);
      console.log(`   Status: ${interview.status}`);
      console.log(`   Candidato: ${interview.candidateName}`);
      console.log(`   Telefone: ${interview.phone}`);
      console.log(`   Vaga: ${interview.jobName}`);
      console.log(`   Respostas: ${interview.responses ? interview.responses.length : 0}`);
      
      if (interview.responses && interview.responses.length > 0) {
        console.log('   📝 Respostas encontradas:');
        interview.responses.forEach((resp, i) => {
          console.log(`      ${i + 1}. ${resp.questionText}`);
          console.log(`         Resposta: ${resp.responseText?.substring(0, 100)}...`);
          console.log(`         Áudio: ${resp.audioFile ? 'SIM' : 'NÃO'}`);
        });
      }
    });
    
    // Contar status
    const statusCount = {
      completed: danielInterviews.filter(i => i.status === 'completed').length,
      in_progress: danielInterviews.filter(i => i.status === 'in_progress').length,
      pending: danielInterviews.filter(i => i.status === 'pending').length
    };
    
    console.log('\n📈 RESUMO:');
    console.log(`✅ Finalizadas: ${statusCount.completed}`);
    console.log(`🔄 Em andamento: ${statusCount.in_progress}`);
    console.log(`⏳ Pendentes: ${statusCount.pending}`);
    
    // Verificar se existe entrevista finalizada da "Faxineira Banco"
    const faxineiraCompleted = danielInterviews.filter(i => 
      i.status === 'completed' && 
      (i.jobName?.toLowerCase().includes('faxineira') || 
       i.selectionName?.toLowerCase().includes('faxineira'))
    );
    
    console.log(`\n🎯 ENTREVISTAS FINALIZADAS FAXINEIRA: ${faxineiraCompleted.length}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificarDaniel();