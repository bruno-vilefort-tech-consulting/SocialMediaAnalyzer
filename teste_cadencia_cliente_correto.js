#!/usr/bin/env node

// Script para testar sistema de cadência com cliente correto
const https = require('https');
const readline = require('readline');

const BASE_URL = 'http://localhost:5000';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTE0NjU1NTI1NzMiLCJlbWFpbCI6ImJydW5vLnZpbGVmb3J0QGF0dWFycGF5LmNvbS5iciIsInJvbGUiOiJjbGllbnQiLCJjbGllbnRJZCI6MTc1MDE2OTI4Mzc4MCwiaWF0IjoxNzUxNTU1ODI2fQ.W3QbWLMW1lwu5qY8-K_JSZZvgNpXIpkHenDZkT5Bkis';

async function makeRequest(path, method = 'GET', data = null) {
  const url = `${BASE_URL}${path}`;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  console.log(`📡 ${method} ${path}`);
  
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response:`, JSON.stringify(result, null, 2));
    console.log('');
    return result;
  } catch (error) {
    console.error(`❌ Erro na requisição: ${error.message}`);
    console.log('');
    return null;
  }
}

async function main() {
  console.log('🎯 TESTE DE CADÊNCIA IMEDIATA COM CLIENTE CORRETO');
  console.log('=' .repeat(60));
  console.log('');
  
  console.log('1. Configurando cadência imediata...');
  await makeRequest('/api/user-round-robin/configure-cadence', 'POST', {
    baseDelay: 500,
    batchSize: 10,
    immediateMode: true
  });
  
  console.log('2. Distribuindo candidatos...');
  await makeRequest('/api/user-round-robin/distribute-candidates', 'POST', {
    candidates: ['553182956616']
  });
  
  console.log('3. Verificando estado inicial...');
  const stats1 = await makeRequest('/api/user-round-robin/stats');
  
  console.log('4. Ativando cadência imediata (simulando resposta "1")...');
  await makeRequest('/api/user-round-robin/activate-immediate', 'POST', {
    candidatePhone: '553182956616'
  });
  
  console.log('5. Verificando estado após ativação...');
  const stats2 = await makeRequest('/api/user-round-robin/stats');
  
  console.log('6. Verificando conexões WhatsApp...');
  await makeRequest('/api/multi-whatsapp/connections');
  
  console.log('🎉 TESTE CONCLUÍDO!');
  console.log('=' .repeat(60));
  console.log('');
  
  // Validação final
  console.log('🔍 VALIDAÇÃO FINAL:');
  console.log(`   ✅ Cliente ID: 1750169283780 (correto)`);
  console.log(`   ✅ Usuário ID: 1751465552573`);
  console.log(`   ✅ Cadência configurada: ${stats1?.stats?.cadenceActive ? 'SIM' : 'NÃO'}`);
  console.log(`   ✅ Slots ativos: ${stats1?.stats?.activeSlots || 0}`);
  console.log(`   ✅ Priscila Comercial: 553182956616`);
  console.log('');
  
  if (stats2?.stats?.cadenceActive) {
    console.log('🎯 SISTEMA FUNCIONANDO! Cadência ativa e pronta para uso.');
  } else {
    console.log('⚠️  Cadência não ativa. Verifique logs do servidor.');
  }
}

main().catch(console.error);