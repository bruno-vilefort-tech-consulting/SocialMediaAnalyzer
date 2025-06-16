import admin from 'firebase-admin';

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(process.env.VITE_FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID
});

const db = admin.firestore();

async function fixJacquelineList() {
  console.log('🔧 Corrigindo lista da Jacqueline...');
  
  try {
    // Buscar a Jacqueline
    const candidatesSnapshot = await db.collection('candidates').get();
    let jacqueline = null;
    
    candidatesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.toLowerCase().includes('jacqueline')) {
        jacqueline = { id: doc.id, ...data };
        console.log(`✅ Jacqueline encontrada: ${data.name} (ID: ${doc.id}) - Lista atual: ${data.listId}`);
      }
    });
    
    if (!jacqueline) {
      console.log('❌ Jacqueline não encontrada');
      return;
    }
    
    // Buscar a seleção "Professora Infantil 2"
    const selectionsSnapshot = await db.collection('selections').get();
    let targetSelection = null;
    
    selectionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.includes('Professora Infantil 2')) {
        targetSelection = { id: doc.id, ...data };
        console.log(`✅ Seleção "Professora Infantil 2" encontrada: ID ${doc.id} - candidateListId: ${data.candidateListId}`);
      }
    });
    
    if (!targetSelection) {
      console.log('❌ Seleção "Professora Infantil 2" não encontrada');
      return;
    }
    
    // Atualizar a lista da Jacqueline para corresponder à seleção correta
    const newListId = targetSelection.candidateListId;
    console.log(`🔄 Atualizando lista da Jacqueline de ${jacqueline.listId} para ${newListId}...`);
    
    await db.collection('candidates').doc(jacqueline.id).update({
      listId: newListId
    });
    
    console.log(`✅ Jacqueline atualizada com sucesso! Lista: ${jacqueline.listId} → ${newListId}`);
    console.log(`🎉 Agora a Jacqueline deve aparecer na seleção "Professora Infantil 2"`);
    
  } catch (error) {
    console.error('❌ Erro ao corrigir lista da Jacqueline:', error);
  }
}

fixJacquelineList().then(() => {
  console.log('🏁 Correção concluída');
  process.exit(0);
}).catch(console.error);