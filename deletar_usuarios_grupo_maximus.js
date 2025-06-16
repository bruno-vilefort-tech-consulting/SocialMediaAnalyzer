import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./firebase-service-account.json', 'utf8'));
initializeApp({
  credential: cert(serviceAccount),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID
});

const db = getFirestore();

async function deletarUsuariosGrupoMaximus() {
  try {
    console.log('🔍 Buscando usuários do cliente Grupo Maximus (ID: 1749849987543)...');
    
    // Buscar todos os usuários do cliente específico
    const clientUsersRef = db.collection('clientUsers');
    const snapshot = await clientUsersRef.where('clientId', '==', 1749849987543).get();
    
    if (snapshot.empty) {
      console.log('✅ Nenhum usuário encontrado para o cliente Grupo Maximus');
      return;
    }
    
    console.log(`📋 Encontrados ${snapshot.size} usuário(s) para deletar:`);
    
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      const userData = doc.data();
      console.log(`- Usuário: ${userData.name} (${userData.email}) - ID: ${doc.id}`);
      batch.delete(doc.ref);
    });
    
    // Executar deleção em batch
    await batch.commit();
    console.log(`✅ ${snapshot.size} usuário(s) deletado(s) com sucesso do cliente Grupo Maximus!`);
    
  } catch (error) {
    console.error('❌ Erro ao deletar usuários:', error);
  }
}

deletarUsuariosGrupoMaximus();