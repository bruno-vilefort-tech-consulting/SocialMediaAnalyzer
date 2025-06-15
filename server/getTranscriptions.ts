import { firebaseDb } from './storage';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

export async function getInterviewTranscriptions() {
  try {
    console.log('🔍 Buscando transcrições salvas no Firebase...');
    
    const responsesQuery = query(
      collection(firebaseDb, 'interview_responses'), 
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(responsesQuery);
    const transcriptions: any[] = [];
    
    snapshot.forEach((doc) => {
      transcriptions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return transcriptions;
  } catch (error) {
    console.error('❌ Erro ao buscar transcrições:', error);
    return [];
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  getInterviewTranscriptions().then((transcriptions) => {
    console.log(`\n✅ Encontradas ${transcriptions.length} transcrições:`);
    console.log('='.repeat(60));
    
    transcriptions.forEach((data, index) => {
      console.log(`\n📝 TRANSCRIÇÃO ${index + 1}:`);
      console.log(`ID: ${data.id}`);
      console.log(`Candidato: ${data.candidateName}`);
      console.log(`Telefone: ${data.candidatePhone}`);
      console.log(`Vaga: ${data.jobName}`);
      console.log(`Pergunta ${data.questionId + 1}: ${data.questionText}`);
      console.log(`Resposta: "${data.responseText}"`);
      console.log(`Arquivo de áudio: ${data.audioFile || 'Não salvo'}`);
      console.log(`Data/Hora: ${data.timestamp}`);
      console.log(`Áudio detectado: ${data.hasAudio ? 'Sim' : 'Não'}`);
      console.log(`Transcrição ok: ${data.transcriptionSuccess ? 'Sim' : 'Não'}`);
      console.log('-'.repeat(50));
    });
  });
}