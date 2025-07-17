import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Configuração Firebase real do projeto
const firebaseConfig = {
  apiKey: "AIzaSyAFvUSbvTuXuo6KVt4ApG2OSOvXs7AkRx4",
  authDomain: "entrevistaia-cf7b4.firebaseapp.com",
  projectId: "entrevistaia-cf7b4",
  storageBucket: "entrevistaia-cf7b4.firebasestorage.app",
  messagingSenderId: "746157638477",
  appId: "1:746157638477:web:0d55b46c3fbf9a72e8ed04"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function buscarCandidatoPorNumero(numero) {
  console.log(`🔍 Buscando candidatos com número: ${numero}`);
  
  try {
    // Buscar todos os candidatos
    const candidatesRef = collection(db, 'candidates');
    const snapshot = await getDocs(candidatesRef);
    
    console.log(`📊 Total de candidatos no Firebase: ${snapshot.size}`);
    
    const matchingCandidates = [];
    const allCandidates = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const candidate = {
        id: doc.id,
        ...data
      };
      
      allCandidates.push(candidate);
      
      const candidatePhone = data.whatsapp || '';
      
      // Remover caracteres não numéricos para comparação
      const cleanCandidatePhone = candidatePhone.replace(/\D/g, '');
      const cleanSearchPhone = numero.replace(/\D/g, '');
      
      // Verificar se há correspondência exata ou parcial
      if (cleanCandidatePhone === cleanSearchPhone || 
          cleanCandidatePhone.includes(cleanSearchPhone) || 
          cleanSearchPhone.includes(cleanCandidatePhone)) {
        matchingCandidates.push(candidate);
      }
    });
    
    console.log(`\n🎯 RESULTADOS DA BUSCA:`);
    console.log(`📱 Número pesquisado: ${numero}`);
    console.log(`🔢 Candidatos encontrados: ${matchingCandidates.length}`);
    
    if (matchingCandidates.length > 0) {
      console.log(`\n📋 CANDIDATOS ENCONTRADOS:`);
      matchingCandidates.forEach((candidate, index) => {
        console.log(`\n${index + 1}. ${candidate.name || 'Sem nome'}`);
        console.log(`   📱 WhatsApp: ${candidate.whatsapp || 'Não informado'}`);
        console.log(`   📧 Email: ${candidate.email || 'Não informado'}`);
        console.log(`   🏢 Cliente ID: ${candidate.clientId || 'Não informado'}`);
        console.log(`   🆔 ID: ${candidate.id}`);
        if (candidate.createdAt) {
          const date = candidate.createdAt.seconds ? 
            new Date(candidate.createdAt.seconds * 1000) : 
            new Date(candidate.createdAt);
          console.log(`   📅 Criado em: ${date.toLocaleString()}`);
        }
      });
    } else {
      console.log(`\n❌ Nenhum candidato encontrado com o número ${numero}`);
    }
    
    // Mostrar alguns candidatos de exemplo para referência
    console.log(`\n📋 EXEMPLOS DE CANDIDATOS NO SISTEMA:`);
    let count = 0;
    allCandidates.forEach(candidate => {
      if (count < 10 && candidate.whatsapp) {
        console.log(`   ${candidate.name || 'Sem nome'} - ${candidate.whatsapp} (Cliente: ${candidate.clientId})`);
        count++;
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar candidatos:', error);
  }
}

// Executar busca
buscarCandidatoPorNumero('5511996612253')
  .then(() => {
    console.log('\n✅ Busca concluída');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro na busca:', error);
    process.exit(1);
  });
