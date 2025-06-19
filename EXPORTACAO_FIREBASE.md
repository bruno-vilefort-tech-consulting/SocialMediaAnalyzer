# 🔥 GUIA DE EXPORTAÇÃO E IMPORTAÇÃO - BANCO DE DADOS FIREBASE

## 📋 COMANDOS PARA BACKUP DO BANCO

### Exportação Completa do Firestore
```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login no Firebase
firebase login

# Exportar todas as coleções
firebase firestore:export gs://seu-bucket/backup-$(date +%Y%m%d) --project seu-projeto-id

# Exportar coleções específicas
firebase firestore:export gs://seu-bucket/backup-$(date +%Y%m%d) \
  --collection-ids users,clients,jobs,questions,candidates,selections,interviews,responses,reports
```

### Importação Para Novo Projeto
```bash
# Importar backup completo
firebase firestore:import gs://seu-bucket/backup-YYYYMMDD --project novo-projeto-id

# Limpar banco antes de importar (cuidado!)
firebase firestore:delete --all-collections --project novo-projeto-id
```

## 🗂️ ESTRUTURA DE DADOS PARA EXPORTAÇÃO MANUAL

### Script de Exportação JavaScript
```javascript
// export-firestore.js
const admin = require('firebase-admin');
const fs = require('fs');

// Inicializar Firebase Admin
const serviceAccount = require('./firebase-admin-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function exportCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const docs = {};
  
  snapshot.forEach(doc => {
    docs[doc.id] = doc.data();
  });
  
  fs.writeFileSync(`backup_${collectionName}.json`, JSON.stringify(docs, null, 2));
  console.log(`Exported ${snapshot.size} documents from ${collectionName}`);
}

async function exportAllData() {
  const collections = [
    'users', 'clients', 'jobs', 'questions', 
    'candidates', 'candidate-lists', 'candidate-list-memberships',
    'selections', 'interviews', 'responses',
    'reports', 'report-candidates', 'report-responses',
    'apiConfigs', 'masterSettings', 'messageLogs'
  ];
  
  for (const collection of collections) {
    try {
      await exportCollection(collection);
    } catch (error) {
      console.log(`Collection ${collection} not found or empty`);
    }
  }
  
  console.log('Export completed!');
  process.exit();
}

exportAllData();
```

### Script de Importação JavaScript
```javascript
// import-firestore.js
const admin = require('firebase-admin');
const fs = require('fs');

// Inicializar Firebase Admin
const serviceAccount = require('./firebase-admin-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importCollection(collectionName) {
  const filename = `backup_${collectionName}.json`;
  
  if (!fs.existsSync(filename)) {
    console.log(`File ${filename} not found, skipping...`);
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const batch = db.batch();
  let count = 0;
  
  for (const [docId, docData] of Object.entries(data)) {
    const docRef = db.collection(collectionName).doc(docId);
    batch.set(docRef, docData);
    count++;
    
    // Firestore batch limit is 500
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`Imported ${count} documents to ${collectionName}`);
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`Completed import of ${count} documents to ${collectionName}`);
}

async function importAllData() {
  const collections = [
    'users', 'clients', 'jobs', 'questions', 
    'candidates', 'candidate-lists', 'candidate-list-memberships',
    'selections', 'interviews', 'responses',
    'reports', 'report-candidates', 'report-responses',
    'apiConfigs', 'masterSettings', 'messageLogs'
  ];
  
  for (const collection of collections) {
    await importCollection(collection);
  }
  
  console.log('Import completed!');
  process.exit();
}

importAllData();
```

## 🎵 BACKUP DOS ARQUIVOS DE ÁUDIO

### Estrutura dos Arquivos
```
uploads/
├── audio_5511984316526_1750361142848_R1.ogg
├── audio_5511984316526_1750361142848_R2.ogg
├── audio_5511984316526_1750318034686_R1.ogg
├── audio_5511984316526_1750318034686_R2.ogg
└── temp/ (arquivos temporários - pode excluir)
```

### Script de Backup de Áudios
```bash
#!/bin/bash
# backup-audios.sh

BACKUP_DIR="backup-audios-$(date +%Y%m%d-%H%M)"
mkdir -p $BACKUP_DIR

# Copiar apenas arquivos .ogg com padrão correto
find uploads/ -name "audio_*.ogg" -exec cp {} $BACKUP_DIR/ \;

# Criar arquivo de índice
ls -la $BACKUP_DIR/ > $BACKUP_DIR/audio-index.txt

# Compactar
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR/
rm -rf $BACKUP_DIR/

echo "Backup de áudios criado: $BACKUP_DIR.tar.gz"
```

## 📊 DADOS ATUAIS DO SISTEMA

### Estrutura Confirmada no Firebase
```
✅ users (3 documentos)
✅ clients (2 documentos) 
✅ jobs (2 documentos)
✅ questions (4 documentos)
✅ candidates (16 documentos)
✅ candidate-lists (2 documentos)
✅ candidate-list-memberships (2 documentos)
✅ selections (3 documentos)
✅ interviews (dados dinâmicos)
✅ responses (dados dinâmicos)
✅ reports (1 documento - sistema novo)
✅ report-candidates (dados preservados)
✅ report-responses (dados preservados)
✅ apiConfigs (5 documentos)
```

### Exemplo de Dados Reais
```json
// Cliente Exemplo
{
  "id": 1749849987543,
  "companyName": "Grupo Maximuns",
  "email": "contato@grupomaximuns.com.br",
  "monthlyLimit": 5,
  "currentUsage": 0
}

// Seleção Exemplo  
{
  "id": 1750361142848,
  "name": "Consultor GM 17",
  "jobId": "1750101952075",
  "status": "enviado",
  "clientId": 1749849987543
}

// Resposta com Nova Nomenclatura
{
  "audioFile": "audio_5511984316526_1750361142848_R2.ogg",
  "transcription": "Sim, eu já trabalhei muito com essa área financeira...",
  "score": 85
}
```

## 🔄 PROCESSO COMPLETO DE MIGRAÇÃO

### 1. Preparação
```bash
# Criar diretório de backup
mkdir backup-completo-$(date +%Y%m%d)
cd backup-completo-$(date +%Y%m%d)

# Exportar código fonte
tar -czf codigo-fonte.tar.gz ../client ../server ../shared

# Backup banco de dados
node ../export-firestore.js

# Backup áudios
../backup-audios.sh
```

### 2. Validação
```bash
# Verificar integridade dos backups
tar -tzf codigo-fonte.tar.gz | head -10
ls -la backup_*.json
tar -tzf backup-audios-*.tar.gz | head -10
```

### 3. Restauração em Novo Ambiente
```bash
# Descompactar código
tar -xzf codigo-fonte.tar.gz

# Instalar dependências
cd client && npm install && cd ..
cd server && npm install && cd ..

# Configurar novo Firebase
# - Criar projeto
# - Habilitar Firestore
# - Baixar chave de serviço

# Importar dados
node import-firestore.js

# Restaurar áudios
tar -xzf backup-audios-*.tar.gz
cp backup-audios-*/*.ogg uploads/
```

## ⚠️ CONSIDERAÇÕES IMPORTANTES

### Segurança
- Criptografar backups com dados sensíveis
- Não versionar chaves de API
- Usar IAM roles para acesso Firebase
- Rotacionar credenciais periodicamente

### Performance
- Exportar em lotes para grandes volumes
- Usar compressão para reduzir tamanho
- Verificar limites de bandwidth Firebase
- Monitorar custos de storage

### Conformidade
- Seguir LGPD para dados pessoais
- Documentar retenção de dados
- Implementar purga automática
- Manter auditoria de acessos