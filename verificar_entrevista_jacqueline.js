
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarEntrevistaJacqueline() {
  console.log('🔍 Verificando entrevistas da Jacqueline no Firebase...');
  
  try {
    // 1. Buscar candidatos com nome Jacqueline
    console.log('\n📝 1. Buscando candidatos Jacqueline...');
    const candidatesRef = collection(db, 'candidates');
    const candidatesSnapshot = await getDocs(candidatesRef);
    
    const jacquelineCandidates = [];
    candidatesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.name && data.name.toLowerCase().includes('jacqueline')) {
        jacquelineCandidates.push({
          id: doc.id,
          name: data.name,
          whatsapp: data.whatsapp,
          email: data.email,
          listId: data.listId,
          clientId: data.clientId
        });
        console.log(`✅ Candidata encontrada: ${data.name} | ID: ${doc.id} | WhatsApp: ${data.whatsapp}`);
      }
    });
    
    if (jacquelineCandidates.length === 0) {
      console.log('❌ Nenhuma candidata Jacqueline encontrada');
      return;
    }
    
    // 2. Buscar entrevistas relacionadas
    console.log('\n🎤 2. Buscando entrevistas...');
    const interviewsRef = collection(db, 'interviews');
    const interviewsSnapshot = await getDocs(interviewsRef);
    
    const jacquelineInterviews = [];
    interviewsSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Buscar por nome do candidato
      if (data.candidateName && data.candidateName.toLowerCase().includes('jacqueline')) {
        jacquelineInterviews.push({
          id: doc.id,
          candidateName: data.candidateName,
          candidateId: data.candidateId,
          phone: data.phone,
          status: data.status,
          selectionId: data.selectionId,
          jobId: data.jobId,
          startTime: data.startTime,
          endTime: data.endTime,
          token: data.token
        });
        console.log(`🎬 Entrevista encontrada: ${doc.id} | Status: ${data.status} | Candidato: ${data.candidateName}`);
      }
      
      // Buscar por ID do candidato
      jacquelineCandidates.forEach(candidate => {
        if (data.candidateId && data.candidateId.toString() === candidate.id.toString()) {
          console.log(`🔗 Entrevista por ID encontrada: ${doc.id} | Candidato ID: ${data.candidateId}`);
          if (!jacquelineInterviews.find(i => i.id === doc.id)) {
            jacquelineInterviews.push({
              id: doc.id,
              candidateName: data.candidateName || candidate.name,
              candidateId: data.candidateId,
              phone: data.phone,
              status: data.status,
              selectionId: data.selectionId,
              jobId: data.jobId,
              startTime: data.startTime,
              endTime: data.endTime,
              token: data.token
            });
          }
        }
      });
    });
    
    // 3. Buscar respostas para as entrevistas encontradas
    console.log('\n💬 3. Buscando respostas das entrevistas...');
    const responsesRef = collection(db, 'responses');
    const responsesSnapshot = await getDocs(responsesRef);
    
    for (const interview of jacquelineInterviews) {
      console.log(`\n📋 Entrevista ${interview.id}:`);
      console.log(`   - Candidato: ${interview.candidateName}`);
      console.log(`   - Status: ${interview.status}`);
      console.log(`   - Seleção ID: ${interview.selectionId}`);
      console.log(`   - Token: ${interview.token}`);
      console.log(`   - Início: ${interview.startTime}`);
      console.log(`   - Fim: ${interview.endTime}`);
      
      const interviewResponses = [];
      responsesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.interviewId && data.interviewId.toString() === interview.id.toString()) {
          interviewResponses.push({
            id: doc.id,
            questionId: data.questionId,
            questionText: data.questionText,
            responseText: data.transcription || data.responseText,
            audioFile: data.audioUrl || data.audioFile,
            timestamp: data.timestamp || data.createdAt
          });
        }
      });
      
      console.log(`   - Respostas: ${interviewResponses.length}`);
      
      if (interviewResponses.length > 0) {
        console.log(`   📝 Detalhes das respostas:`);
        interviewResponses.forEach((response, index) => {
          console.log(`      ${index + 1}. Pergunta ${response.questionId}: ${response.questionText?.substring(0, 50)}...`);
          console.log(`         Resposta: ${response.responseText?.substring(0, 100)}...`);
          console.log(`         Áudio: ${response.audioFile || 'Não disponível'}`);
        });
      }
    }
    
    // 4. Resumo final
    console.log('\n📊 RESUMO FINAL:');
    console.log(`   - Candidatos Jacqueline encontrados: ${jacquelineCandidates.length}`);
    console.log(`   - Entrevistas da Jacqueline: ${jacquelineInterviews.length}`);
    
    const entrevistasFinalizadas = jacquelineInterviews.filter(i => i.status === 'completed');
    console.log(`   - Entrevistas finalizadas: ${entrevistasFinalizadas.length}`);
    
    if (entrevistasFinalizadas.length > 0) {
      console.log('\n✅ ENTREVISTAS FINALIZADAS ENCONTRADAS:');
      entrevistasFinalizadas.forEach(interview => {
        console.log(`   🎯 ID: ${interview.id}`);
        console.log(`   👤 Candidato: ${interview.candidateName}`);
        console.log(`   📞 Telefone: ${interview.phone}`);
        console.log(`   ⏰ Finalizada em: ${interview.endTime}`);
      });
    } else {
      console.log('\n❌ NENHUMA ENTREVISTA FINALIZADA ENCONTRADA');
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar dados:', error);
  }
}

verificarEntrevistaJacqueline();
