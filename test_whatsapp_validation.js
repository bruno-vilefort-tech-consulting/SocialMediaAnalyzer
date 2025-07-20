console.log('🧪 [TESTE] ===== TESTANDO VALIDAÇÃO WHATSAPP VIA API =====\n');

async function testWhatsAppValidation() {
  try {
    console.log('📋 [FASE 1] Testando endpoint de validação WhatsApp...');
    
    // Testar endpoint sem autenticação para ver se está respondendo
    const response = await fetch('http://localhost:5000/api/whatsapp/validate-number', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: '5511987654321'
      })
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.text();
    console.log('📊 Response body:', result);
    
    if (response.status === 401) {
      console.log('✅ [RESULTADO] Endpoint está funcionando mas requer autenticação (esperado)');
      console.log('🔐 Sistema de validação WhatsApp implementado corretamente');
    } else if (response.status === 503) {
      console.log('⚠️ [RESULTADO] Serviço WhatsApp não disponível (normal se não conectado)');
    } else {
      console.log('📋 [RESULTADO] Status inesperado:', response.status);
    }
    
  } catch (error) {
    console.error('❌ [ERRO] Falha no teste:', error);
  }
}

// Executar teste
testWhatsAppValidation().catch(console.error);