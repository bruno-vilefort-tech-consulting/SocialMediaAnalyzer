#!/usr/bin/env node
/**
 * 🔍 TESTE DE DEBUG: Simular resposta "1" com logs detalhados
 * Vamos testar o fluxo completo para identificar onde alguns números param de receber cadência
 */

import axios from 'axios';
import express from 'express';
const app = express();
app.use(express.json());

const API_BASE = 'http://localhost:5000';

async function testCadenceResponse() {
  console.log('🔍 [TEST] Iniciando teste de debug da resposta "1"');
  console.log('=' .repeat(70));
  
  // Simular cenário: Número responde "1" mas não recebe cadência
  const testPhone = '5511999999999';
  const testClientId = '1749849987543'; // Cliente de teste
  
  console.log('\n📱 [TEST] Simulando resposta "1":');
  console.log(`   Telefone: ${testPhone}`);
  console.log(`   ClientId: ${testClientId}`);
  console.log(`   Texto: "1"`);
  
  try {
    // Simular chamada para handleMessage do interactiveInterviewService
    console.log('\n🚀 [TEST] Enviando resposta "1" para o sistema...');
    
    const response = await axios.post(`${API_BASE}/api/user-round-robin/test-trigger`, {
      phone: testPhone,
      clientId: testClientId,
      text: '1'
    });
    
    console.log('✅ [TEST] Resposta recebida:', response.data);
    
    // Aguardar 2 segundos para processamento
    console.log('\n⏳ [TEST] Aguardando 2 segundos para processamento...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar estatísticas do usuário
    console.log('\n📊 [TEST] Verificando estatísticas do usuário...');
    const statsResponse = await axios.get(`${API_BASE}/api/user-round-robin/stats`, {
      params: { userId: testClientId }
    });
    
    console.log('📊 [TEST] Estatísticas encontradas:', statsResponse.data);
    
    // Análise dos resultados
    console.log('\n🔍 [TEST] Análise dos resultados:');
    
    if (statsResponse.data.cadenceActive) {
      console.log('✅ [TEST] Cadência está ativa');
    } else {
      console.log('❌ [TEST] Cadência NÃO está ativa');
    }
    
    if (statsResponse.data.activeSlots > 0) {
      console.log(`✅ [TEST] Slots ativos: ${statsResponse.data.activeSlots}`);
    } else {
      console.log('❌ [TEST] Nenhum slot ativo encontrado');
    }
    
    if (statsResponse.data.totalSent > 0) {
      console.log(`✅ [TEST] Mensagens enviadas: ${statsResponse.data.totalSent}`);
    } else {
      console.log('❌ [TEST] Nenhuma mensagem enviada');
    }
    
    console.log(`📈 [TEST] Taxa de sucesso: ${statsResponse.data.successRate}`);
    console.log(`⚠️ [TEST] Erros: ${statsResponse.data.totalErrors}`);
    
    // Diagnóstico final
    console.log('\n🎯 [TEST] Diagnóstico:');
    
    if (!statsResponse.data.cadenceActive) {
      console.log('🚨 [TEST] PROBLEMA: Cadência não está ativa');
      console.log('   - Verificar se clientId está sendo passado corretamente');
      console.log('   - Verificar se ativação da cadência foi executada');
    }
    
    if (statsResponse.data.activeSlots === 0) {
      console.log('🚨 [TEST] PROBLEMA: Nenhum slot ativo');
      console.log('   - Verificar se initializeUserSlots foi chamado');
      console.log('   - Verificar se slots foram criados corretamente');
    }
    
    if (statsResponse.data.totalSent === 0) {
      console.log('🚨 [TEST] PROBLEMA: Nenhuma mensagem enviada');
      console.log('   - Verificar se processUserCadence foi executado');
      console.log('   - Verificar se distribuição foi criada corretamente');
    }
    
    if (statsResponse.data.cadenceActive && statsResponse.data.activeSlots > 0 && statsResponse.data.totalSent > 0) {
      console.log('✅ [TEST] SUCESSO: Cadência funcionando corretamente');
    }
    
  } catch (error) {
    console.error('❌ [TEST] Erro durante o teste:', error.message);
    
    if (error.response) {
      console.error('📄 [TEST] Resposta do servidor:', error.response.data);
    }
  }
}

// Executar teste
testCadenceResponse();