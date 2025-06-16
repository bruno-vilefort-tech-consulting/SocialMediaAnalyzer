import fs from 'fs';

function corrigirEndpointsOpenAI() {
  console.log("🔧 CORRIGINDO ENDPOINTS OPENAI PARA USAR MASTER SETTINGS...\n");

  const routesPath = './server/routes.ts';
  let content = fs.readFileSync(routesPath, 'utf8');
  let changes = 0;

  // 1. Corrigir getApiConfig() para getMasterSettings()
  const pattern1 = /const\s+apiConfig\s*=\s*await\s+storage\.getApiConfig\(\);/g;
  content = content.replace(pattern1, 'const masterSettings = await storage.getMasterSettings();');
  changes += (content.match(pattern1) || []).length;

  // 2. Corrigir verificações de chave API
  const pattern2 = /if\s*\(\s*!?apiConfig\?\.openaiApiKey\s*\)/g;
  content = content.replace(pattern2, 'if (!masterSettings?.openaiApiKey)');
  changes += (content.match(pattern2) || []).length;

  // 3. Corrigir Authorization headers
  const pattern3 = /Bearer\s+\$\{apiConfig\.openaiApiKey\}/g;
  content = content.replace(pattern3, 'Bearer ${masterSettings.openaiApiKey}');
  changes += (content.match(pattern3) || []).length;

  // 4. Corrigir model GPT
  const pattern4 = /apiConfig\?\.gptModel/g;
  content = content.replace(pattern4, 'masterSettings?.gptModel');
  changes += (content.match(pattern4) || []).length;

  // 5. Corrigir comentários
  content = content.replace(/\/\/\s*Get\s+API\s+config\s+for\s+OpenAI/g, '// Get master settings for OpenAI');

  // Escrever arquivo corrigido
  fs.writeFileSync(routesPath, content);

  console.log(`✅ ${changes} correções aplicadas nos endpoints OpenAI`);
  console.log("📊 Agora todos endpoints usam masterSettings global para OpenAI\n");

  // Verificar se ainda há referências antigas
  const remaining = content.match(/apiConfig.*openai/gi) || [];
  if (remaining.length > 0) {
    console.log("⚠️ Ainda há referências que podem precisar de correção manual:");
    remaining.forEach(ref => console.log(`   - ${ref}`));
  } else {
    console.log("🎉 Todas as referências OpenAI foram corrigidas com sucesso!");
  }
}

corrigirEndpointsOpenAI();