import { storage } from './server/storage.js';

async function debugUsuarios() {
  try {
    console.log('🔍 Verificando usuários diretamente via storage...\n');
    
    // Testar busca para cliente específico
    const clientId = 1749849987543;
    console.log(`📋 Buscando usuários para clientId: ${clientId}`);
    
    const users = await storage.getClientUsers(clientId);
    console.log(`📊 Resultado: ${users.length} usuários encontrados`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - ClientId: ${user.clientId}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

debugUsuarios();