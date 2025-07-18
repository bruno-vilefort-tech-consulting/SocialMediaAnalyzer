import { firebaseDb } from './db';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

export async function getInterviewTranscriptions() {
  try {
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
    return [];
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  getInterviewTranscriptions().then((transcriptions) => {
    // Process transcriptions silently
    transcriptions.forEach((data, index) => {
      // Data processed silently
    });
  });
}