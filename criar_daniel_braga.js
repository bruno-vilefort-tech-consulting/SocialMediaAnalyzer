import { storage } from './server/storage.js';

async function criarDanielBraga() {
  try {
    console.log('🔧 Criando usuário Daniel Braga para cliente 1749849987543...');
    
    const newUser = await storage.createClientUser({
      name: 'Daniel Braga',
      email: 'daniel.braga@teste.com',
      password: '123456',
      role: 'client',
      clientId: 1749849987543
    });
    
    console.log('✅ Usuário criado com sucesso:', {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      clientId: newUser.clientId,
      role: newUser.role
    });
    
    // Verificar se foi criado corretamente
    const users = await storage.getClientUsers(1749849987543);
    console.log(`📊 Agora existem ${users.length} usuários para o cliente 1749849987543`);
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
  }
}

criarDanielBraga();