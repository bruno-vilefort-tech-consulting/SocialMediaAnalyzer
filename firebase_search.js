import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

// Configuração Firebase (mesma do projeto)
const firebaseConfig = {
  apiKey: "AIzaSyDSGKzJKbXxwHQeUcgJ1JdOJdSr5FnZDFc",
  authDomain: "maximus-interviewer.firebaseapp.com",
  projectId: "maximus-interviewer",
  storageBucket: "maximus-interviewer.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
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
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const candidatePhone = data.whatsapp || '';
      
      // Remover caracteres não numéricos para comparação
      const cleanCandidatePhone = candidatePhone.replace(/\D/g, '');
      const cleanSearchPhone = numero.replace(/\D/g, '');
      
      // Verificar se há correspondência
      if (cleanCandidatePhone.includes(cleanSearchPhone) || 
          cleanSearchPhone.includes(cleanCandidatePhone)) {
        matchingCandidates.push({
          id: doc.id,
          ...data
        });
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
        console.log(`   📅 Criado em: ${candidate.createdAt ? new Date(candidate.createdAt.seconds * 1000).toLocaleString() : 'Não informado'}`);
      });
    } else {
      console.log(`\n❌ Nenhum candidato encontrado com o número ${numero}`);
    }
    
    // Mostrar alguns candidatos de exemplo para referência
    console.log(`\n📋 EXEMPLOS DE CANDIDATOS NO SISTEMA:`);
    let count = 0;
    snapshot.forEach(doc => {
      if (count < 5) {
        const data = doc.data();
        if (data.whatsapp) {
          console.log(`   ${data.name || 'Sem nome'} - ${data.whatsapp} (Cliente: ${data.clientId})`);
          count++;
        }
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
