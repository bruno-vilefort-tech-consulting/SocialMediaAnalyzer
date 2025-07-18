console.log('🧪 [TESTE] ===== TESTANDO CARREGAMENTO DO SIMPLEMULTIBAILEY VIA TSX =====\n');

async function testSimpleMultiBaileyLoading() {
  console.log('📋 [FASE 1] Testando importação do simpleMultiBailey...');
  
  try {
    console.log('🔄 Importando simpleMultiBailey...');
    const { simpleMultiBaileyService } = await import('./whatsapp/services/simpleMultiBailey');
    
    console.log('✅ Import realizado com sucesso');
    console.log('🔍 Service loaded:', !!simpleMultiBaileyService);
    
    if (simpleMultiBaileyService) {
      console.log('📋 [FASE 2] Testando métodos do service...');
      
      // Testar método getClientConnections
      console.log('🔄 Testando getClientConnections...');
      const connections = await simpleMultiBaileyService.getClientConnections('1749849987543');
      
      console.log('✅ getClientConnections executado com sucesso');
      console.log('📊 Resultado:', {
        clientId: connections.clientId,
        totalConnections: connections.totalConnections,
        activeConnections: connections.activeConnections,
        connectionsCount: connections.connections.length
      });
      
      console.log('🎉 [RESULTADO] SIMPLEMULTIBAILEY TOTALMENTE FUNCIONAL!');
      console.log('✅ Importação: OK');
      console.log('✅ Métodos: OK');
      console.log('✅ Retorno de dados: OK');
      
    } else {
      console.log('❌ [ERRO] Service não foi carregado corretamente');
    }
    
  } catch (error) {
    console.error('❌ [ERRO] Falha ao carregar simpleMultiBailey:', error);
    console.error('📋 [DETALHES] Error message:', error.message);
    console.error('📋 [DETALHES] Stack trace:', error.stack);
    
    console.log('\n🔍 [DIAGNÓSTICO] Possíveis causas:');
    console.log('   1. Arquivo simpleMultiBailey.ts não existe');
    console.log('   2. Erro de sintaxe no arquivo');
    console.log('   3. Dependência não instalada');
    console.log('   4. Problema na exportação do módulo');
    console.log('   5. Erro na inicialização do service');
  }
}

// Executar teste
testSimpleMultiBaileyLoading().catch(console.error);