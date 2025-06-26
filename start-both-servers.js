#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Iniciando ambos os servidores...');

// Iniciar Evolution API na porta 3000
console.log('📡 Iniciando Evolution API na porta 3000...');
const evolutionProcess = spawn('node', ['simple-evolution-server.js'], {
  cwd: __dirname,
  stdio: 'pipe',
  env: { ...process.env }
});

evolutionProcess.stdout.on('data', (data) => {
  console.log(`[EVOLUTION] ${data.toString().trim()}`);
});

evolutionProcess.stderr.on('data', (data) => {
  console.error(`[EVOLUTION ERROR] ${data.toString().trim()}`);
});

// Aguardar alguns segundos para Evolution API iniciar
setTimeout(() => {
  console.log('🌟 Iniciando servidor principal na porta 5000...');
  
  // Iniciar servidor principal
  const mainProcess = spawn('tsx', ['server/index.ts'], {
    cwd: __dirname,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development' }
  });

  mainProcess.stdout.on('data', (data) => {
    console.log(`[MAIN] ${data.toString().trim()}`);
  });

  mainProcess.stderr.on('data', (data) => {
    console.error(`[MAIN ERROR] ${data.toString().trim()}`);
  });

  mainProcess.on('close', (code) => {
    console.log(`[MAIN] Processo finalizado com código ${code}`);
    evolutionProcess.kill();
    process.exit(code);
  });
  
}, 3000);

evolutionProcess.on('close', (code) => {
  console.log(`[EVOLUTION] Processo finalizado com código ${code}`);
});

// Manter o processo vivo e tratar sinais
process.on('SIGINT', () => {
  console.log('🛑 Finalizando ambos os servidores...');
  evolutionProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Finalizando ambos os servidores...');
  evolutionProcess.kill();
  process.exit(0);
});