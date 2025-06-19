const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function verificarEntrevistas() {
  try {
    // Configurar Firebase (usando configuração similar ao storage.ts)
    const serviceAccount = {
      type: 'service_account',
      project_id: 'maximus-interview-system',
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    };

    const app = initializeApp({ credential: cert(serviceAccount) });
    const db = getFirestore(app);

    console.log('🔍 Buscando entrevistas do cliente 1749849987543...');
    
    // Buscar entrevistas
    const interviewsSnapshot = await db.collection('interviews').get();
    let clientInterviews = [];
    
    for (const doc of interviewsSnapshot.docs) {
      const data = doc.data();
      // Filtrar entrevistas do cliente específico através do candidateId
      const candidateSnapshot = await db.collection('candidates').doc(String(data.candidateId)).get();
      if (candidateSnapshot.exists) {
        const candidateData = candidateSnapshot.data();
        if (candidateData.clientId === 1749849987543) {
          clientInterviews.push({ id: doc.id, ...data });
        }
      }
    }
    
    console.log(`📊 Total entrevistas do cliente: ${clientInterviews.length}`);
    
    // Verificar status das entrevistas
    const statusCount = {};
    for (const interview of clientInterviews) {
      statusCount[interview.status] = (statusCount[interview.status] || 0) + 1;
      
      if (interview.status === 'completed') {
        console.log(`✅ Entrevista completada: ${interview.id} - CandidateId: ${interview.candidateId} - SelectionId: ${interview.selectionId}`);
        
        // Buscar respostas desta entrevista
        const responsesSnapshot = await db.collection('responses').where('interviewId', '==', parseInt(interview.id)).get();
        console.log(`   📝 Respostas encontradas: ${responsesSnapshot.size}`);
        
        responsesSnapshot.docs.forEach(responseDoc => {
          const responseData = responseDoc.data();
          console.log(`   -> Resposta ${responseDoc.id}: "${responseData.transcription?.substring(0, 80) || 'Sem transcrição'}..."`);
        });
      }
    }
    
    console.log('\n📈 Status das entrevistas:', statusCount);
    
    // Verificar total de respostas no sistema
    const allResponsesSnapshot = await db.collection('responses').get();
    console.log(`\n📝 Total de respostas no sistema: ${allResponsesSnapshot.size}`);
    
    if (allResponsesSnapshot.size > 0) {
      console.log('\n🔍 Primeiras 5 respostas encontradas:');
      allResponsesSnapshot.docs.slice(0, 5).forEach(doc => {
        const data = doc.data();
        console.log(`   - ID: ${doc.id}, InterviewId: ${data.interviewId}, Transcrição: "${data.transcription?.substring(0, 50) || 'Sem transcrição'}..."`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

verificarEntrevistas();