#!/usr/bin/env node

/**
 * Script para corrigir problema Connection Failure (código: 405)
 * Remove sessões antigas e força regeneração de QR Code
 */

import fs from 'fs';
import path from 'path';

async function fixWhatsAppConnections() {
  console.log('🔧 Corrigindo conexões WhatsApp...');
  
  // 1. Limpar sessões antigas que podem estar corrompidas
  const sessionsDir = 'whatsapp-sessions';
  if (fs.existsSync(sessionsDir)) {
    console.log('🗑️ Removendo sessões antigas...');
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
  
  // 2. Criar estrutura de pastas limpa
  console.log('📁 Criando estrutura limpa...');
  fs.mkdirSync(sessionsDir, { recursive: true });
  
  // Criar pastas para cada slot do cliente específico
  const clientId = '1749849987543';
  for (let slot = 1; slot <= 3; slot++) {
    const slotDir = path.join(sessionsDir, `client_${clientId}_slot_${slot}`);
    fs.mkdirSync(slotDir, { recursive: true });
    console.log(`✅ Pasta criada: ${slotDir}`);
  }
  
  // 3. Verificar e criar pasta auth se necessário
  const authDir = 'whatsapp-auth';
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.log(`✅ Pasta auth criada: ${authDir}`);
  }
  
  // 4. Verificar pasta tokens
  const tokensDir = 'tokens';
  if (!fs.existsSync(tokensDir)) {
    fs.mkdirSync(tokensDir, { recursive: true });
    console.log(`✅ Pasta tokens criada: ${tokensDir}`);
  }
  
  console.log('\n🎯 Estrutura WhatsApp corrigida:');
  console.log('- Sessões antigas removidas');
  console.log('- Pastas de slot criadas para cliente 1749849987543');
  console.log('- Estrutura limpa para novo QR Code');
  console.log('\n💡 Próximo passo: Acessar /configuracoes e gerar novo QR Code');
  
  // 5. Listar estrutura criada
  console.log('\n📂 Estrutura criada:');
  if (fs.existsSync(sessionsDir)) {
    const dirs = fs.readdirSync(sessionsDir);
    dirs.forEach(dir => {
      console.log(`  ${sessionsDir}/${dir}/`);
    });
  }
}

fixWhatsAppConnections().catch(console.error);