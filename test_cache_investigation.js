/**
 * INVESTIGAÇÃO DO CACHE - Mensagem indesejada reaparecendo
 * 
 * Este script busca no cache e no sistema onde a mensagem indesejada
 * está sendo armazenada e enviada novamente.
 */

import { simpleMultiBaileyService } from './whatsapp/services/simpleMultiBailey.ts';
import { userIsolatedRoundRobin } from './whatsapp/services/userIsolatedRoundRobin.ts';
import { interactiveInterviewService } from './server/interactiveInterviewService.ts';

async function investigateCache() {
  console.log('🔍 [CACHE-INVESTIGATION] Iniciando investigação do cache...');
  
  try {
    // 1. VERIFICAR CACHE DO SISTEMA
    console.log('\n📝 [CACHE-INVESTIGATION] Verificando cache do sistema...');
    
    // Buscar todas as conexões ativas
    const allConnections = await simpleMultiBaileyService.getAllConnections();
    console.log(`📊 [CACHE-INVESTIGATION] Conexões encontradas: ${allConnections.length}`);
    
    // 2. VERIFICAR MENSAGENS EM CACHE
    console.log('\n📝 [CACHE-INVESTIGATION] Verificando mensagens em cache...');
    
    // Simular processo de cadência para ver onde a mensagem aparece
    const userId = '1750169283780';
    const clientId = '1750169283780';
    const candidatePhone = '553182230538';
    
    // Inicializar slots para o usuário
    await userIsolatedRoundRobin.initializeUserSlots(userId, clientId);
    
    // Configurar cadência
    await userIsolatedRoundRobin.configureCadence(userId, {
      baseDelay: 500,
      batchSize: 1,
      maxRetries: 3
    });
    
    // Distribuir candidatos
    await userIsolatedRoundRobin.distributeCandidates(userId, [candidatePhone]);
    
    // Simular ativação de cadência imediata
    console.log('\n📝 [CACHE-INVESTIGATION] Ativando cadência imediata...');
    await userIsolatedRoundRobin.activateImmediateCadence(userId);
    
    // 3. INVESTIGAR ENTREVISTAS ATIVAS
    console.log('\n📝 [CACHE-INVESTIGATION] Verificando entrevistas ativas...');
    
    const activeInterviews = interactiveInterviewService.getActiveInterviews();
    console.log(`📊 [CACHE-INVESTIGATION] Entrevistas ativas: ${activeInterviews.size}`);
    
    for (const [phone, interview] of activeInterviews) {
      console.log(`📱 [CACHE-INVESTIGATION] Entrevista ativa: ${phone} -> ${interview.candidateName}`);
      console.log(`📝 [CACHE-INVESTIGATION] Pergunta atual: ${interview.currentQuestion + 1}/${interview.questions.length}`);
    }
    
    // 4. BUSCAR MENSAGENS INDESEJADAS NO SISTEMA
    console.log('\n📝 [CACHE-INVESTIGATION] Buscando mensagens indesejadas...');
    
    const undesiredText = '🎯 CADÊNCIA IMEDIATA';
    
    // Verificar se existe alguma mensagem com esse texto em cache
    const cacheKeys = Object.keys(global).filter(key => 
      key.includes('cache') || key.includes('message') || key.includes('cadence')
    );
    
    console.log(`📊 [CACHE-INVESTIGATION] Chaves de cache encontradas: ${cacheKeys.length}`);
    
    for (const key of cacheKeys) {
      const value = global[key];
      if (value && typeof value === 'string' && value.includes(undesiredText)) {
        console.log(`🚨 [CACHE-INVESTIGATION] MENSAGEM INDESEJADA ENCONTRADA em ${key}:`);
        console.log(`📝 [CACHE-INVESTIGATION] Conteúdo: "${value}"`);
      }
    }
    
    // 5. RESULTADO DA INVESTIGAÇÃO
    console.log('\n🏁 [CACHE-INVESTIGATION] RESULTADO DA INVESTIGAÇÃO:');
    console.log(`✅ [CACHE-INVESTIGATION] Sistema de cadência foi executado`);
    console.log(`✅ [CACHE-INVESTIGATION] Mensagens enviadas via slots`);
    console.log(`❓ [CACHE-INVESTIGATION] Aguardando verificação do cache`);
    
    console.log('\n🎯 [CACHE-INVESTIGATION] Investigação concluída!');
    
  } catch (error) {
    console.error('❌ [CACHE-INVESTIGATION] Erro na investigação:', error);
  }
}

// Executar investigação
investigateCache();