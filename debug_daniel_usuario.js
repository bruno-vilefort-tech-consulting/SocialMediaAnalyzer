import { FirebaseStorage } from './server/storage.ts';
import bcrypt from 'bcrypt';

async function debugDanielUsuario() {
  const storage = new FirebaseStorage();
  
  try {
    console.log('🔍 Buscando usuário danielmoreirabraga@gmail.com...');
    
    // Buscar todos os usuários para verificar
    const users = await storage.getUsers();
    console.log(`📊 Total de usuários no sistema: ${users.length}`);
    
    // Buscar especificamente o Daniel
    const daniel = users.find(u => u.email === 'danielmoreirabraga@gmail.com');
    
    if (!daniel) {
      console.log('❌ Usuário Daniel não encontrado');
      console.log('📋 Usuários existentes:');
      users.forEach(u => {
        console.log(`  - ${u.email} (${u.role}) ${u.clientId ? `- Cliente: ${u.clientId}` : ''}`);
      });
      
      console.log('\n🔧 Criando usuário Daniel...');
      const senhaHash = await bcrypt.hash('580190580190', 10);
      
      const novoUsuario = await storage.createUser({
        email: 'danielmoreirabraga@gmail.com',
        password: senhaHash,
        name: 'Daniel Moreira Braga',
        role: 'client',
        clientId: 1749849987543 // Grupo Maximuns
      });
      
      console.log('✅ Usuário Daniel criado:', novoUsuario);
      return;
    }
    
    console.log('👤 Usuário Daniel encontrado:', {
      id: daniel.id,
      email: daniel.email,
      name: daniel.name,
      role: daniel.role,
      clientId: daniel.clientId,
      hasPassword: !!daniel.password
    });
    
    // Verificar se a senha está correta
    if (daniel.password) {
      const senhaCorreta = await bcrypt.compare('580190580190', daniel.password);
      console.log('🔐 Senha 580190580190 confere:', senhaCorreta);
      
      if (!senhaCorreta) {
        console.log('🔧 Atualizando senha do usuário Daniel...');
        const novaSenhaHash = await bcrypt.hash('580190580190', 10);
        
        await storage.updateUser(daniel.id, {
          password: novaSenhaHash
        });
        
        console.log('✅ Senha atualizada com sucesso');
      }
    }
    
    // Verificar se tem clientId
    if (!daniel.clientId) {
      console.log('🔧 Adicionando clientId ao usuário Daniel...');
      await storage.updateUser(daniel.id, {
        clientId: 1749849987543 // Grupo Maximuns
      });
      console.log('✅ ClientId adicionado');
    }
    
    // Buscar dados finais
    const danielAtualizado = await storage.getUserById(daniel.id);
    console.log('🎯 Dados finais do usuário Daniel:', {
      id: danielAtualizado.id,
      email: danielAtualizado.email,
      name: danielAtualizado.name,
      role: danielAtualizado.role,
      clientId: danielAtualizado.clientId
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

debugDanielUsuario();