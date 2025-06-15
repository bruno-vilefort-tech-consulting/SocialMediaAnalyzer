import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarEntrevistaDaniel() {
  try {
    console.log('🔍 Verificando entrevista mais recente do Daniel...');
    
    // Buscar todas as entrevistas do Daniel
    const interviewsSnapshot = await getDocs(collection(db, "interviews"));
    const danielInterviews = [];
    
    interviewsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.candidateName === 'Daniel Moreira' || data.phone === '11984316526' || data.phone === '5511984316526') {
        danielInterviews.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    console.log(`📊 Total de entrevistas do Daniel: ${danielInterviews.length}`);
    
    // Mostrar todas as entrevistas do Daniel
    danielInterviews.forEach(interview => {
      console.log(`🎯 Entrevista ID: ${interview.id}`);
      console.log(`   Status: ${interview.status}`);
      console.log(`   Candidato: ${interview.candidateName}`);
      console.log(`   Telefone: ${interview.phone}`);
      console.log(`   Seleção: ${interview.selectionId}`);
      console.log(`   Data: ${interview.createdAt ? new Date(interview.createdAt.seconds * 1000).toLocaleString('pt-BR') : 'N/A'}`);
    });
    
    // Buscar a entrevista mais recente (maior ID)
    const latestInterview = danielInterviews.sort((a, b) => parseInt(b.id) - parseInt(a.id))[0];
    
    if (!latestInterview) {
      console.log('❌ Nenhuma entrevista encontrada para Daniel');
      return;
    }
    
    console.log(`\n🎯 Entrevista mais recente: ${latestInterview.id}`);
    
    // Buscar respostas da entrevista mais recente
    const responsesSnapshot = await getDocs(collection(db, "responses"));
    const responses = [];
    
    responsesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.interviewId === parseInt(latestInterview.id)) {
        responses.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    console.log(`📝 Total de respostas na entrevista ${latestInterview.id}: ${responses.length}`);
    
    // Mostrar detalhes de cada resposta
    responses.forEach((response, index) => {
      console.log(`\n💬 Resposta ${index + 1}:`);
      console.log(`   ID: ${response.id}`);
      console.log(`   Pergunta: ${response.questionText || 'N/A'}`);
      console.log(`   Transcrição: ${response.transcription || 'N/A'}`);
      console.log(`   Áudio URL: ${response.audioUrl || 'N/A'}`);
      console.log(`   Score: ${response.score || 'N/A'}`);
      console.log(`   Duração: ${response.recordingDuration || 'N/A'}`);
      console.log(`   Data: ${response.createdAt ? new Date(response.createdAt.seconds * 1000).toLocaleString('pt-BR') : 'N/A'}`);
    });
    
    // Verificar se há arquivos de áudio na pasta uploads
    console.log('\n🎵 Verificando arquivos de áudio...');
    try {
      const fs = await import('fs');
      const uploadsPath = './uploads';
      
      if (fs.existsSync(uploadsPath)) {
        const files = fs.readdirSync(uploadsPath);
        const audioFiles = files.filter(file => 
          file.includes('5511984316526') || 
          file.includes('11984316526') || 
          file.includes('daniel')
        );
        
        console.log(`🎵 Arquivos de áudio do Daniel encontrados: ${audioFiles.length}`);
        audioFiles.forEach(file => {
          const stats = fs.statSync(`${uploadsPath}/${file}`);
          console.log(`   📁 ${file} (${stats.size} bytes)`);
        });
      } else {
        console.log('📁 Pasta uploads não encontrada');
      }
    } catch (error) {
      console.log('❌ Erro ao verificar arquivos:', error.message);
    }
    
    // Resumo final
    console.log('\n📊 RESUMO:');
    console.log(`✅ Entrevista mais recente: ${latestInterview.id} (${latestInterview.status})`);
    console.log(`✅ Respostas salvas: ${responses.length}`);
    console.log(`✅ Transcrições: ${responses.filter(r => r.transcription).length}`);
    console.log(`✅ Áudios referenciados: ${responses.filter(r => r.audioUrl).length}`);
    
  } catch (error) {
    console.error('❌ Erro ao verificar entrevista:', error);
  }
}

verificarEntrevistaDaniel();