// Teste completo do sistema WhatsApp para usuários cliente
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBOBJzHqVZLjjZuDYKNgBOKPnYWhvMC9oU",
  authDomain: "grupo-maximus-8a4c5.firebaseapp.com",
  projectId: "grupo-maximus-8a4c5",
  storageBucket: "grupo-maximus-8a4c5.firebasestorage.app",
  messagingSenderId: "851847516926",
  appId: "1:851847516926:web:fe30eb7ae5e0e61b0f3456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testarSistemaCliente() {
  console.log('🧪 Testando sistema WhatsApp para clientes...\n');
  
  try {
    // 1. Verificar usuários cliente existentes
    console.log('👥 Verificando usuários cliente...');
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const clientUsers = [];
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      if (user.role === 'client' && user.clientId) {
        clientUsers.push({ id: doc.id, ...user });
      }
    });
    
    console.log(`   Encontrados ${clientUsers.length} usuários cliente:`);
    clientUsers.forEach(user => {
      console.log(`   - ${user.name} (${user.email}) - Cliente ID: ${user.clientId}`);
    });
    
    if (clientUsers.length === 0) {
      console.log('❌ Nenhum usuário cliente encontrado para teste');
      return;
    }
    
    // 2. Testar criação de configuração WhatsApp para cliente
    const clienteExemplo = clientUsers[0];
    console.log(`\n📱 Testando criação de configuração WhatsApp para: ${clienteExemplo.name}`);
    
    // Verificar se já existe configuração para este cliente
    const apiConfigsRef = collection(db, 'apiConfigs');
    const configsSnapshot = await getDocs(apiConfigsRef);
    
    let configExistente = null;
    configsSnapshot.forEach(doc => {
      const config = doc.data();
      if (config.entityType === 'client' && config.entityId === clienteExemplo.clientId.toString()) {
        configExistente = { id: doc.id, ...config };
      }
    });
    
    if (configExistente) {
      console.log(`   ✅ Configuração existente encontrada: ${configExistente.id}`);
      console.log(`   Status WhatsApp: ${configExistente.whatsappQrConnected ? 'Conectado' : 'Desconectado'}`);
      console.log(`   Telefone: ${configExistente.whatsappQrPhoneNumber || 'não definido'}`);
    } else {
      console.log('   📝 Criando nova configuração para o cliente...');
      
      const novaConfig = {
        entityType: 'client',
        entityId: clienteExemplo.clientId.toString(),
        whatsappQrConnected: false,
        whatsappQrPhoneNumber: null,
        whatsappQrLastConnection: null,
        openaiVoice: 'nova',
        firebaseProjectId: null,
        firebaseServiceAccount: null,
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(apiConfigsRef, novaConfig);
      console.log(`   ✅ Configuração criada com ID: ${docRef.id}`);
    }
    
    // 3. Simular login do cliente
    console.log(`\n🔑 Simulando autenticação do cliente: ${clienteExemplo.email}`);
    
    const loginData = {
      email: clienteExemplo.email,
      password: 'daniel580190' // senha padrão
    };
    
    try {
      const loginResponse = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
      });
      
      const loginResult = await loginResponse.json();
      
      if (loginResponse.ok && loginResult.token) {
        console.log('   ✅ Login realizado com sucesso');
        
        // 4. Testar acesso às APIs de WhatsApp como cliente
        console.log('\n📡 Testando endpoints WhatsApp como cliente...');
        
        const authHeader = { 'Authorization': `Bearer ${loginResult.token}` };
        
        // Testar GET conexões WhatsApp
        const connectionsResponse = await fetch(`http://localhost:5000/api/whatsapp-connections/client/${clienteExemplo.clientId}`, {
          headers: authHeader
        });
        
        if (connectionsResponse.ok) {
          const connections = await connectionsResponse.json();
          console.log(`   ✅ GET conexões: ${connections.length} conexões encontradas`);
        } else {
          console.log('   ❌ Erro ao buscar conexões:', connectionsResponse.status);
        }
        
        // Testar criação de conexão WhatsApp
        const createConnectionData = {
          clientId: clienteExemplo.clientId,
          name: 'Teste WhatsApp'
        };
        
        const createResponse = await fetch('http://localhost:5000/api/whatsapp-connections', {
          method: 'POST',
          headers: {
            ...authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(createConnectionData)
        });
        
        if (createResponse.ok) {
          const newConnection = await createResponse.json();
          console.log('   ✅ POST criar conexão: sucesso');
          console.log(`   ID da nova conexão: ${newConnection.id}`);
        } else {
          const error = await createResponse.text();
          console.log('   ❌ Erro ao criar conexão:', createResponse.status, error);
        }
        
      } else {
        console.log('   ❌ Falha no login:', loginResult.error || 'Token não recebido');
      }
      
    } catch (error) {
      console.log('   ❌ Erro na requisição de login:', error.message);
    }
    
    console.log('\n🎯 Teste concluído');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testarSistemaCliente().then(() => {
  console.log('✅ Verificação completa do sistema cliente');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro:', error);
  process.exit(1);
});