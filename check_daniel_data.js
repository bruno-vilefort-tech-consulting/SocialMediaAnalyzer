// Script para verificar dados específicos do Daniel no Firebase
import admin from 'firebase-admin';

// Inicializar Firebase Admin se não estiver inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkDanielData() {
  try {
    console.log('🔍 Verificando dados do Daniel Moreira no Firebase...');
    
    // 1. Buscar entrevista específica 1750021918451
    const interviewDoc = await db.collection('interviews').doc('1750021918451').get();
    console.log('📋 Entrevista encontrada:', interviewDoc.exists);
    if (interviewDoc.exists) {
      console.log('📄 Dados da entrevista:', interviewDoc.data());
    }
    
    // 2. Buscar todas as respostas no Firebase
    const responsesSnapshot = await db.collection('responses').get();
    console.log('💬 Total de respostas no Firebase:', responsesSnapshot.size);
    
    // 3. Filtrar respostas por interviewId 1750021918451
    const danielResponses = [];
    responsesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.interviewId === '1750021918451' || data.interviewId === 1750021918451) {
        danielResponses.push({
          id: doc.id,
          ...data
        });
        console.log('🎯 Resposta encontrada:', {
          id: doc.id,
          interviewId: data.interviewId,
          questionText: data.questionText?.substring(0, 50) + '...'
        });
      }
    });
    
    console.log('📊 Total de respostas do Daniel encontradas:', danielResponses.length);
    
    // 4. Listar todas as respostas com interviewId
    console.log('\n📝 Todas as respostas no Firebase:');
    responsesSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}, interviewId: ${data.interviewId} (tipo: ${typeof data.interviewId})`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkDanielData();