console.log('🗑️ [FORCE DELETE] ===== DELETANDO BRUNO VILEFORT FORÇADAMENTE =====\n');

// Importar serviços necessários
import { initializeStorage } from './server/storage.js';

async function forceDeleteBrunoVilefort() {
  try {
    console.log('📋 [FASE 1] Inicializando conexão com Firebase...');
    const storage = await initializeStorage();
    
    console.log('🔍 [FASE 2] Buscando candidato Bruno Vilefort...');
    
    // Buscar candidatos com informações que correspondem
    const allCandidates = await storage.getCandidatesByClientId('1749849987543');
    console.log(`📊 Total de candidatos encontrados: ${allCandidates.length}`);
    
    // Filtrar por critérios específicos
    const brunoMatches = allCandidates.filter(candidate => {
      const nameMatch = candidate.name && candidate.name.toLowerCase().includes('bruno') && candidate.name.toLowerCase().includes('vilefort');
      const emailMatch = candidate.email && candidate.email.toLowerCase().includes('bruno.clara@yahoo.com');
      const phoneMatch = candidate.phone && candidate.phone.includes('31991505564');
      
      console.log(`📋 Testando candidato: ${candidate.name} (${candidate.email}) - ${candidate.phone}`);
      console.log(`   NameMatch: ${nameMatch}, EmailMatch: ${emailMatch}, PhoneMatch: ${phoneMatch}`);
      
      return nameMatch || emailMatch || phoneMatch;
    });
    
    console.log(`🎯 Candidatos que correspondem aos critérios: ${brunoMatches.length}`);
    
    if (brunoMatches.length === 0) {
      // Tentar busca mais ampla
      console.log('❌ Busca específica não encontrou. Tentando busca mais ampla...');
      
      const broadMatches = allCandidates.filter(candidate => {
        const hasVilefort = candidate.name && candidate.name.toLowerCase().includes('vilefort');
        const hasEmail = candidate.email && candidate.email.toLowerCase().includes('bruno.clara');
        const hasPhone = candidate.phone && candidate.phone.includes('91505564');
        
        return hasVilefort || hasEmail || hasPhone;
      });
      
      console.log(`🔍 Busca ampla encontrou: ${broadMatches.length} candidatos`);
      
      if (broadMatches.length === 0) {
        console.log('❌ Candidato Bruno Vilefort não encontrado nem com busca ampla');
        
        // Listar alguns candidatos para debug
        console.log('\n📋 [DEBUG] Primeiros 5 candidatos do cliente:');
        allCandidates.slice(0, 5).forEach((candidate, index) => {
          console.log(`   ${index + 1}. ${candidate.name} | ${candidate.email} | ${candidate.phone}`);
        });
        
        return;
      }
      
      brunoMatches.push(...broadMatches);
    }
    
    // Mostrar detalhes dos candidatos encontrados
    brunoMatches.forEach((candidate, index) => {
      console.log(`\n📋 [CANDIDATO ${index + 1}]:`);
      console.log(`   ID: ${candidate.id}`);
      console.log(`   Nome: ${candidate.name}`);
      console.log(`   Email: ${candidate.email}`);
      console.log(`   Telefone: ${candidate.phone}`);
      console.log(`   Cliente: ${candidate.clientId}`);
    });
    
    console.log('\n🗑️ [FASE 3] Deletando candidatos forçadamente...');
    
    // Deletar cada candidato encontrado
    for (const candidate of brunoMatches) {
      try {
        console.log(`🗑️ Deletando candidato ID: ${candidate.id} (${candidate.name})`);
        await storage.deleteCandidate(candidate.id);
        console.log(`✅ Candidato ${candidate.id} deletado com sucesso`);
      } catch (error) {
        console.error(`❌ Erro ao deletar candidato ${candidate.id}:`, error);
      }
    }
    
    console.log('\n🎉 [FINALIZADO] Processo de deleção forçada concluído!');
    
    // Verificar se foi realmente deletado
    console.log('\n🔍 [VERIFICAÇÃO] Verificando se candidato foi removido...');
    const remainingCandidates = await storage.getCandidatesByClientId('1749849987543');
    const stillExists = remainingCandidates.filter(candidate => {
      const nameMatch = candidate.name && candidate.name.toLowerCase().includes('vilefort');
      const emailMatch = candidate.email && candidate.email.toLowerCase().includes('bruno.clara');
      const phoneMatch = candidate.phone && candidate.phone.includes('91505564');
      return nameMatch || emailMatch || phoneMatch;
    });
    
    if (stillExists.length === 0) {
      console.log('✅ Confirmado: Bruno Vilefort foi removido completamente da base');
    } else {
      console.log(`⚠️ Ainda existem ${stillExists.length} candidatos similares na base`);
    }
    
  } catch (error) {
    console.error('❌ [ERRO GERAL] Falha no processo:', error);
  }
}

// Executar deleção forçada
forceDeleteBrunoVilefort().catch(console.error);