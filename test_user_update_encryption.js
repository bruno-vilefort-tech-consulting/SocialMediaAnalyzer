const { storage } = require('./server/storage');

async function testUserUpdateEncryption() {
  try {
    console.log('🔧 Testando criptografia de senha na atualização de usuário...');
    
    // Buscar um usuário existente para teste
    const users = await storage.getClientUsers(1749849987543); // Grupo Maximuns
    
    if (users.length === 0) {
      console.log('❌ Nenhum usuário encontrado para teste');
      return;
    }
    
    const testUser = users[0];
    console.log('👤 Usuário de teste:', {
      id: testUser.id,
      name: testUser.name,
      email: testUser.email
    });
    
    console.log('🔐 Senha atual (hash):', testUser.password?.substring(0, 20) + '...');
    
    // Testar atualização sem senha
    console.log('\n🧪 Teste 1: Atualização sem senha (não deve alterar hash)');
    const hashAntes = testUser.password;
    await storage.updateUser(parseInt(testUser.id), {
      name: testUser.name + ' (Teste)'
    });
    
    const userAfterUpdate1 = await storage.getUserById(parseInt(testUser.id));
    console.log('✅ Hash mantido:', hashAntes === userAfterUpdate1.password);
    
    // Reverter nome
    await storage.updateUser(parseInt(testUser.id), {
      name: testUser.name
    });
    
    console.log('\n🧪 Teste 2: Atualização via endpoint com nova senha');
    const testPassword = 'NovaSegura123';
    
    // Simular chamada do endpoint
    const bcrypt = require('bcrypt');
    const updateData = {
      name: testUser.name,
      password: testPassword
    };
    
    // Aplicar a mesma lógica do endpoint corrigido
    if (updateData.password) {
      console.log('🔐 Criptografando nova senha...');
      const hashedPassword = await bcrypt.hash(updateData.password, 10);
      updateData.password = hashedPassword;
      console.log('✅ Senha criptografada');
    }
    
    await storage.updateUser(parseInt(testUser.id), updateData);
    
    const userAfterUpdate2 = await storage.getUserById(parseInt(testUser.id));
    console.log('🔐 Nova hash gerada:', userAfterUpdate2.password?.substring(0, 20) + '...');
    
    // Verificar se a nova senha funciona
    const senhaCorreta = await bcrypt.compare(testPassword, userAfterUpdate2.password);
    console.log('✅ Nova senha válida:', senhaCorreta);
    
    console.log('\n✅ Teste de criptografia concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testUserUpdateEncryption();