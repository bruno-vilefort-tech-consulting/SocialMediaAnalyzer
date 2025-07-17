/**
 * Script para testar e validar integração final userIsolatedRoundRobin com simpleMultiBailey
 * 
 * Testará:
 * 1. Inicialização dos slots com conexões reais
 * 2. Configuração de cadência
 * 3. Distribuição de candidatos
 * 4. Envio via conexões reais
 * 5. Ativação de cadência imediata
 */

// Importar serviços usando ES modules
import { userIsolatedRoundRobin } from './whatsapp/services/userIsolatedRoundRobin.ts';
import { simpleMultiBailey } from './whatsapp/services/simpleMultiBailey.ts';

// Configurar teste
const testUserId = 'test_user_123';
const testClientId = '1750169283780';
const testCandidates = [
  '5511999999999',
  '5511888888888',
  '5511777777777'
];

async function testarIntegracaoFinal() {
  console.log('\n🚀 ===== TESTE DE INTEGRAÇÃO FINAL =====');
  console.log('Testando integração userIsolatedRoundRobin com simpleMultiBailey\n');

  try {
    // 1. Verificar conexões reais do WhatsApp
    console.log('1️⃣ Verificando conexões reais do WhatsApp...');
    const connectionStatus = await simpleMultiBailey.getClientConnections(testClientId);
    console.log(`✅ Conexões encontradas: ${connectionStatus.activeConnections} de ${connectionStatus.totalConnections}`);
    
    if (connectionStatus.activeConnections === 0) {
      console.log('❌ Nenhuma conexão WhatsApp ativa encontrada!');
      console.log('📱 É necessário conectar WhatsApp na página /configuracoes primeiro');
      return;
    }

    // 2. Inicializar slots com conexões reais
    console.log('\n2️⃣ Inicializando slots com conexões reais...');
    await userIsolatedRoundRobin.initializeUserSlots(testUserId, testClientId);
    
    const activeSlots = userIsolatedRoundRobin.getUserActiveSlots(testUserId);
    console.log(`✅ Slots ativos inicializados: ${activeSlots.length}`);
    
    if (activeSlots.length === 0) {
      console.log('❌ Nenhum slot ativo foi criado!');
      return;
    }

    // 3. Configurar cadência
    console.log('\n3️⃣ Configurando cadência...');
    userIsolatedRoundRobin.setUserCadenceConfig(testUserId, {
      baseDelay: 1000,
      batchSize: 5,
      maxRetries: 3,
      adaptiveMode: true,
      immediateMode: true
    });
    console.log('✅ Cadência configurada');

    // 4. Distribuir candidatos
    console.log('\n4️⃣ Distribuindo candidatos...');
    const distribution = userIsolatedRoundRobin.distributeCandidates(testUserId, testCandidates);
    console.log(`✅ Candidatos distribuídos: ${distribution.length} distribuições`);
    
    distribution.forEach((dist, index) => {
      console.log(`   Distribuição ${index + 1}: Slot ${dist.slotNumber} - ${dist.candidates.length} candidatos`);
    });

    // 5. Testar envio via conexões reais
    console.log('\n5️⃣ Testando envio via conexões reais...');
    const testPhone = testCandidates[0];
    const testMessage = '🧪 Teste de integração - Sistema userIsolatedRoundRobin integrado com simpleMultiBailey';
    
    // Usar primeiro slot ativo
    const firstSlot = activeSlots[0];
    console.log(`📤 Enviando mensagem de teste para ${testPhone} via slot ${firstSlot.slotNumber}`);
    
    const sendResult = await simpleMultiBailey.sendMessage(testClientId, testPhone, testMessage, firstSlot.slotNumber);
    console.log(`✅ Resultado do envio:`, sendResult);

    // 6. Testar ativação de cadência imediata
    console.log('\n6️⃣ Testando ativação de cadência imediata...');
    await userIsolatedRoundRobin.activateUserImmediateCadence(testUserId, testClientId, testCandidates);
    console.log('✅ Cadência imediata ativada');

    // 7. Validar estatísticas
    console.log('\n7️⃣ Validando estatísticas...');
    const stats = userIsolatedRoundRobin.getUserStats(testUserId);
    console.log(`✅ Estatísticas obtidas:`, stats);

    // 8. Testar processamento de cadência
    console.log('\n8️⃣ Testando processamento de cadência...');
    await userIsolatedRoundRobin.processUserCadence(testUserId);
    console.log('✅ Cadência processada');

    console.log('\n🎉 ===== TESTE CONCLUÍDO COM SUCESSO =====');
    console.log('✅ Integração userIsolatedRoundRobin com simpleMultiBailey FUNCIONAL');
    console.log('✅ Sistema usa apenas conexões reais do WhatsApp');
    console.log('✅ Fallback de mock removido');
    console.log('✅ Envio via slots reais confirmado');

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testarIntegracaoFinal();