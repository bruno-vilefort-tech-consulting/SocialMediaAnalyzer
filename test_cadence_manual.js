#!/usr/bin/env node

/**
 * 🧪 TESTE MANUAL DA CADÊNCIA DE MENSAGENS
 * Este script simula uma mensagem "1" para testar se a cadência está funcionando
 */

import { interactiveInterviewService } from './server/interactiveInterviewService.js';

async function testCadenceManual() {
  console.log('🧪 [TEST] Iniciando teste manual da cadência...');
  
  try {
    // Parâmetros do teste
    const phone = '553182230538';
    const clientId = '1749849987543'; 
    const message = '1';
    
    console.log(`🧪 [TEST] Simulando mensagem "${message}" de ${phone} para cliente ${clientId}`);
    
    // Simular handleMessage diretamente 
    await interactiveInterviewService.handleMessage(
      `${phone}@s.whatsapp.net`, 
      message, 
      null, 
      clientId
    );
    
    console.log('✅ [TEST] Mensagem processada com sucesso');
    
    // Aguardar processamento
    setTimeout(() => {
      console.log('🧪 [TEST] Teste concluído - verificar logs acima para detalhes da cadência');
      process.exit(0);
    }, 3000);
    
  } catch (error) {
    console.error('❌ [TEST] Erro no teste:', error);
    process.exit(1);
  }
}

// Executar teste
testCadenceManual();