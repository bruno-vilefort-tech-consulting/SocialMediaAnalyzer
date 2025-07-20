console.log('🗑️ [FORCE DELETE] ===== DELETANDO BRUNO VILEFORT FORÇADAMENTE =====\n');

// Importar serviços necessários
const { initializeStorage } = require('./server/storage.ts');

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
      
      return nameMatch || emailMatch || phoneMatch;
    });
    
    console.log(`🎯 Candidatos que correspondem aos critérios: ${brunoMatches.length}`);
    
    if (brunoMatches.length === 0) {
      console.log('❌ Candidato Bruno Vilefort não encontrado');
      return;
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
    
  } catch (error) {
    console.error('❌ [ERRO GERAL] Falha no processo:', error);
  }
}

// Executar deleção forçada
forceDeleteBrunoVilefort().catch(console.error);