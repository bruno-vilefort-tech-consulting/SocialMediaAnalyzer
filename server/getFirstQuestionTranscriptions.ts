import { firebaseDb } from './db';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function getFirstQuestionTranscriptions(clientId: number) {
  try {
    console.log(`🔍 Buscando transcrições da primeira pergunta para cliente ${clientId}`);
    
    // Buscar todas as transcrições da primeira pergunta (R1)
    const transcriptionsQuery = query(
      collection(firebaseDb, 'transcriptions'),
      where('clientId', '==', clientId),
      where('questionNumber', '==', 1)
    );
    
    const transcriptionsSnapshot = await getDocs(transcriptionsQuery);
    console.log(`📄 Encontradas ${transcriptionsSnapshot.size} transcrições da primeira pergunta`);
    
    const transcriptions = [];
    
    transcriptionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.transcription && data.transcription !== "Aguardando resposta via WhatsApp") {
        transcriptions.push({
          candidateId: data.candidateId,
          phone: data.phone,
          questionText: data.questionText,
          transcription: data.transcription,
          score: data.score,
          selectionId: data.selectionId,
          timestamp: data.timestamp
        });
      }
    });
    
    // Ordenar por timestamp para pegar os mais recentes
    transcriptions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    console.log(`✅ Retornando ${transcriptions.length} transcrições válidas da primeira pergunta`);
    return transcriptions.slice(0, 3); // Retornar apenas os 3 primeiros
    
  } catch (error) {
    console.error('❌ Erro ao buscar transcrições:', error);
    return [];
  }
}