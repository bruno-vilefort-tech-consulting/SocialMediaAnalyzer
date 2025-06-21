/**
 * Script para criar 20 candidatos fictícios baseados no Daniel Vendedor
 * com transcrições e áudios para o relatório "Comercial 5"
 */

import { firebaseDb } from "./db";
import { collection, doc, setDoc, addDoc, Timestamp, getDocs } from "firebase/firestore";

// Dados base do Daniel Vendedor existente
const baseCandidate = {
  id: 1750448249756,
  name: 'Daniel Vendedor',
  email: 'danielmoreirabraga@gmail.com',
  whatsapp: '5511984316526',
  clientId: 1749849987543
};

// Transcrições reais do Daniel Vendedor para replicar
const transcriptions = [
  "Eu costumo saber como é que tá a empresa, qual segmento que ela atua, quais são os produtos que ela vende...",
  "Eu primeiro preciso entender o porquê isso aconteceu, se foi alguma coisa que eu fiz de errado..."
];

// Scores reais para replicar
const scores = [75, 65];

// Lista de nomes fictícios
const fictionalNames = [
  "Carlos Silva", "Ana Paula", "Roberto Santos", "Mariana Costa", "Felipe Oliveira",
  "Juliana Rocha", "Eduardo Lima", "Fernanda Alves", "Ricardo Pereira", "Camila Souza",
  "Gustavo Martins", "Larissa Ferreira", "Diego Campos", "Isabela Moura", "Bruno Cardoso",
  "Natália Barbosa", "Thiago Nascimento", "Priscila Dias", "André Ribeiro", "Letícia Cruz"
];

export async function createTestCandidates() {
  console.log("🚀 Iniciando criação de 20 candidatos fictícios...");

  const clientId = 1749849987543; // Grupo Maximuns
  const selectionId = "1750476614396"; // Comercial 5
  const listId = 1750448724282; // Lista de candidatos existente

  try {
    for (let i = 0; i < 20; i++) {
      const candidateId = Date.now() + i; // ID único baseado em timestamp
      const phone = `551198431${String(6527 + i).padStart(4, '0')}`; // Telefones sequenciais
      
      // 1. Criar candidato
      const candidateData = {
        id: candidateId,
        name: `${fictionalNames[i]} ${i + 1}`,
        email: `vendedor${i + 1}@teste.com`,
        whatsapp: phone,
        clientId: clientId,
        createdAt: Timestamp.now()
      };

      await setDoc(doc(firebaseDb, "candidates", candidateId.toString()), candidateData);
      console.log(`✅ Candidato criado: ${candidateData.name} (ID: ${candidateId})`);

      // 2. Adicionar à lista de candidatos
      const membershipData = {
        id: `${candidateId}_${listId}`,
        candidateId: candidateId,
        listId: listId,
        clientId: clientId,
        createdAt: Timestamp.now()
      };

      await setDoc(doc(firebaseDb, "candidateListMemberships", membershipData.id), membershipData);
      console.log(`📋 Adicionado à lista: ${candidateData.name}`);

      // 3. Criar transcrições para cada pergunta
      for (let j = 0; j < transcriptions.length; j++) {
        const transcriptionId = `candidate_${selectionId}_${phone}_R${j + 1}`;
        
        const transcriptionData = {
          id: transcriptionId,
          candidateId: `candidate_${selectionId}_${phone}`,
          phone: phone,
          selectionId: selectionId,
          clientId: clientId,
          questionNumber: j + 1,
          questionText: j === 0 
            ? "Como você costuma abordar um cliente que está resistente à compra?"
            : "Descreva como você lidaria com uma objeção de preço de um cliente.",
          transcription: transcriptions[j],
          audioFile: `audio_${phone}_${selectionId}_R${j + 1}.ogg`,
          score: scores[j],
          timestamp: Timestamp.now().toDate().toISOString(),
          processed: true
        };

        await setDoc(doc(firebaseDb, "transcriptions", transcriptionId), transcriptionData);
        console.log(`🎤 Transcrição ${j + 1} criada para ${candidateData.name}`);
      }

      // 4. Criar entrevista na coleção interviews
      const interviewData = {
        id: `interview_${selectionId}_${candidateId}`,
        candidateId: candidateId,
        selectionId: selectionId,
        clientId: clientId,
        phone: phone,
        candidateName: candidateData.name,
        status: "completed",
        totalQuestions: 2,
        completedQuestions: 2,
        totalScore: Math.round((scores[0] + scores[1]) / 2), // Média dos scores
        startedAt: Timestamp.now(),
        completedAt: Timestamp.now(),
        createdAt: Timestamp.now()
      };

      await setDoc(doc(firebaseDb, "interviews", interviewData.id), interviewData);
      console.log(`📝 Entrevista criada para ${candidateData.name}`);

      // Delay para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log("🎉 Todos os 20 candidatos fictícios foram criados com sucesso!");
    console.log("📊 Dados criados:");
    console.log("- 20 candidatos novos");
    console.log("- 20 memberships na lista");
    console.log("- 40 transcrições (2 por candidato)");
    console.log("- 20 entrevistas completas");
    console.log("- Todos vinculados ao relatório 'Comercial 5'");

  } catch (error) {
    console.error("❌ Erro ao criar candidatos fictícios:", error);
    throw error;
  }
}

// Função para limpar os dados de teste (se necessário)
export async function cleanTestCandidates() {
  console.log("🧹 Limpando candidatos de teste...");
  // Esta função pode ser implementada se necessário para remover os dados de teste
  console.log("⚠️ Função de limpeza não implementada - dados devem ser removidos manualmente se necessário");
}

// Função auxiliar para verificar se candidatos de teste já existem
export async function checkTestCandidatesExist(): Promise<boolean> {
  try {
    const testEmails = ['vendedor1@teste.com', 'vendedor2@teste.com', 'vendedor3@teste.com'];
    const candidatesRef = collection(firebaseDb, "candidates");
    
    for (const email of testEmails) {
      const candidates = await getDocs(candidatesRef);
      const exists = candidates.docs.some(doc => doc.data().email === email);
      if (exists) return true;
    }
    return false;
  } catch (error) {
    console.error("Erro ao verificar candidatos de teste:", error);
    return false;
  }
}