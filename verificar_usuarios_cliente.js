// Script para verificar usuários cliente no sistema
import { FirebaseStorage } from './server/storage.js';

async function verificarUsuariosCliente() {
  console.log('👥 Verificando usuários cliente no sistema...\n');
  
  const storage = new FirebaseStorage();
  
  try {
    // Buscar todos os usuários
    const users = await storage.getAllUsers();
    console.log(`📊 Total de usuários encontrados: ${users.length}\n`);
    
    const clientUsers = users.filter(user => user.role === 'client');
    console.log(`👨‍💼 Usuários com role 'client': ${clientUsers.length}`);
    
    if (clientUsers.length > 0) {
      clientUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.name || 'Nome não definido'}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   ClientId: ${user.clientId || 'não definido'}`);
        console.log(`   Criado em: ${user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleString('pt-BR') : 'não definido'}`);
      });
    } else {
      console.log('❌ Nenhum usuário cliente encontrado com role "client"');
    }
    
    // Buscar também na tabela de clientes (empresa)
    console.log('\n🏢 Verificando tabela de clientes (empresas)...');
    const clients = await storage.getClients();
    console.log(`📊 Total de clientes (empresas): ${clients.length}\n`);
    
    if (clients.length > 0) {
      clients.forEach((client, index) => {
        console.log(`${index + 1}. ${client.companyName || 'Nome não definido'}`);
        console.log(`   Email: ${client.email}`);
        console.log(`   CNPJ: ${client.cnpj}`);
        console.log(`   ID: ${client.id}`);
        console.log(`   Status: ${client.status || 'não definido'}`);
        console.log('');
      });
    }
    
    // Verificar configurações API para clientes
    console.log('⚙️ Verificando configurações API para clientes...');
    const apiConfigs = await storage.getAllApiConfigs();
    const clientConfigs = apiConfigs.filter(config => config.entityType === 'client');
    
    console.log(`📊 Configurações de cliente encontradas: ${clientConfigs.length}\n`);
    
    if (clientConfigs.length > 0) {
      clientConfigs.forEach((config, index) => {
        console.log(`${index + 1}. Cliente ID: ${config.entityId}`);
        console.log(`   WhatsApp Conectado: ${config.whatsappQrConnected || false}`);
        console.log(`   Telefone: ${config.whatsappQrPhoneNumber || 'não definido'}`);
        console.log(`   Voz TTS: ${config.openaiVoice || 'não definido'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar usuários:', error);
  }
}

verificarUsuariosCliente().then(() => {
  console.log('✅ Verificação concluída');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro:', error);
  process.exit(1);
});