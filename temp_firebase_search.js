#!/usr/bin/env node
/**
 * 🔍 TESTE DIRETO DO SISTEMA DE DETECÇÃO ROBUSTA
 * 
 * Testa as funções usando importações diretas do sistema
 */

import { storage } from './server/storage.js';

async function testDetectionSystem() {
  console.log('🔍 TESTE DIRETO DO SISTEMA DE DETECÇÃO ROBUSTA');
  console.log('===============================================');
  
  const phoneNumbers = [
    '5511996612253', // Michel
    '553182956616',  // Priscila
    '5511999999999'  // Inexistente
  ];
  
  console.log('\n📊 TESTANDO FUNÇÃO getCandidatesByMultipleClients...');
  
  try {
    const candidates = await storage.getCandidatesByMultipleClients([1749849987543, 1750169283780]);
    console.log(`✅ Total de candidatos encontrados: ${candidates.length}`);
    
    console.log('\n📋 CANDIDATOS ENCONTRADOS:');
    candidates.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.name} - ${candidate.whatsapp} (Cliente: ${candidate.clientId})`);
    });
    
    console.log('\n🔍 TESTANDO DETECÇÃO POR TELEFONE...');
    
    for (const phone of phoneNumbers) {
      console.log(`\n📱 Testando telefone: ${phone}`);
      const cleanPhone = phone.replace(/\D/g, '');
      
      const matchingCandidates = candidates.filter(candidate => {
        const candidatePhone = candidate.whatsapp?.replace(/\D/g, '') || '';
        return candidatePhone === cleanPhone;
      });
      
      console.log(`   Candidatos encontrados: ${matchingCandidates.length}`);
      
      if (matchingCandidates.length === 1) {
        const candidate = matchingCandidates[0];
        console.log(`   ✅ Cliente detectado: ${candidate.clientId} (${candidate.name})`);
      } else if (matchingCandidates.length > 1) {
        console.log(`   ⚠️ Múltiplos candidatos - usando critério determinístico:`);
        const sorted = matchingCandidates.sort((a, b) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });
        const selected = sorted[0];
        console.log(`   ✅ Cliente selecionado: ${selected.clientId} (${selected.name} - mais recente)`);
      } else {
        console.log(`   ❌ Nenhum candidato encontrado`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
  
  console.log('\n✅ TESTE CONCLUÍDO');
}

// Executar teste
testDetectionSystem().catch(console.error);