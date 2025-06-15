import admin from 'firebase-admin';

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: `firebase-adminsdk-${process.env.VITE_FIREBASE_PROJECT_ID.split('-')[0]}@${process.env.VITE_FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: `https://${process.env.VITE_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
  });
}

const db = admin.firestore();

async function cleanupFirebaseData() {
  console.log('🧹 Iniciando limpeza de dados problemáticos no Firebase...');
  
  try {
    // Buscar todas as entrevistas
    const interviewsSnapshot = await db.collection('interviews').get();
    let deletedCount = 0;
    
    for (const doc of interviewsSnapshot.docs) {
      const interview = doc.data();
      
      // Deletar entrevistas com candidatos não identificados ou dados inválidos
      const shouldDelete = 
        !interview.candidateName || 
        interview.candidateName === 'Candidato não identificado' ||
        interview.candidateName === 'undefined' ||
        !interview.candidatePhone ||
        interview.candidatePhone === 'Telefone não informado';
      
      if (shouldDelete) {
        console.log(`🗑️ Deletando entrevista ${doc.id}: ${interview.candidateName || 'sem nome'}`);
        await doc.ref.delete();
        deletedCount++;
      }
    }
    
    console.log(`✅ Limpeza concluída! ${deletedCount} entrevistas problemáticas removidas.`);
    
    // Buscar candidatos válidos
    const candidatesSnapshot = await db.collection('candidates').get();
    console.log('\n📋 Candidatos válidos encontrados:');
    
    candidatesSnapshot.docs.forEach(doc => {
      const candidate = doc.data();
      if (candidate.name && candidate.whatsapp) {
        console.log(`- ${candidate.name} (${candidate.whatsapp})`);
      }
    });
    
  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
  }
}

cleanupFirebaseData();