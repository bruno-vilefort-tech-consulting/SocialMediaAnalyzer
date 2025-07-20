// Script direto para deletar Bruno Vilefort via JavaScript puro
const fetch = require('node-fetch');

async function deleteBrunoVilefortDirect() {
  console.log('🗑️ [DIRECT DELETE] Deletando Bruno Vilefort diretamente...');
  
  try {
    // Token do usuário bruno.claro@yahoo.com
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTEzODUwNzUxNTkiLCJlbWFpbCI6ImJydW5vLmNsYXJvQHlhaG9vLmNvbSIsInJvbGUiOiJjbGllbnQiLCJjbGllbnRJZCI6MTc0OTg0OTk4NzU0MywiaWF0IjoxNzUyODE4MTE0fQ.pJ_oeHYWW2GDq8OQR6eXcxM3KlI1WKUCh6qI1FG1Gqs";
    
    // 1. Buscar todos os candidatos do cliente
    console.log('📋 Buscando candidatos...');
    const response = await fetch('http://localhost:5000/api/candidates', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar candidatos: ${response.status}`);
    }
    
    const candidates = await response.json();
    console.log(`📊 Total de candidatos encontrados: ${candidates.length}`);
    
    // 2. Filtrar candidatos que correspondem ao Bruno Vilefort
    const brunoMatches = candidates.filter(candidate => {
      const nameMatch = candidate.name && (
        candidate.name.toLowerCase().includes('bruno') && candidate.name.toLowerCase().includes('vilefort')
      );
      const emailMatch = candidate.email && candidate.email.toLowerCase().includes('bruno.clara@yahoo.com');
      const phoneMatch = candidate.phone && candidate.phone.includes('31991505564');
      
      console.log(`🔍 Testando: ${candidate.name} | ${candidate.email} | ${candidate.phone}`);
      console.log(`   NameMatch: ${nameMatch}, EmailMatch: ${emailMatch}, PhoneMatch: ${phoneMatch}`);
      
      return nameMatch || emailMatch || phoneMatch;
    });
    
    console.log(`🎯 Candidatos que correspondem: ${brunoMatches.length}`);
    
    if (brunoMatches.length === 0) {
      // Busca mais ampla
      const broadMatches = candidates.filter(candidate => {
        const hasVilefort = candidate.name && candidate.name.toLowerCase().includes('vilefort');
        const hasEmail = candidate.email && candidate.email.toLowerCase().includes('bruno.clara');
        const hasPhone = candidate.phone && candidate.phone.includes('91505564');
        
        return hasVilefort || hasEmail || hasPhone;
      });
      
      console.log(`🔍 Busca ampla encontrou: ${broadMatches.length} candidatos`);
      
      if (broadMatches.length === 0) {
        console.log('❌ Candidato Bruno Vilefort não encontrado');
        return;
      }
      
      brunoMatches.push(...broadMatches);
    }
    
    // 3. Deletar cada candidato encontrado
    console.log('\n🗑️ Deletando candidatos...');
    
    for (const candidate of brunoMatches) {
      try {
        console.log(`🗑️ Deletando candidato ID: ${candidate.id} (${candidate.name})`);
        
        const deleteResponse = await fetch(`http://localhost:5000/api/candidates/${candidate.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (deleteResponse.ok) {
          console.log(`✅ Candidato ${candidate.id} (${candidate.name}) deletado com sucesso`);
        } else {
          console.error(`❌ Erro ao deletar candidato ${candidate.id}: ${deleteResponse.status}`);
        }
        
      } catch (error) {
        console.error(`❌ Erro ao deletar candidato ${candidate.id}:`, error);
      }
    }
    
    console.log('\n🎉 [FINALIZADO] Processo de deleção concluído!');
    
  } catch (error) {
    console.error('❌ [ERRO GERAL] Falha no processo:', error);
  }
}

// Executar deleção
deleteBrunoVilefortDirect().catch(console.error);