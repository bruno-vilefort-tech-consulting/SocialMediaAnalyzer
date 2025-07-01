import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDxg9mJ25E8CUIhJYQFLPMp5kHH4Rg8TQk",
  authDomain: "ia-maximus.firebaseapp.com",
  projectId: "ia-maximus",
  storageBucket: "ia-maximus.firebasestorage.app",
  messagingSenderId: "999999999999",
  appId: "1:999999999999:web:abcdefghijklmnop"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function searchDanielVendedor() {
  console.log("🔍 Procurando Daniel Vendedor em todas as coleções...\n");
  
  try {
    // Buscar em candidates
    console.log("📋 Buscando em 'candidates':");
    const candidatesRef = collection(db, 'candidates');
    const candidatesSnap = await getDocs(candidatesRef);
    
    candidatesSnap.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.toLowerCase().includes('daniel')) {
        console.log(`  ✅ Encontrado em candidates: ${doc.id}`);
        console.log(`     Nome: ${data.name}`);
        console.log(`     ClientId: ${data.clientId}`);
        console.log(`     Email: ${data.email || 'N/A'}`);
        console.log(`     WhatsApp: ${data.whatsapp || 'N/A'}\n`);
      }
    });
    
    // Buscar em interviews
    console.log("📋 Buscando em 'interviews':");
    const interviewsRef = collection(db, 'interviews');
    const interviewsSnap = await getDocs(interviewsRef);
    
    let danielFound = false;
    interviewsSnap.forEach(doc => {
      const data = doc.data();
      if (data.candidateName && data.candidateName.toLowerCase().includes('daniel')) {
        console.log(`  ✅ Encontrado em interviews: ${doc.id}`);
        console.log(`     Candidato: ${data.candidateName}`);
        console.log(`     ClientId: ${data.clientId}`);
        console.log(`     JobId: ${data.jobId}\n`);
        danielFound = true;
      }
    });
    
    if (!danielFound) {
      console.log("  ❌ Daniel não encontrado em interviews\n");
    }
    
    // Buscar em reports
    console.log("📋 Buscando em 'reports':");
    const reportsRef = collection(db, 'reports');
    const reportsSnap = await getDocs(reportsRef);
    
    reportsSnap.forEach(doc => {
      const data = doc.data();
      if (data.candidatesData) {
        data.candidatesData.forEach(candidate => {
          if (candidate.name && candidate.name.toLowerCase().includes('daniel')) {
            console.log(`  ✅ Encontrado em reports: ${doc.id}`);
            console.log(`     Nome: ${candidate.name}`);
            console.log(`     ClientId: ${data.clientId}`);
            console.log(`     Email: ${candidate.email || 'N/A'}\n`);
          }
        });
      }
    });
    
  } catch (error) {
    console.error("❌ Erro ao buscar:", error);
  }
}

searchDanielVendedor().then(() => {
  console.log("🔍 Busca concluída!");
  process.exit(0);
});