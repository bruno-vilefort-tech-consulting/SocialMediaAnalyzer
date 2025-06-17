import { FirebaseStorage } from './server/storage.ts';
import bcrypt from 'bcrypt';

async function fixDanielLogin() {
  console.log('🔧 Iniciando correção do login do Daniel...');
  
  try {
    const storage = new FirebaseStorage();
    
    // Buscar usuário por email
    const usersSnapshot = await storage.firestore.collection('users')
      .where('email', '==', 'danielmoreirabraga@gmail.com')
      .get();
    
    if (usersSnapshot.empty) {
      console.log('❌ Usuário não encontrado. Criando novo usuário...');
      
      // Criar novo usuário
      const hashedPassword = await bcrypt.hash('580190580190', 10);
      const newUser = {
        email: 'danielmoreirabraga@gmail.com',
        password: hashedPassword,
        name: 'Daniel Moreira Braga',
        role: 'client',
        clientId: 1749849987543, // Grupo Maximuns
        createdAt: new Date()
      };
      
      const docRef = await storage.firestore.collection('users').add(newUser);
      console.log('✅ Usuário criado com sucesso. ID:', docRef.id);
      
    } else {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      
      console.log('👤 Usuário encontrado:', {
        id: userDoc.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        clientId: userData.clientId
      });
      
      // Verificar e corrigir senha
      const passwordCorrect = await bcrypt.compare('580190580190', userData.password || '');
      console.log('🔐 Senha atual válida:', passwordCorrect);
      
      const updates = {};
      
      if (!passwordCorrect) {
        console.log('🔧 Atualizando senha...');
        updates.password = await bcrypt.hash('580190580190', 10);
      }
      
      if (!userData.clientId || userData.clientId !== 1749849987543) {
        console.log('🔧 Corrigindo clientId...');
        updates.clientId = 1749849987543;
      }
      
      if (userData.role !== 'client') {
        console.log('🔧 Corrigindo role...');
        updates.role = 'client';
      }
      
      if (Object.keys(updates).length > 0) {
        await userDoc.ref.update(updates);
        console.log('✅ Dados atualizados:', Object.keys(updates));
      } else {
        console.log('✅ Dados já estão corretos');
      }
    }
    
    // Testar login simulado
    console.log('\n🧪 Testando credenciais...');
    const testSnapshot = await storage.firestore.collection('users')
      .where('email', '==', 'danielmoreirabraga@gmail.com')
      .get();
    
    if (!testSnapshot.empty) {
      const testUser = testSnapshot.docs[0].data();
      const loginTest = await bcrypt.compare('580190580190', testUser.password);
      
      console.log('🎯 Resultado do teste de login:');
      console.log('  Email:', testUser.email);
      console.log('  Role:', testUser.role);
      console.log('  ClientId:', testUser.clientId);
      console.log('  Senha válida:', loginTest);
      console.log('  Status:', loginTest ? '✅ LOGIN FUNCIONAL' : '❌ SENHA INCORRETA');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

fixDanielLogin();