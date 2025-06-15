import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function limparEntrevistasFirebase() {
  console.log('🧹 Iniciando limpeza completa das entrevistas no Firebase...');
  
  try {
    // 1. Deletar todas as respostas (responses)
    console.log('\n📋 Deletando respostas das entrevistas...');
    const responsesSnapshot = await getDocs(collection(db, 'responses'));
    let deletedResponses = 0;
    
    for (const responseDoc of responsesSnapshot.docs) {
      await deleteDoc(doc(db, 'responses', responseDoc.id));
      deletedResponses++;
    }
    console.log(`✅ ${deletedResponses} respostas deletadas`);

    // 2. Deletar todas as entrevistas
    console.log('\n🎯 Deletando entrevistas...');
    const interviewsSnapshot = await getDocs(collection(db, 'interviews'));
    let deletedInterviews = 0;
    
    for (const interviewDoc of interviewsSnapshot.docs) {
      await deleteDoc(doc(db, 'interviews', interviewDoc.id));
      deletedInterviews++;
    }
    console.log(`✅ ${deletedInterviews} entrevistas deletadas`);

    // 3. Deletar todas as seleções (selections)
    console.log('\n📊 Deletando seleções...');
    const selectionsSnapshot = await getDocs(collection(db, 'selections'));
    let deletedSelections = 0;
    
    for (const selectionDoc of selectionsSnapshot.docs) {
      await deleteDoc(doc(db, 'selections', selectionDoc.id));
      deletedSelections++;
    }
    console.log(`✅ ${deletedSelections} seleções deletadas`);

    // 4. Deletar logs de mensagens (message_logs)
    console.log('\n📝 Deletando logs de mensagens...');
    const messageLogsSnapshot = await getDocs(collection(db, 'message_logs'));
    let deletedMessageLogs = 0;
    
    for (const messageLogDoc of messageLogsSnapshot.docs) {
      await deleteDoc(doc(db, 'message_logs', messageLogDoc.id));
      deletedMessageLogs++;
    }
    console.log(`✅ ${deletedMessageLogs} logs de mensagens deletados`);

    // 5. Verificar se restaram dados
    console.log('\n🔍 Verificando limpeza...');
    
    const remainingInterviews = await getDocs(collection(db, 'interviews'));
    const remainingResponses = await getDocs(collection(db, 'responses'));
    const remainingSelections = await getDocs(collection(db, 'selections'));
    const remainingMessageLogs = await getDocs(collection(db, 'message_logs'));
    
    console.log(`📊 Dados restantes:`);
    console.log(`   - Entrevistas: ${remainingInterviews.size}`);
    console.log(`   - Respostas: ${remainingResponses.size}`);
    console.log(`   - Seleções: ${remainingSelections.size}`);
    console.log(`   - Logs: ${remainingMessageLogs.size}`);

    if (remainingInterviews.size === 0 && remainingResponses.size === 0 && 
        remainingSelections.size === 0 && remainingMessageLogs.size === 0) {
      console.log('\n🎉 Limpeza completa realizada com sucesso!');
      console.log('📊 Dashboard agora mostrará: 0 entrevistas realizadas, 0 pendentes');
    } else {
      console.log('\n⚠️ Alguns dados ainda permanecem no sistema');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
  }
}

limparEntrevistasFirebase();