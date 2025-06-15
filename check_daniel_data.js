import admin from 'firebase-admin';

// Inicializar Firebase Admin se não estiver inicializado
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: `firebase-adminsdk-${process.env.VITE_FIREBASE_PROJECT_ID?.split('-')[0]}@${process.env.VITE_FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
      privateKey: process.env.VITE_FIREBASE_API_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

async function checkDanielData() {
  try {
    console.log('🔍 Verificando dados do Daniel Moreira no Firebase...\n');
    
    // 1. Buscar candidatos com nome Daniel
    console.log('📋 CANDIDATOS:');
    const candidatesRef = db.collection('candidates');
    const candidatesSnap = await candidatesRef.get();
    
    candidatesSnap.forEach(doc => {
      const data = doc.data();
      if (data.name?.toLowerCase().includes('daniel')) {
        console.log(`✅ Candidato encontrado: ${data.name} | WhatsApp: ${data.whatsapp} | ID: ${doc.id}`);
      }
    });
    
    // 2. Buscar seleções relacionadas à Faxineira
    console.log('\n📋 SELEÇÕES:');
    const selectionsRef = db.collection('selections');
    const selectionsSnap = await selectionsRef.get();
    
    let faxineiraSelection = null;
    selectionsSnap.forEach(doc => {
      const data = doc.data();
      if (data.name?.toLowerCase().includes('faxineira') || data.jobName?.toLowerCase().includes('faxineira')) {
        console.log(`✅ Seleção encontrada: ${data.name || data.jobName} | ID: ${doc.id}`);
        faxineiraSelection = doc.id;
      }
    });
    
    // 3. Buscar entrevistas do Daniel
    console.log('\n📋 ENTREVISTAS:');
    const interviewsRef = db.collection('interviews');
    const interviewsSnap = await interviewsRef.get();
    
    let danielInterviews = [];
    interviewsSnap.forEach(doc => {
      const data = doc.data();
      if (data.candidateName?.toLowerCase().includes('daniel') || 
          data.phone?.includes('11984316526') ||
          data.phone?.includes('5511984316526')) {
        console.log(`✅ Entrevista Daniel: ID ${doc.id} | Status: ${data.status} | Candidato: ${data.candidateName} | Telefone: ${data.phone}`);
        danielInterviews.push({id: doc.id, ...data});
      }
    });
    
    // 4. Buscar respostas para entrevistas do Daniel
    console.log('\n📋 RESPOSTAS:');
    for (const interview of danielInterviews) {
      const responsesRef = db.collection('responses').where('interviewId', '==', interview.id);
      const responsesSnap = await responsesRef.get();
      
      console.log(`\n🎤 Entrevista ${interview.id} (${interview.status}):`);
      if (responsesSnap.empty) {
        console.log('❌ Nenhuma resposta encontrada');
      } else {
        responsesSnap.forEach(doc => {
          const responseData = doc.data();
          console.log(`✅ Resposta: ${responseData.responseText?.substring(0, 100)}... | Áudio: ${responseData.audioFile ? 'SIM' : 'NÃO'}`);
        });
      }
    }
    
    // 5. Resumo final
    console.log('\n📊 RESUMO:');
    console.log(`🔹 Entrevistas do Daniel encontradas: ${danielInterviews.length}`);
    console.log(`🔹 Entrevistas finalizadas: ${danielInterviews.filter(i => i.status === 'completed').length}`);
    console.log(`🔹 Seleção "Faxineira": ${faxineiraSelection ? 'ENCONTRADA' : 'NÃO ENCONTRADA'}`);
    
  } catch (error) {
    console.error('❌ Erro ao verificar dados:', error);
  }
}

checkDanielData();