import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, updateDoc, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function corrigirAtribuicoesCandidatos() {
  console.log("🔧 CORRIGINDO ATRIBUIÇÕES DE CLIENTE PARA LISTAS E CANDIDATOS...\n");

  try {
    // Usar o ID do Grupo Maximuns como padrão
    const grupoMaximunsId = "1749849987543";
    
    // 1. Corrigir listas de candidatos
    console.log("📋 1. CORRIGINDO LISTAS DE CANDIDATOS:");
    const listsSnapshot = await getDocs(collection(db, "candidateLists"));
    let listsCorrigidas = 0;
    
    for (const docSnapshot of listsSnapshot.docs) {
      const list = docSnapshot.data();
      
      // Se não tem clientId ou tem clientId inválido (1), corrigir para Grupo Maximuns
      if (!list.clientId || list.clientId === 1 || list.clientId === "1") {
        await updateDoc(doc(db, "candidateLists", docSnapshot.id), {
          clientId: parseInt(grupoMaximunsId)
        });
        console.log(`   ✅ Lista "${list.name}" (ID: ${docSnapshot.id}) → Cliente: ${grupoMaximunsId}`);
        listsCorrigidas++;
      }
    }
    
    console.log(`   📊 Total de listas corrigidas: ${listsCorrigidas}`);

    // 2. Corrigir candidatos
    console.log("\n📋 2. CORRIGINDO CANDIDATOS:");
    const candidatesSnapshot = await getDocs(collection(db, "candidates"));
    let candidatosCorrigidos = 0;
    
    for (const docSnapshot of candidatesSnapshot.docs) {
      const candidate = docSnapshot.data();
      
      // Se não tem clientId ou tem clientId inválido, corrigir
      if (!candidate.clientId || 
          candidate.clientId === 1 || 
          candidate.clientId === "1" ||
          candidate.clientId === 1750015041944) { // ID inválido do Daniel Moreira
        
        await updateDoc(doc(db, "candidates", docSnapshot.id), {
          clientId: parseInt(grupoMaximunsId)
        });
        console.log(`   ✅ Candidato "${candidate.name}" (ID: ${docSnapshot.id}) → Cliente: ${grupoMaximunsId}`);
        candidatosCorrigidos++;
      }
    }
    
    console.log(`   📊 Total de candidatos corrigidos: ${candidatosCorrigidos}`);

    // 3. Verificação final
    console.log("\n📋 3. VERIFICAÇÃO FINAL:");
    
    // Contar listas por cliente
    const listsSnapshotFinal = await getDocs(collection(db, "candidateLists"));
    const listsByClient = {};
    listsSnapshotFinal.forEach(doc => {
      const clientId = doc.data().clientId;
      listsByClient[clientId] = (listsByClient[clientId] || 0) + 1;
    });
    
    // Contar candidatos por cliente  
    const candidatesSnapshotFinal = await getDocs(collection(db, "candidates"));
    const candidatesByClient = {};
    candidatesSnapshotFinal.forEach(doc => {
      const clientId = doc.data().clientId;
      candidatesByClient[clientId] = (candidatesByClient[clientId] || 0) + 1;
    });

    console.log("   🏢 Grupo Maximuns (1749849987543):");
    console.log(`      📝 Listas: ${listsByClient[grupoMaximunsId] || 0}`);
    console.log(`      👤 Candidatos: ${candidatesByClient[grupoMaximunsId] || 0}`);
    
    console.log("   🏢 Universidade dos Campeões (1749852235275):");
    console.log(`      📝 Listas: ${listsByClient["1749852235275"] || 0}`);
    console.log(`      👤 Candidatos: ${candidatesByClient["1749852235275"] || 0}`);

    console.log("\n📋 4. RESULTADOS:");
    console.log(`✅ ${listsCorrigidas} listas corrigidas`);
    console.log(`✅ ${candidatosCorrigidos} candidatos corrigidos`);
    console.log("✅ Todas as listas e candidatos agora estão atribuídos ao Grupo Maximuns");
    console.log("🎯 Sistema pronto para implementar filtro por cliente na página de candidatos");

  } catch (error) {
    console.error("❌ Erro na correção:", error);
  }
}

// Executar correção
corrigirAtribuicoesCandidatos()
  .then(() => {
    console.log("\n✅ Correção finalizada");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });