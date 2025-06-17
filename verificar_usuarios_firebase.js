// Script para verificar usuários no Firebase via servidor
import { storage } from './server/storage.js';

async function verificarUsuarios() {
  try {
    console.log("\n🔍 VERIFICANDO USUARIOS NO FIREBASE:");
    console.log("===================================");

    // Buscar todos os usuários
    const allUsers = await storage.getAllUsers();
    console.log(`📊 Total de usuários no sistema: ${allUsers.length}`);
    
    allUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email})`);
      console.log(`      Role: ${user.role}`);
      console.log(`      ClientId: ${user.clientId || 'UNDEFINED'}`);
      console.log(`      ID: ${user.id}`);
      console.log('');
    });

    // Buscar usuários de cliente especificamente
    console.log("\n🔍 BUSCANDO USUARIOS DE CLIENTE (clientId: 1749849987543):");
    const clientUsers = await storage.getClientUsers(1749849987543);
    console.log(`📊 Usuários do cliente encontrados: ${clientUsers.length}`);
    
    clientUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email}) - ClientId: ${user.clientId}`);
    });

  } catch (error) {
    console.error("❌ Erro ao verificar usuários:", error);
  }
}

verificarUsuarios();