import { firebaseDb } from './db';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

export async function debugCandidatesWithInterviews(clientId: number) {
  try {
    console.log(`🔍 Buscando candidatos que iniciaram entrevistas para cliente ${clientId}`);
    
    // Buscar relatórios do cliente no período atual (junho 2025)
    const fromDate = new Date('2025-06-01T03:00:00.000Z');
    const toDate = new Date('2025-07-01T02:59:59.999Z');
    
    const reportsQuery = query(
      collection(firebaseDb, 'reports'),
      where('clientId', '==', clientId),
      where('createdAt', '>=', Timestamp.fromDate(fromDate)),
      where('createdAt', '<=', Timestamp.fromDate(toDate))
    );
    
    const reportsSnapshot = await getDocs(reportsQuery);
    console.log(`📊 Encontrados ${reportsSnapshot.size} relatórios no período`);
    
    const candidatesWithInterviews = [];
    
    for (const reportDoc of reportsSnapshot.docs) {
      const reportData = reportDoc.data();
      
      if (reportData.completedInterviews && reportData.completedInterviews > 0) {
        console.log(`📋 Relatório ${reportData.selectionId}: ${reportData.completedInterviews} entrevistas completadas`);
        
        // Buscar dados dos candidatos neste relatório
        if (reportData.candidatesData && Array.isArray(reportData.candidatesData)) {
          reportData.candidatesData.forEach((candidate: any) => {
            // Verificar se este candidato tem respostas válidas
            if (reportData.responseData && Array.isArray(reportData.responseData)) {
              const candidateResponses = reportData.responseData.filter((response: any) => 
                response.phone === candidate.phone || response.candidatePhone === candidate.phone
              );
              
              if (candidateResponses.length > 0) {
                // Verificar se tem transcrições válidas (entrevista iniciada)
                const hasValidResponses = candidateResponses.some((response: any) => 
                  response.transcription && 
                  response.transcription !== "Aguardando resposta via WhatsApp"
                );
                
                if (hasValidResponses) {
                  candidatesWithInterviews.push({
                    nome: candidate.name || candidate.nome,
                    telefone: candidate.phone,
                    email: candidate.email,
                    selecao: reportData.selectionId,
                    nomeVaga: reportData.jobData?.name || 'Vaga não especificada',
                    totalRespostas: candidateResponses.length,
                    data: reportData.createdAt.toDate().toLocaleDateString('pt-BR')
                  });
                }
              }
            }
          });
        }
      }
    }
    
    console.log(`✅ Total de candidatos que iniciaram entrevistas: ${candidatesWithInterviews.length}`);
    candidatesWithInterviews.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.nome} (${candidate.telefone}) - ${candidate.nomeVaga} - ${candidate.data}`);
    });
    
    return candidatesWithInterviews;
    
  } catch (error) {
    console.error('❌ Erro ao buscar candidatos:', error);
    return [];
  }
}