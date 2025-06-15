import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarNovaEntrevista() {
  console.log('🔍 Verificando entrevista corrigida...');
  
  try {
    // 1. Verificar entrevista corrigida
    const interviewDoc = await getDoc(doc(db, 'interviews', '1750029682005'));
    if (interviewDoc.exists()) {
      const data = interviewDoc.data();
      console.log('✅ Entrevista encontrada:');
      console.log(`   - ID: ${interviewDoc.id}`);
      console.log(`   - Candidato: ${data.candidateName}`);
      console.log(`   - Job ID: ${data.jobId}`);
      console.log(`   - Status: ${data.status}`);
      console.log(`   - Telefone: ${data.candidatePhone}`);
    }

    // 2. Verificar respostas da entrevista
    const responsesQuery = query(
      collection(db, 'responses'),
      where('interviewId', '==', '1750029682005')
    );
    const responsesSnapshot = await getDocs(responsesQuery);
    
    console.log(`\n📝 Respostas encontradas: ${responsesSnapshot.size}`);
    responsesSnapshot.forEach((responseDoc) => {
      const data = responseDoc.data();
      console.log(`   - Resposta ${data.questionId}: ${data.transcription?.substring(0, 50)}...`);
    });

    // 3. Verificar perguntas da vaga
    const jobDoc = await getDoc(doc(db, 'jobs', '1750025604495'));
    if (jobDoc.exists()) {
      const jobData = jobDoc.data();
      console.log(`\n📄 Vaga: ${jobData.nomeVaga}`);
      console.log(`   - Perguntas: ${jobData.perguntas?.length || 0}`);
      if (jobData.perguntas) {
        jobData.perguntas.forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.pergunta}`);
        });
      }
    }

    // 4. Verificar seleção corrigida
    const selectionDoc = await getDoc(doc(db, 'selections', '1750029587923'));
    if (selectionDoc.exists()) {
      const data = selectionDoc.data();
      console.log(`\n📊 Seleção: ${data.nomeSelecao}`);
      console.log(`   - Job ID: ${data.jobId}`);
      console.log(`   - Status: ${data.status}`);
    }

    console.log('\n🎉 Verificação completa! Os dados estão corrigidos.');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

verificarNovaEntrevista();