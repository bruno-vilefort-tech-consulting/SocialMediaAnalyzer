// Test script for User Isolated Round Robin System
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testUserRoundRobinSystem() {
  console.log('🔥 Testando Sistema de Round Robin Isolado por Usuário...\n');
  
  // Test 1: Verificar se o sistema está rodando
  console.log('📊 Teste 1: Verificando se o sistema está rodando...');
  try {
    const response = await fetch(`${BASE_URL}/`);
    if (response.ok) {
      console.log('✅ Sistema está rodando na porta 5000');
    } else {
      console.log('❌ Sistema não está respondendo corretamente');
    }
  } catch (error) {
    console.error('❌ Erro ao conectar com o sistema:', error.message);
    return;
  }
  
  // Test 2: Verificar se o arquivo userIsolatedRoundRobin existe
  console.log('\n📁 Teste 2: Verificando se o arquivo userIsolatedRoundRobin existe...');
  
  const fs = await import('fs');
  const path = await import('path');
  
  const filePath = path.join(process.cwd(), 'whatsapp', 'services', 'userIsolatedRoundRobin.ts');
  
  if (fs.existsSync(filePath)) {
    console.log('✅ Arquivo userIsolatedRoundRobin.ts existe');
  } else {
    console.log('❌ Arquivo userIsolatedRoundRobin.ts não encontrado');
  }
  
  // Test 3: Verificar se o arquivo interactiveInterviewService foi modificado
  console.log('\n🔧 Teste 3: Verificando modificações no interactiveInterviewService...');
  
  const interviewServicePath = path.join(process.cwd(), 'server', 'interactiveInterviewService.ts');
  
  if (fs.existsSync(interviewServicePath)) {
    const content = fs.readFileSync(interviewServicePath, 'utf-8');
    
    if (content.includes('activateUserImmediateCadence')) {
      console.log('✅ Método activateUserImmediateCadence encontrado');
    } else {
      console.log('❌ Método activateUserImmediateCadence não encontrado');
    }
    
    if (content.includes('userIsolatedRoundRobin')) {
      console.log('✅ Import do userIsolatedRoundRobin encontrado');
    } else {
      console.log('❌ Import do userIsolatedRoundRobin não encontrado');
    }
  } else {
    console.log('❌ Arquivo interactiveInterviewService.ts não encontrado');
  }
  
  // Test 4: Verificar se os endpoints foram adicionados ao routes.ts
  console.log('\n🌐 Teste 4: Verificando endpoints no routes.ts...');
  
  const routesPath = path.join(process.cwd(), 'server', 'routes.ts');
  
  if (fs.existsSync(routesPath)) {
    const content = fs.readFileSync(routesPath, 'utf-8');
    
    const endpoints = [
      'user-round-robin/init-slots',
      'user-round-robin/configure-cadence',
      'user-round-robin/distribute-candidates',
      'user-round-robin/activate-immediate'
    ];
    
    let foundEndpoints = 0;
    
    for (const endpoint of endpoints) {
      if (content.includes(endpoint)) {
        console.log(`✅ Endpoint ${endpoint} encontrado`);
        foundEndpoints++;
      } else {
        console.log(`❌ Endpoint ${endpoint} não encontrado`);
      }
    }
    
    console.log(`📊 Total de endpoints encontrados: ${foundEndpoints}/${endpoints.length}`);
  } else {
    console.log('❌ Arquivo routes.ts não encontrado');
  }
  
  // Test 5: Verificar se o sistema está configurado para detecção de "1"
  console.log('\n🚀 Teste 5: Verificando detecção de "1" no sistema...');
  
  if (fs.existsSync(interviewServicePath)) {
    const content = fs.readFileSync(interviewServicePath, 'utf-8');
    
    const detectionPattern = /if\s*\(.*text\s*===\s*['"]1['"].*\)/;
    
    if (detectionPattern.test(content)) {
      console.log('✅ Detecção de "1" encontrada no código');
      
      if (content.includes('activateUserImmediateCadence')) {
        console.log('✅ Integração com cadência imediata encontrada');
      } else {
        console.log('❌ Integração com cadência imediata não encontrada');
      }
    } else {
      console.log('❌ Detecção de "1" não encontrada');
    }
  }
  
  // Test 6: Verificar se o sistema foi documentado no replit.md
  console.log('\n📋 Teste 6: Verificando documentação no replit.md...');
  
  const replitMdPath = path.join(process.cwd(), 'replit.md');
  
  if (fs.existsSync(replitMdPath)) {
    const content = fs.readFileSync(replitMdPath, 'utf-8');
    
    if (content.includes('ROUND ROBIN ISOLADO POR USUÁRIO')) {
      console.log('✅ Documentação encontrada no replit.md');
    } else {
      console.log('❌ Documentação não encontrada no replit.md');
    }
  } else {
    console.log('❌ Arquivo replit.md não encontrado');
  }
  
  console.log('\n🎉 Teste completo! Sistema de Round Robin Isolado por Usuário verificado.');
}

// Executar o teste
testUserRoundRobinSystem().catch(console.error);