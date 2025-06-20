import { collection, getDocs, addDoc, query, where, Timestamp } from "firebase/firestore";
import { firebaseDb } from "./server/db.js";

async function createTestData() {
  console.log('🔍 Buscando dados originais do Daniel Braga...');
  
  try {
    // Buscar candidato original
    const reportCandidatesRef = collection(firebaseDb, 'reportCandidates');
    const candidatesQuery = query(reportCandidatesRef, where('reportId', '==', 'report_1750361142848_1750364164707'));
    const candidatesSnapshot = await getDocs(candidatesQuery);
    
    if (candidatesSnapshot.empty) {
      console.log('❌ Nenhum candidato encontrado');
      return;
    }
    
    const originalCandidateDoc = candidatesSnapshot.docs[0];
    const originalCandidate = originalCandidateDoc.data();
    console.log('✅ Candidato original encontrado:', originalCandidate.name);
    
    // Buscar respostas originais
    const responsesRef = collection(firebaseDb, 'reportResponses');
    const responsesQuery = query(responsesRef, where('reportCandidateId', '==', originalCandidateDoc.id));
    const responsesSnapshot = await getDocs(responsesQuery);
    
    console.log('✅ Encontradas', responsesSnapshot.docs.length, 'respostas originais');
    
    // Criar 10 versões de teste
    for (let i = 1; i <= 10; i++) {
      const newCandidateId = `report_1750361142848_1750364164707_test_${Date.now()}_${i}`;
      
      // Criar novo candidato
      const newCandidate = {
        id: newCandidateId,
        name: `Daniel Braga ${i}`,
        email: `danielbraga${i}@teste.com`,
        whatsapp: `5511984316${String(526 + i).padStart(3, '0')}`,
        originalCandidateId: `${parseInt(originalCandidate.originalCandidateId) + i}`,
        reportId: originalCandidate.reportId,
        status: originalCandidate.status,
        totalScore: originalCandidate.totalScore,
        createdAt: Timestamp.now(),
        completedAt: Timestamp.now()
      };
      
      // Adicionar candidato ao Firebase
      const newCandidateDocRef = await addDoc(reportCandidatesRef, newCandidate);
      console.log(`✅ Candidato criado: ${newCandidate.name}`);
      
      // Duplicar respostas
      for (const responseDoc of responsesSnapshot.docs) {
        const originalResponse = responseDoc.data();
        const newResponse = {
          id: `${newCandidateId}_R${originalResponse.questionNumber}`,
          reportCandidateId: newCandidateDocRef.id,
          reportId: originalResponse.reportId,
          questionNumber: originalResponse.questionNumber,
          questionText: originalResponse.questionText,
          transcription: originalResponse.transcription,
          audioFile: `audio_${newCandidate.whatsapp}_1750361142848_R${originalResponse.questionNumber}.ogg`,
          score: originalResponse.score,
          recordingDuration: originalResponse.recordingDuration,
          aiAnalysis: originalResponse.aiAnalysis,
          createdAt: Timestamp.now()
        };
        
        await addDoc(responsesRef, newResponse);
      }
      
      console.log(`✅ Respostas duplicadas para: ${newCandidate.name}`);
    }
    
    console.log('🎉 10 versões de teste criadas com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao criar dados de teste:', error);
  }
}

createTestData();