// Script para corrigir problemas de inicialização do sistema
// Remove processos WhatsApp problemáticos e permite inicialização limpa

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

async function fixStartup() {
  console.log('🔧 Corrigindo problemas de inicialização...');
  
  try {
    // 1. Limpar sessões WhatsApp problemáticas
    const whatsappSessionsDir = path.join(process.cwd(), 'whatsapp-sessions');
    if (fs.existsSync(whatsappSessionsDir)) {
      console.log('🗑️ Limpando sessões WhatsApp...');
      fs.rmSync(whatsappSessionsDir, { recursive: true, force: true });
      console.log('✅ Sessões WhatsApp removidas');
    }
    
    // 2. Limpar diretório de auth
    const whatsappAuthDir = path.join(process.cwd(), 'whatsapp-auth');
    if (fs.existsSync(whatsappAuthDir)) {
      console.log('🗑️ Limpando auth WhatsApp...');
      fs.rmSync(whatsappAuthDir, { recursive: true, force: true });
      console.log('✅ Auth WhatsApp removido');
    }
    
    // 3. Criar backup do arquivo index.ts original
    const indexPath = path.join(process.cwd(), 'server', 'index.ts');
    if (fs.existsSync(indexPath)) {
      console.log('💾 Criando backup do index.ts...');
      const content = fs.readFileSync(indexPath, 'utf8');
      
      // Criar versão sem WhatsApp Manager
      const cleanContent = content.replace(
        /\/\/ Initialize WhatsApp Manager[\s\S]*?setTimeout\(initWhatsAppBackground, 2000\);/g,
        '// WhatsApp initialization disabled for clean startup'
      );
      
      fs.writeFileSync(indexPath, cleanContent);
      console.log('✅ Index.ts limpo para inicialização');
    }
    
    console.log('🎉 Sistema preparado para inicialização limpa');
    console.log('👉 Execute: npm run dev');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir startup:', error);
  }
}

fixStartup();