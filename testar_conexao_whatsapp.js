import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testarConexaoWhatsApp() {
  console.log("🔧 TESTANDO CONEXÃO WHATSAPP APÓS CORREÇÃO...\n");

  try {
    // 1. Verificar status atual no banco
    console.log("📋 1. VERIFICANDO STATUS ATUAL NO BANCO:");
    const masterDocRef = doc(db, "apiConfigs", "master_1749848502212");
    const masterDoc = await getDoc(masterDocRef);

    if (masterDoc.exists()) {
      const config = masterDoc.data();
      console.log(`   📱 WhatsApp Conectado: ${config.whatsappQrConnected}`);
      console.log(`   📞 Número: ${config.whatsappQrPhoneNumber || 'null'}`);
      console.log(`   🕒 Última Conexão: ${config.whatsappQrLastConnection || 'null'}`);
    } else {
      console.log("   ❌ Configuração master não encontrada");
      return;
    }

    // 2. Fazer uma chamada para o endpoint de status
    console.log("\n📋 2. TESTANDO ENDPOINT DE STATUS:");
    try {
      const response = await fetch('http://localhost:5000/api/whatsapp-qr/status');
      const statusData = await response.json();
      console.log(`   🔗 Status API: ${statusData.isConnected ? 'Conectado' : 'Desconectado'}`);
      console.log(`   📱 QR Code: ${statusData.qrCode ? 'Disponível' : 'Não disponível'}`);
    } catch (error) {
      console.log(`   ❌ Erro ao consultar API: ${error.message}`);
    }

    // 3. Fazer um teste de envio
    console.log("\n📋 3. TESTANDO ENVIO DE MENSAGEM:");
    try {
      const testResponse = await fetch('http://localhost:5000/api/whatsapp-qr/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: '5511984316526',
          message: 'Teste de verificação da conexão após correção do sistema.'
        })
      });
      
      const testResult = await testResponse.json();
      console.log(`   📤 Resultado do teste: ${testResult.success ? 'SUCESSO' : 'FALHA'}`);
      console.log(`   💬 Mensagem: ${testResult.message}`);
    } catch (error) {
      console.log(`   ❌ Erro no teste de envio: ${error.message}`);
    }

    // 4. Verificar novamente o banco após o teste
    console.log("\n📋 4. VERIFICANDO BANCO APÓS TESTE:");
    const masterDocAfter = await getDoc(masterDocRef);
    if (masterDocAfter.exists()) {
      const configAfter = masterDocAfter.data();
      console.log(`   📱 WhatsApp Conectado: ${configAfter.whatsappQrConnected}`);
      console.log(`   📞 Número: ${configAfter.whatsappQrPhoneNumber || 'null'}`);
      console.log(`   🕒 Última Conexão: ${configAfter.whatsappQrLastConnection || 'null'}`);
      
      // Verificar se houve mudança
      const config = masterDoc.data();
      if (configAfter.whatsappQrConnected !== config.whatsappQrConnected) {
        console.log("\n✅ STATUS ATUALIZADO NO BANCO!");
      } else {
        console.log("\n⚠️ Status não foi atualizado no banco");
      }
    }

    console.log("\n📋 5. RESUMO DO TESTE:");
    console.log("🔍 Sistema corrigido para usar nova arquitetura");
    console.log("🔧 WhatsApp Service agora usa getApiConfig('master', '1749848502212')");
    console.log("💾 Conexões devem ser salvas na configuração correta");

  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

// Executar teste
testarConexaoWhatsApp()
  .then(() => {
    console.log("\n✅ Teste finalizado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });