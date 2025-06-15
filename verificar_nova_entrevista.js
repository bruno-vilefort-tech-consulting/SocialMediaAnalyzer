import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

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
  try {
    console.log('🔍 Verificando entrevista ID: 1750023641014 (mais recente dos logs)...');
    
    // Buscar entrevista específica
    const entrevistaDoc = await getDoc(doc(db, "interviews", "1750023641014"));
    
    if (entrevistaDoc.exists()) {
      const entrevista = entrevistaDoc.data();
      console.log('✅ Entrevista encontrada:');
      console.log(`   ID: 1750023641014`);
      console.log(`   Status: ${entrevista.status}`);
      console.log(`   Candidato: ${entrevista.candidateName}`);
      console.log(`   Telefone: ${entrevista.phone}`);
      console.log(`   Seleção: ${entrevista.selectionId}`);
      console.log(`   Job ID: ${entrevista.jobId}`);
      console.log(`   Data: ${entrevista.createdAt ? new Date(entrevista.createdAt.seconds * 1000).toLocaleString('pt-BR') : 'N/A'}`);
      
      // Buscar respostas desta entrevista
      console.log('\n📝 Buscando respostas...');
      const responsesSnapshot = await getDocs(collection(db, "responses"));
      const responses = [];
      
      responsesSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        if (data.interviewId === 1750023641014) {
          responses.push({
            id: docSnapshot.id,
            ...data
          });
        }
      });
      
      console.log(`📊 Total de respostas: ${responses.length}`);
      
      // Mostrar detalhes das respostas
      responses.forEach((response, index) => {
        console.log(`\n💬 Resposta ${index + 1}:`);
        console.log(`   ID: ${response.id}`);
        console.log(`   Pergunta ID: ${response.questionId}`);
        console.log(`   Pergunta: ${response.questionText || 'N/A'}`);
        console.log(`   Transcrição: ${response.transcription || 'N/A'}`);
        console.log(`   Áudio URL: ${response.audioUrl || 'N/A'}`);
        console.log(`   Score: ${response.score || 'N/A'}`);
        console.log(`   Duração: ${response.recordingDuration || 'N/A'}s`);
        console.log(`   AI Analysis: ${response.aiAnalysis || 'N/A'}`);
        console.log(`   Data: ${response.createdAt ? new Date(response.createdAt.seconds * 1000).toLocaleString('pt-BR') : 'N/A'}`);
      });
      
      // Buscar seleção relacionada
      if (entrevista.selectionId) {
        console.log(`\n🎯 Buscando seleção ID: ${entrevista.selectionId}...`);
        const selecaoDoc = await getDoc(doc(db, "selections", entrevista.selectionId.toString()));
        
        if (selecaoDoc.exists()) {
          const selecao = selecaoDoc.data();
          console.log('✅ Seleção encontrada:');
          console.log(`   Nome: ${selecao.name || selecao.nomeSelecao}`);
          console.log(`   Status: ${selecao.status}`);
          console.log(`   Job ID: ${selecao.jobId}`);
        } else {
          console.log('❌ Seleção não encontrada');
        }
      }
      
      // Verificar arquivos de áudio mais recentes
      console.log('\n🎵 Verificando arquivos de áudio mais recentes...');
      try {
        const fs = await import('fs');
        const uploadsPath = './uploads';
        
        if (fs.existsSync(uploadsPath)) {
          const files = fs.readdirSync(uploadsPath);
          const recentAudioFiles = files.filter(file => 
            file.includes('5511984316526') && 
            (file.includes('1750023606') || file.includes('1750023638'))
          );
          
          console.log(`🎵 Arquivos de áudio mais recentes: ${recentAudioFiles.length}`);
          recentAudioFiles.forEach(file => {
            const stats = fs.statSync(`${uploadsPath}/${file}`);
            console.log(`   📁 ${file} (${stats.size} bytes)`);
          });
        }
      } catch (error) {
        console.log('❌ Erro ao verificar arquivos:', error.message);
      }
      
    } else {
      console.log('❌ Entrevista 1750023641014 não encontrada no Firebase');
      
      // Buscar todas as entrevistas para ver IDs disponíveis
      console.log('\n🔍 Buscando todas as entrevistas do Daniel...');
      const allInterviewsSnapshot = await getDocs(collection(db, "interviews"));
      const danielInterviews = [];
      
      allInterviewsSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        if (data.candidateName === 'Daniel Moreira' || data.phone === '11984316526' || data.phone === '5511984316526') {
          danielInterviews.push({
            id: docSnapshot.id,
            status: data.status,
            candidateName: data.candidateName,
            phone: data.phone,
            selectionId: data.selectionId
          });
        }
      });
      
      console.log(`📊 Total de entrevistas do Daniel encontradas: ${danielInterviews.length}`);
      danielInterviews.forEach(interview => {
        console.log(`   🎯 ID: ${interview.id} | Status: ${interview.status} | Seleção: ${interview.selectionId}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar entrevista:', error);
  }
}

verificarNovaEntrevista();