// Script para iniciar Evolution API em processo separado
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando Evolution API...');

const evolutionProcess = spawn('node', ['src/main.js'], {
  cwd: path.join(__dirname, 'evolution-api'),
  stdio: 'inherit',
  env: {
    ...process.env,
    EVOLUTION_PORT: 3001,
    EVOLUTION_API_KEY: 'evolution_maximus_secure_key_2025'
  }
});

evolutionProcess.on('error', (error) => {
  console.error('❌ Erro ao iniciar Evolution API:', error);
});

evolutionProcess.on('exit', (code) => {
  console.log(`Evolution API encerrada com código: ${code}`);
});

// Manter o processo rodando
process.on('SIGINT', () => {
  console.log('Parando Evolution API...');
  evolutionProcess.kill();
  process.exit(0);
});