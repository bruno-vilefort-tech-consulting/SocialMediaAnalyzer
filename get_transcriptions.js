// Script para buscar transcrições do Firebase
const admin = require('firebase-admin');

// Configurar Firebase Admin (usando as mesmas credenciais do projeto)
const serviceAccount = {
  type: "service_account",
  project_id: process.env.VITE_FIREBASE_PROJECT_ID,
  // Usar credenciais simplificadas para acesso aos dados
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID
  });
}

const db = admin.firestore();

async function getTranscriptions() {
  try {
    console.log('🔍 Buscando transcrições salvas no Firebase...');
    
    const snapshot = await db.collection('interview_responses')
      .orderBy('timestamp', 'desc')
      .get();

    if (snapshot.empty) {
      console.log('❌ Nenhuma transcrição encontrada na coleção interview_responses');
      return;
    }

    console.log(`✅ Encontradas ${snapshot.size} transcrições:`);
    console.log('=' * 60);
    
    snapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n📝 TRANSCRIÇÃO ${index + 1}:`);
      console.log(`ID: ${doc.id}`);
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

  } catch (error) {
    console.error('❌ Erro ao buscar transcrições:', error.message);
  }
}

getTranscriptions();