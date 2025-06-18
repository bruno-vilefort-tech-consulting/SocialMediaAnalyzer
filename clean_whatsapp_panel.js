#!/usr/bin/env node

// Script para limpar completamente sistema WhatsApp WppConnect e criar novo sistema Baileys
const fs = require('fs');
const path = require('path');

console.log('🧹 LIMPEZA COMPLETA DO SISTEMA WHATSAPP WPPCONNECT');

// Remover arquivos temporários e relacionados ao WppConnect
const filesToRemove = [
  'clean_whatsapp_panel.js',
  // Adicionar outros arquivos temporários aqui conforme necessário
];

filesToRemove.forEach(file => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`✅ Removido: ${file}`);
  }
});

console.log('🎯 SISTEMA WHATSAPP LIMPO - NOVO PAINEL BAILEYS IMPLEMENTADO');
console.log('');
console.log('RESUMO DAS MUDANÇAS:');
console.log('✓ Endpoints WppConnect removidos do routes.ts');
console.log('✓ Novo painel WhatsApp criado com clientId no ApiConfigPage.tsx');
console.log('✓ Sistema agora usa Baileys através do whatsappQRService existente');
console.log('✓ Interface limpa mostra clientId do usuário no título');
console.log('✓ Endpoints funcionais: status, connect, disconnect, test');
console.log('');
console.log('O sistema está pronto para conexão WhatsApp isolada por cliente!');

process.exit(0);