import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function atribuirCandidatos() {
  console.log('🔧 Atribuindo candidatos existentes à lista e cliente...\n');
  
  const clienteGrupoMaximunsId = 1749849987543;
  
  // 1. Criar lista "Daniel Infantil"
  console.log('📋 Criando lista "Daniel Infantil"...');
  const listaId = Date.now();
  const novaLista = {
    id: listaId,
    name: "Daniel Infantil",
    description: "Lista com candidatos Daniel e Jacqueline",
    clientId: clienteGrupoMaximunsId,
    createdAt: new Date()
  };
  
  await setDoc(doc(db, 'candidate-lists', listaId.toString()), novaLista);
  console.log(`✅ Lista criada com ID: ${listaId}`);
  
  // 2. Buscar candidatos Daniel e Jacqueline
  console.log('\n🔍 Buscando candidatos existentes...');
  const candidatesRef = collection(db, 'candidates');
  const candidatesSnapshot = await getDocs(candidatesRef);
  
  const candidatosDaniel = [];
  const candidatosJacqueline = [];
  
  candidatesSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.name && data.name.toLowerCase().includes('daniel')) {
      candidatosDaniel.push({ id: doc.id, ...data });
    }
    if (data.name && data.name.toLowerCase().includes('jacqueline')) {
      candidatosJacqueline.push({ id: doc.id, ...data });
    }
  });
  
  console.log(`📊 Encontrados ${candidatosDaniel.length} candidatos Daniel`);
  console.log(`📊 Encontrados ${candidatosJacqueline.length} candidatos Jacqueline`);
  
  // 3. Criar memberships para todos os candidatos
  console.log('\n🔗 Criando memberships...');
  
  const todosCandidatos = [...candidatosDaniel, ...candidatosJacqueline];
  
  for (const candidato of todosCandidatos) {
    // Criar membership
    const membershipId = `${candidato.id}_${listaId}`;
    const membership = {
      candidateId: parseInt(candidato.id),
      listId: listaId,
      clientId: clienteGrupoMaximunsId,
      createdAt: new Date()
    };
    
    await setDoc(doc(db, 'candidate-list-memberships', membershipId), membership);
    console.log(`✅ Membership criado para ${candidato.name} (ID: ${candidato.id})`);
    
    // Atualizar candidato com clientId se não tiver
    if (!candidato.clientId) {
      await updateDoc(doc(db, 'candidates', candidato.id.toString()), {
        clientId: clienteGrupoMaximunsId
      });
      console.log(`✅ Cliente ID atribuído para ${candidato.name}`);
    }
  }
  
  console.log('\n🎉 Todos os candidatos foram atribuídos à lista "Daniel Infantil" e ao cliente "Grupo Maximuns"!');
  
  // 4. Verificar resultados
  console.log('\n📋 Verificando memberships criados...');
  const membershipsRef = collection(db, 'candidate-list-memberships');
  const membershipsSnapshot = await getDocs(membershipsRef);
  
  let count = 0;
  membershipsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.listId === listaId) {
      count++;
      console.log(`   - Candidato ID: ${data.candidateId}, Lista ID: ${data.listId}, Cliente ID: ${data.clientId}`);
    }
  });
  
  console.log(`\n✅ Total de ${count} memberships criados para a lista "Daniel Infantil"`);
}

atribuirCandidatos().catch(console.error);