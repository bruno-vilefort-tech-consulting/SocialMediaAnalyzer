import { FirebaseStorage } from './server/storage';
import bcrypt from 'bcrypt';

async function corrigirUsuarioDaniel() {
  const storage = new FirebaseStorage();
  
  try {
    console.log('🔍 Verificando usuário danielmoreirabraga@gmail.com...');
    
    // Buscar através do método direto no Firebase
    const snapshot = await storage.firestore.collection('users')
      .where('email', '==', 'danielmoreirabraga@gmail.com')
      .get();
    
    if (snapshot.empty) {
      console.log('❌ Usuário não encontrado. Criando...');
      
      const senhaHash = await bcrypt.hash('580190580190', 10);
      const novoUsuario = {
        email: 'danielmoreirabraga@gmail.com',
        password: senhaHash,
        name: 'Daniel Moreira Braga',
        role: 'client',
        clientId: 1749849987543, // Grupo Maximuns
        createdAt: new Date()
      };
      
      const docRef = await storage.firestore.collection('users').add(novoUsuario);
      console.log('✅ Usuário criado com ID:', docRef.id);
      
    } else {
      const doc = snapshot.docs[0];
      const userData = doc.data();
      
      console.log('👤 Usuário encontrado:', {
        id: doc.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        clientId: userData.clientId
      });
      
      // Verificar senha
      if (userData.password) {
        const senhaCorreta = await bcrypt.compare('580190580190', userData.password);
        console.log('🔐 Senha confere:', senhaCorreta);
        
        if (!senhaCorreta) {
          console.log('🔧 Atualizando senha...');
          const novaSenhaHash = await bcrypt.hash('580190580190', 10);
          await doc.ref.update({ password: novaSenhaHash });
          console.log('✅ Senha atualizada');
        }
      }
      
      // Verificar clientId
      if (!userData.clientId) {
        console.log('🔧 Adicionando clientId...');
        await doc.ref.update({ clientId: 1749849987543 });
        console.log('✅ ClientId adicionado');
      }
      
      // Verificar role
      if (userData.role !== 'client') {
        console.log('🔧 Corrigindo role...');
        await doc.ref.update({ role: 'client' });
        console.log('✅ Role corrigida');
      }
    }
    
    console.log('🎯 Verificação/correção concluída');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

corrigirUsuarioDaniel();