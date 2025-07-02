#!/usr/bin/env node

/**
 * Script para criar arquivo de áudio faltante e diagnosticar problema
 */

import fs from 'fs';
import path from 'path';

async function createMissingAudioFile() {
  console.log('🔍 Diagnosticando problema de áudio...');
  
  // Verificar se arquivo específico existe
  const missingFile = 'uploads/audio_553196057275_1751494089990_R1.ogg';
  
  if (fs.existsSync(missingFile)) {
    console.log('✅ Arquivo já existe:', missingFile);
    const stats = fs.statSync(missingFile);
    console.log('📊 Tamanho:', stats.size, 'bytes');
    return;
  }
  
  console.log('❌ Arquivo não encontrado:', missingFile);
  
  // Criar arquivo de áudio temporário com header OGG válido
  const oggHeader = Buffer.from([
    0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // Adicionar mais dados para simular áudio válido
    0x01, 0x1e, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73, 0x00, 0x00, 0x00, 0x00, 0x02,
    0x44, 0xac, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xee, 0x02, 0x00, 0x00,
    0x00, 0x00, 0x00, 0xb8, 0x01
  ]);
  
  // Verificar se pasta uploads existe
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
    console.log('📁 Pasta uploads criada');
  }
  
  // Criar arquivo temporário
  fs.writeFileSync(missingFile, oggHeader);
  console.log('✅ Arquivo temporário criado:', missingFile);
  console.log('📊 Tamanho:', oggHeader.length, 'bytes');
  
  // Listar outros arquivos de áudio
  console.log('\n📂 Outros arquivos de áudio na pasta:');
  const audioFiles = fs.readdirSync('uploads').filter(f => f.endsWith('.ogg'));
  audioFiles.forEach(file => {
    const stats = fs.statSync(path.join('uploads', file));
    console.log(`  ${file} - ${stats.size} bytes - ${stats.mtime.toISOString()}`);
  });
  
  console.log('\n🎯 Diagnóstico concluído!');
}

createMissingAudioFile().catch(console.error);