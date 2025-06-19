/**
 * DEBUG SYSTEM - Monitoramento do fluxo de entrevistas WhatsApp
 * 
 * Este script monitora:
 * 1. Entrevistas criadas/enviadas
 * 2. Respostas de áudio recebidas
 * 3. Processo de transcrição
 * 4. Salvamento no Firebase
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, orderBy, onSnapshot } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyCqEMDFXeUNfpV6qBhkVTYJ8nG_SRJ8PEQ',
  authDomain: 'empresa-dev-7f6ff.firebaseapp.com',
  databaseURL: 'https://empresa-dev-7f6ff.firebaseio.com',
  projectId: 'empresa-dev-7f6ff',
  storageBucket: 'empresa-dev-7f6ff.appspot.com',
  messagingSenderId: '1034137522421',
  appId: '1:1034137522421:web:e2654e7efc3e24a7f831e1'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class InterviewFlowDebugger {
  constructor() {
    this.clientId = 1749849987543; // Cliente Daniel Braga
    this.isMonitoring = false;
    this.listeners = [];
  }

  async startRealTimeMonitoring() {
    console.log('🔍 INICIANDO MONITORAMENTO EM TEMPO REAL');
    console.log('📋 Cliente ID:', this.clientId);
    console.log('🕐 Timestamp:', new Date().toISOString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    this.isMonitoring = true;

    // Monitor 1: Entrevistas
    const interviewsRef = collection(db, 'interviews');
    const interviewsListener = onSnapshot(interviewsRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        
        if (data.clientId === this.clientId) {
          if (change.type === 'added') {
            console.log('🆕 NOVA ENTREVISTA CRIADA:');
            console.log('   📋 ID:', change.doc.id);
            console.log('   👤 Candidato ID:', data.candidateId);
            console.log('   🎯 Seleção ID:', data.selectionId);
            console.log('   📊 Status:', data.status);
            console.log('   🕐 Timestamp:', new Date().toLocaleString());
            console.log('');
          } else if (change.type === 'modified') {
            console.log('📝 ENTREVISTA ATUALIZADA:');
            console.log('   📋 ID:', change.doc.id);
            console.log('   📊 Novo status:', data.status);
            console.log('   🏆 Score total:', data.totalScore);
            console.log('   🕐 Timestamp:', new Date().toLocaleString());
            console.log('');
          }
        }
      });
    });

    // Monitor 2: Respostas
    const responsesRef = collection(db, 'responses');
    const responsesListener = onSnapshot(responsesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        
        if (data.candidateId && typeof data.candidateId === 'number') {
          if (change.type === 'added') {
            console.log('🎵 NOVA RESPOSTA DE ÁUDIO:');
            console.log('   📋 Resposta ID:', change.doc.id);
            console.log('   👤 Candidato ID:', data.candidateId);
            console.log('   🎤 Entrevista ID:', data.interviewId);
            console.log('   🎵 Tem áudio:', !!data.audioFile);
            console.log('   📄 Tem transcrição:', !!data.transcription);
            console.log('   📁 Arquivo:', data.audioFile || 'N/A');
            console.log('   🕐 Timestamp:', new Date().toLocaleString());
            
            if (data.transcription) {
              console.log('   📝 Transcrição:', data.transcription.substring(0, 100) + '...');
            }
            console.log('');
          } else if (change.type === 'modified') {
            console.log('📝 RESPOSTA ATUALIZADA:');
            console.log('   📋 Resposta ID:', change.doc.id);
            console.log('   📄 Transcrição adicionada:', !!data.transcription);
            console.log('   🏆 Score:', data.score);
            console.log('   🕐 Timestamp:', new Date().toLocaleString());
            console.log('');
          }
        }
      });
    });

    // Monitor 3: Seleções
    const selectionsRef = collection(db, 'selections');
    const selectionsQuery = query(selectionsRef, where('clientId', '==', this.clientId));
    const selectionsListener = onSnapshot(selectionsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        
        if (change.type === 'added') {
          console.log('🆕 NOVA SELEÇÃO CRIADA:');
          console.log('   📋 ID:', change.doc.id);
          console.log('   📝 Nome:', data.name);
          console.log('   📊 Status:', data.status);
          console.log('   📋 Lista candidatos:', data.candidateListId);
          console.log('   💼 Vaga ID:', data.jobId);
          console.log('   🕐 Timestamp:', new Date().toLocaleString());
          console.log('');
        } else if (change.type === 'modified') {
          console.log('📝 SELEÇÃO ATUALIZADA:');
          console.log('   📋 ID:', change.doc.id);
          console.log('   📝 Nome:', data.name);
          console.log('   📊 Novo status:', data.status);
          console.log('   🕐 Timestamp:', new Date().toLocaleString());
          console.log('');
        }
      });
    });

    this.listeners = [interviewsListener, responsesListener, selectionsListener];
    
    console.log('✅ MONITORAMENTO ATIVO - Aguardando atividade...');
    console.log('   📺 Monitorando: entrevistas, respostas e seleções');
    console.log('   🔄 Atualizações em tempo real ativadas');
    console.log('   ⏹️  Para parar: Ctrl+C');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  }

  async getCurrentSnapshot() {
    console.log('📊 SNAPSHOT ATUAL DO SISTEMA:');
    console.log('🕐 Timestamp:', new Date().toISOString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Seleções do cliente
      const selectionsRef = collection(db, 'selections');
      const selectionsQuery = query(selectionsRef, where('clientId', '==', this.clientId));
      const selectionsSnapshot = await getDocs(selectionsQuery);
      
      console.log('📋 SELEÇÕES ENCONTRADAS:', selectionsSnapshot.size);
      
      selectionsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   🎯 ${data.name} (ID: ${doc.id}) - Status: ${data.status}`);
      });
      console.log('');

      // Entrevistas do cliente
      const interviewsRef = collection(db, 'interviews');
      const interviewsSnapshot = await getDocs(interviewsRef);
      
      let clientInterviews = 0;
      let clientInterviewsData = [];
      
      interviewsSnapshot.forEach(doc => {
        const data = doc.data();
        
        // Verificar se é do cliente através da seleção
        const isClientInterview = selectionsSnapshot.docs.some(selDoc => 
          parseInt(selDoc.id) === data.selectionId
        );
        
        if (isClientInterview) {
          clientInterviews++;
          clientInterviewsData.push({
            id: doc.id,
            candidateId: data.candidateId,
            selectionId: data.selectionId,
            status: data.status,
            totalScore: data.totalScore
          });
        }
      });
      
      console.log('🎤 ENTREVISTAS ENCONTRADAS:', clientInterviews);
      clientInterviewsData.forEach(interview => {
        console.log(`   📋 Entrevista ${interview.id} - Candidato: ${interview.candidateId} - Status: ${interview.status}`);
      });
      console.log('');

      // Respostas do cliente
      const responsesRef = collection(db, 'responses');
      const responsesSnapshot = await getDocs(responsesRef);
      
      let clientResponses = 0;
      let audioResponses = 0;
      let transcribedResponses = 0;
      
      responsesSnapshot.forEach(doc => {
        const data = doc.data();
        
        // Verificar se é resposta de entrevista do cliente
        const isClientResponse = clientInterviewsData.some(interview => 
          interview.id === data.interviewId
        );
        
        if (isClientResponse) {
          clientResponses++;
          if (data.audioFile) audioResponses++;
          if (data.transcription) transcribedResponses++;
          
          console.log(`   🎵 Resposta ${doc.id}:`);
          console.log(`      - Entrevista: ${data.interviewId}`);
          console.log(`      - Áudio: ${data.audioFile ? '✅' : '❌'}`);
          console.log(`      - Transcrição: ${data.transcription ? '✅' : '❌'}`);
          console.log(`      - Score: ${data.score || 'N/A'}`);
        }
      });
      
      console.log('💬 RESPOSTAS ENCONTRADAS:', clientResponses);
      console.log('🎵 Com áudio:', audioResponses);
      console.log('📄 Com transcrição:', transcribedResponses);
      console.log('');

    } catch (error) {
      console.log('❌ Erro ao obter snapshot:', error.message);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  }

  stop() {
    console.log('⏹️  PARANDO MONITORAMENTO...');
    this.listeners.forEach(listener => listener());
    this.listeners = [];
    this.isMonitoring = false;
    console.log('✅ Monitoramento finalizado');
  }
}

// Função principal
async function runDebug() {
  const debugger = new InterviewFlowDebugger();
  
  // Primeiro, mostrar snapshot atual
  await debugger.getCurrentSnapshot();
  
  // Depois iniciar monitoramento em tempo real
  await debugger.startRealTimeMonitoring();
  
  // Manter o script rodando
  process.on('SIGINT', () => {
    debugger.stop();
    process.exit(0);
  });
}

// Executar se for chamado diretamente
if (require.main === module) {
  runDebug().catch(console.error);
}

module.exports = { InterviewFlowDebugger };