import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function limparDadosIncorretos() {
  try {
    console.log('🧹 Limpando dados incorretos do Firebase...');
    
    // 1. Buscar seleção "Faxineira Itaú"
    const selectionsSnapshot = await getDocs(collection(db, "selections"));
    let faxineiraItauSelection = null;
    
    selectionsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.includes('Faxineira Itaú')) {
        faxineiraItauSelection = { id: doc.id, ...data };
        console.log(`✅ Seleção "Faxineira Itaú" encontrada: ${doc.id}`);
      }
    });
    
    if (!faxineiraItauSelection) {
      console.log('❌ Seleção "Faxineira Itaú" não encontrada');
      return;
    }
    
    // 2. Buscar candidatos da Lista 2025 (que deve ter apenas Daniel Braga)
    const candidatesSnapshot = await getDocs(collection(db, "candidates"));
    const danielCandidates = [];
    const otherCandidates = [];
    
    candidatesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.includes('Daniel')) {
        danielCandidates.push({ id: doc.id, ...data });
        console.log(`👤 Daniel encontrado: ${data.name} (${data.whatsapp || data.phone})`);
      } else {
        otherCandidates.push({ id: doc.id, ...data });
      }
    });
    
    console.log(`📊 Candidatos Daniel: ${danielCandidates.length}`);
    console.log(`📊 Outros candidatos: ${otherCandidates.length}`);
    
    // 3. Buscar entrevistas relacionadas à seleção "Faxineira Itaú"
    const interviewsSnapshot = await getDocs(collection(db, "interviews"));
    const faxineiraInterviews = [];
    const otherInterviews = [];
    
    interviewsSnapshot.forEach(doc => {
      const data = doc.data();
      const interviewData = { id: doc.id, ...data };
      
      // Verificar se é entrevista relacionada à "Faxineira Itaú"
      if (
        data.selectionId === parseInt(faxineiraItauSelection.id) || 
        data.selectionId === faxineiraItauSelection.id ||
        (data.candidateName && data.candidateName.includes('Daniel'))
      ) {
        faxineiraInterviews.push(interviewData);
        console.log(`🎯 Entrevista Faxineira Itaú: ${doc.id} - ${data.candidateName} (${data.status})`);
      } else {
        otherInterviews.push(interviewData);
      }
    });
    
    console.log(`📊 Entrevistas Faxineira Itaú: ${faxineiraInterviews.length}`);
    console.log(`📊 Outras entrevistas: ${otherInterviews.length}`);
    
    // 4. Manter apenas as entrevistas mais recentes do Daniel para Faxineira Itaú
    const danielInterviewsForFaxineira = faxineiraInterviews.filter(interview => 
      interview.candidateName && interview.candidateName.includes('Daniel')
    );
    
    // Ordenar por ID (mais recente = maior ID) e manter apenas a mais recente
    const sortedDanielInterviews = danielInterviewsForFaxineira.sort((a, b) => 
      parseInt(b.id) - parseInt(a.id)
    );
    
    const latestDanielInterview = sortedDanielInterviews[0];
    const oldDanielInterviews = sortedDanielInterviews.slice(1);
    
    if (latestDanielInterview) {
      console.log(`✅ Mantendo entrevista mais recente do Daniel: ${latestDanielInterview.id}`);
    }
    
    // 5. Deletar entrevistas antigas do Daniel
    console.log(`🗑️ Deletando ${oldDanielInterviews.length} entrevistas antigas do Daniel...`);
    for (const interview of oldDanielInterviews) {
      await deleteDoc(doc(db, "interviews", interview.id));
      console.log(`❌ Entrevista deletada: ${interview.id}`);
    }
    
    // 6. Deletar entrevistas de outros candidatos que não deveriam estar na seleção Faxineira Itaú
    const wrongInterviews = faxineiraInterviews.filter(interview => 
      !interview.candidateName || !interview.candidateName.includes('Daniel')
    );
    
    console.log(`🗑️ Deletando ${wrongInterviews.length} entrevistas incorretas...`);
    for (const interview of wrongInterviews) {
      await deleteDoc(doc(db, "interviews", interview.id));
      console.log(`❌ Entrevista incorreta deletada: ${interview.id}`);
    }
    
    // 7. Buscar e limpar respostas órfãs (que não pertencem à entrevista válida)
    const responsesSnapshot = await getDocs(collection(db, "responses"));
    const validResponsesCount = [];
    const orphanResponses = [];
    
    responsesSnapshot.forEach(doc => {
      const data = doc.data();
      if (latestDanielInterview && data.interviewId === parseInt(latestDanielInterview.id)) {
        validResponsesCount.push({ id: doc.id, ...data });
      } else {
        // Verificar se a entrevista ainda existe
        const interviewExists = faxineiraInterviews.some(interview => 
          data.interviewId === parseInt(interview.id)
        );
        if (!interviewExists) {
          orphanResponses.push({ id: doc.id, ...data });
        }
      }
    });
    
    console.log(`📝 Respostas válidas da entrevista do Daniel: ${validResponsesCount.length}`);
    console.log(`🗑️ Deletando ${orphanResponses.length} respostas órfãs...`);
    
    for (const response of orphanResponses) {
      await deleteDoc(doc(db, "responses", response.id));
      console.log(`❌ Resposta órfã deletada: ${response.id}`);
    }
    
    // 8. Resumo final
    console.log('\n📊 RESUMO DA LIMPEZA:');
    console.log(`✅ Seleção "Faxineira Itaú": ${faxineiraItauSelection.id}`);
    console.log(`✅ Entrevista válida do Daniel: ${latestDanielInterview ? latestDanielInterview.id : 'Nenhuma'}`);
    console.log(`✅ Respostas válidas: ${validResponsesCount.length}`);
    console.log(`🗑️ Entrevistas antigas deletadas: ${oldDanielInterviews.length}`);
    console.log(`🗑️ Entrevistas incorretas deletadas: ${wrongInterviews.length}`);
    console.log(`🗑️ Respostas órfãs deletadas: ${orphanResponses.length}`);
    
    if (validResponsesCount.length > 0) {
      console.log('\n💬 RESPOSTAS VÁLIDAS DO DANIEL:');
      validResponsesCount.forEach((response, index) => {
        console.log(`   ${index + 1}. ${response.transcription || 'Sem transcrição'}`);
        console.log(`      Áudio: ${response.audioUrl || 'Sem áudio'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao limpar dados:', error);
  }
}

limparDadosIncorretos();