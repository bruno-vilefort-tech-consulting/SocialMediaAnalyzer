// Script para iniciar Evolution API em processo separado
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Iniciando Evolution API...');

// Verificar se dependências estão instaladas
const evolutionDir = path.join(__dirname, 'evolution-api');
const nodeModulesPath = path.join(evolutionDir, 'node_modules');

if (!fs.existsSync(nodeModulesPath)) {
  console.log('📦 Instalando dependências da Evolution API...');
  const installProcess = spawn('npm', ['install'], {
    cwd: evolutionDir,
    stdio: 'inherit'
  });
  
  installProcess.on('exit', (code) => {
    if (code === 0) {
      startEvolutionApi();
    } else {
      console.error('❌ Falha ao instalar dependências');
    }
  });
} else {
  startEvolutionApi();
}

function startEvolutionApi() {
  const evolutionProcess = spawn('node', ['src/main.js'], {
    cwd: evolutionDir,
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
}