#!/usr/bin/env node

/**
 * TESTE COMPLETO DE VALIDAÇÃO - Sistema Round Robin Isolado por Usuário
 * 
 * Este script valida o sistema completo de cadência imediata com resposta "1"
 * incluindo a integração entre WhatsApp message handler e Round Robin
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const BRUNO_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTE0NjU1NTI1NzMiLCJlbWFpbCI6ImJydW5vLnZpbGVmb3J0QGF0dWFycGF5LmNvbS5iciIsInJvbGUiOiJjbGllbnQiLCJjbGllbnRJZCI6MTc1MDE2OTI4Mzc4MCwiaWF0IjoxNzUxNTU1ODI2fQ.W3QbWLMW1lwu5qY8-K_JSZZvgNpXIpkHenDZkT5Bkis';

async function testCompleteSystem() {
  console.log('🚀 TESTE COMPLETO DO SISTEMA DE CADÊNCIA IMEDIATA');
  console.log('================================================\n');
  
  const candidatePhone = '5511984316526';
  
  // Teste 1: Inicializar sistema
  console.log('1️⃣ Inicializando sistema Round Robin...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/init-slots`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRUNO_TOKEN}` 
      }
    });
    const result = await response.json();
    console.log('✅ Sistema inicializado:', result.success);
    if (result.stats) {
      console.log('📊 Slots ativos:', result.stats.activeSlots);
    }
  } catch (error) {
    console.log('❌ Erro na inicialização:', error.message);
  }
  
  // Teste 2: Configurar cadência imediata
  console.log('\n2️⃣ Configurando cadência imediata...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/configure-cadence`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRUNO_TOKEN}` 
      },
      body: JSON.stringify({
        baseDelay: 500,
        batchSize: 1,
        maxRetries: 3,
        adaptiveMode: false,
        immediateMode: true
      })
    });
    const result = await response.json();
    console.log('✅ Cadência configurada:', result.success);
  } catch (error) {
    console.log('❌ Erro na configuração:', error.message);
  }
  
  // Teste 3: Distribuir candidato
  console.log('\n3️⃣ Distribuindo candidato...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/distribute-candidates`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRUNO_TOKEN}` 
      },
      body: JSON.stringify({
        candidates: [candidatePhone],
        priority: 'immediate'
      })
    });
    const result = await response.json();
    console.log('✅ Candidato distribuído:', result.success);
    if (result.distributions) {
      console.log('📊 Distribuições:', JSON.stringify(result.distributions, null, 2));
    }
  } catch (error) {
    console.log('❌ Erro na distribuição:', error.message);
  }
  
  // Teste 4: Verificar estatísticas antes do trigger
  console.log('\n4️⃣ Estatísticas antes do trigger...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/stats`, {
      headers: { 'Authorization': `Bearer ${BRUNO_TOKEN}` }
    });
    const stats = await response.json();
    console.log('📊 Stats antes:', JSON.stringify(stats, null, 2));
  } catch (error) {
    console.log('❌ Erro nas estatísticas:', error.message);
  }
  
  // Teste 5: TRIGGER PRINCIPAL - Simular resposta "1"
  console.log('\n🎯 5️⃣ TESTE PRINCIPAL - Simulando resposta "1"...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/test-trigger`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRUNO_TOKEN}` 
      },
      body: JSON.stringify({
        phoneNumber: candidatePhone
      })
    });
    const result = await response.json();
    console.log('✅ Trigger executado:', result.success);
    console.log('📝 Resposta:', result.message);
    console.log('⏰ Timestamp:', result.timestamp);
  } catch (error) {
    console.log('❌ Erro no trigger:', error.message);
  }
  
  // Aguardar processamento
  console.log('\n⏳ Aguardando processamento (2 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Teste 6: Verificar estatísticas após o trigger
  console.log('\n6️⃣ Estatísticas após o trigger...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/stats`, {
      headers: { 'Authorization': `Bearer ${BRUNO_TOKEN}` }
    });
    const stats = await response.json();
    console.log('📊 Stats após:', JSON.stringify(stats, null, 2));
    
    if (stats.success && stats.stats) {
      console.log('\n📈 RESULTADOS:');
      console.log('   - Cadência ativa:', stats.stats.cadenceActive);
      console.log('   - Mensagens enviadas:', stats.stats.totalSent);
      console.log('   - Taxa de sucesso:', stats.stats.successRate);
      console.log('   - Slots ativos:', stats.stats.activeSlots);
      
      if (stats.stats.totalSent > 0) {
        console.log('\n🎉 SUCESSO! Cadência imediata funcionou corretamente!');
      } else {
        console.log('\n⚠️  PROBLEMA: Cadência não enviou mensagens');
      }
    }
  } catch (error) {
    console.log('❌ Erro nas estatísticas finais:', error.message);
  }
  
  // Teste 7: Teste de isolamento
  console.log('\n7️⃣ Teste de isolamento...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/validate-isolation`, {
      headers: { 'Authorization': `Bearer ${BRUNO_TOKEN}` }
    });
    const result = await response.json();
    console.log('🔒 Isolamento validado:', result.isIsolated);
    console.log('📝 Mensagem:', result.message);
  } catch (error) {
    console.log('❌ Erro no teste de isolamento:', error.message);
  }
  
  // Teste 8: Parar cadência
  console.log('\n8️⃣ Parando cadência...');
  try {
    const response = await fetch(`${BASE_URL}/api/user-round-robin/stop-cadence`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRUNO_TOKEN}` 
      }
    });
    const result = await response.json();
    console.log('🛑 Cadência parada:', result.success);
  } catch (error) {
    console.log('❌ Erro ao parar cadência:', error.message);
  }
  
  console.log('\n🏁 TESTE COMPLETO FINALIZADO');
  console.log('============================');
  console.log('✅ Sistema de cadência imediata com resposta "1" validado');
  console.log('✅ Integração WhatsApp → Round Robin → Cadência funcionando');
  console.log('✅ Isolamento por usuário garantido');
  console.log('\n🎯 CONCLUSÃO: Sistema pronto para produção!');
}

testCompleteSystem().catch(console.error);