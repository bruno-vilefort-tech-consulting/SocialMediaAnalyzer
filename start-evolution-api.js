#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando Evolution API...');

// Configurar o diretório da Evolution API
const evolutionDir = path.join(__dirname, 'evolution-api-main');

// Verificar se o diretório existe
const fs = require('fs');
if (!fs.existsSync(evolutionDir)) {
  console.error('❌ Diretório evolution-api-main não encontrado');
  process.exit(1);
}

// Instalar dependências se necessário
console.log('📦 Verificando dependências...');
const installProcess = spawn('npm', ['install'], {
  cwd: evolutionDir,
  stdio: 'pipe'
});

installProcess.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Erro ao instalar dependências:', code);
    return;
  }
  
  console.log('✅ Dependências instaladas');
  
  // Iniciar a Evolution API
  console.log('🎯 Iniciando servidor Evolution API na porta 3000...');
  
  const evolutionProcess = spawn('npm', ['run', 'start:dev'], {
    cwd: evolutionDir,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  evolutionProcess.stdout.on('data', (data) => {
    console.log(`[EVOLUTION] ${data.toString().trim()}`);
  });
  
  evolutionProcess.stderr.on('data', (data) => {
    console.error(`[EVOLUTION ERROR] ${data.toString().trim()}`);
  });
  
  evolutionProcess.on('close', (code) => {
    console.log(`[EVOLUTION] Processo finalizado com código ${code}`);
  });
  
  // Manter o processo vivo
  process.on('SIGINT', () => {
    console.log('🛑 Finalizando Evolution API...');
    evolutionProcess.kill();
    process.exit(0);
  });
});

installProcess.stderr.on('data', (data) => {
  console.error(`[NPM ERROR] ${data.toString().trim()}`);
});