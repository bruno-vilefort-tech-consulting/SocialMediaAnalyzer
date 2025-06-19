# 🚀 INSTRUÇÕES COMPLETAS DE INSTALAÇÃO - SISTEMA DE ENTREVISTAS IA

## 📋 PRÉ-REQUISITOS

### Ambiente de Desenvolvimento
- **Node.js**: Versão 20+ (recomendado: 20.x LTS)
- **npm**: Versão 8+ (incluído com Node.js)
- **Git**: Para controle de versão

### Serviços Externos Necessários
1. **Firebase Project** (Firestore Database)
2. **OpenAI API Account** (para transcrição e análise)
3. **WhatsApp Business API** (opcional, para envio de mensagens)

## 🛠️ INSTALAÇÃO PASSO A PASSO

### 1️⃣ **Configuração do Projeto**

```bash
# 1. Descompactar o backup
unzip sistema-entrevistas-ia-backup.zip
cd sistema-entrevistas-ia

# 2. Instalar dependências
npm install

# 3. Configurar permissões (se necessário)
chmod +x server/index.ts
```

### 2️⃣ **Configuração do Firebase**

```bash
# 1. Criar projeto Firebase no console
# https://console.firebase.google.com/

# 2. Habilitar Firestore Database
# - Ir em "Firestore Database"
# - Clicar "Create database"
# - Escolher modo de produção
# - Selecionar região (preferencialmente us-central1)

# 3. Gerar credenciais de serviço
# - Ir em "Project Settings" > "Service accounts"
# - Clicar "Generate new private key"
# - Baixar arquivo JSON de credenciais

# 4. Configurar arquivo de credenciais
# Salvar o arquivo JSON como firebase-admin-key.json na raiz do projeto
```

### 3️⃣ **Variáveis de Ambiente**

Criar arquivo `.env` na raiz do projeto:

```env
# Database
DATABASE_URL="postgresql://placeholder" # Não usado, mas necessário para compatibilidade

# Firebase
FIREBASE_ADMIN_KEY_PATH="./firebase-admin-key.json"
FIREBASE_PROJECT_ID="seu-projeto-firebase-id"

# JWT Secret
JWT_SECRET="maximus-interview-system-secret-key-2024"

# OpenAI (obrigatório para funcionalidades de IA)
OPENAI_API_KEY="sk-sua-chave-openai-aqui"

# WhatsApp (opcional)
WHATSAPP_SESSION_PATH="./whatsapp-sessions"

# Servidor
PORT=5000
NODE_ENV=development
```

### 4️⃣ **Configuração do OpenAI**

```bash
# 1. Criar conta OpenAI
# https://platform.openai.com/

# 2. Gerar API Key
# - Ir em "API Keys"
# - Clicar "Create new secret key"
# - Copiar e adicionar ao arquivo .env

# 3. Adicionar créditos à conta (mínimo $5)
```

### 5️⃣ **Estrutura de Diretórios**

```
sistema-entrevistas-ia/
├── client/                 # Frontend React
│   ├── src/
│   ├── public/
│   └── dist/
├── server/                 # Backend Express
│   ├── index.ts
│   ├── storage.ts
│   ├── routes.ts
│   └── whatsappBaileyService.ts
├── shared/                 # Tipos compartilhados
│   └── schema.ts
├── uploads/                # Arquivos de áudio
├── whatsapp-sessions/      # Sessões WhatsApp
├── tokens/                 # Tokens temporários
├── firebase-admin-key.json # Credenciais Firebase
├── .env                    # Variáveis de ambiente
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 6️⃣ **Scripts de Desenvolvimento**

```bash
# Desenvolvimento (frontend + backend)
npm run dev

# Build para produção
npm run build

# Apenas backend
npm run server

# Apenas frontend
npm run client

# Linter
npm run lint

# Tipos TypeScript
npm run type-check
```

## 🔗 **CONFIGURAÇÃO INICIAL DO BANCO**

### Dados Iniciais Necessários

```javascript
// 1. Criar usuário master inicial
{
  id: "master_001",
  email: "admin@empresa.com",
  name: "Administrador",
  role: "master",
  password: "$2b$10$...", // Hash bcrypt da senha
  status: "active",
  createdAt: new Date()
}

// 2. Criar cliente exemplo
{
  id: Date.now(),
  companyName: "Empresa Exemplo",
  email: "cliente@empresa.com",
  password: "$2b$10$...", // Hash bcrypt da senha
  monthlyLimit: 10,
  currentUsage: 0,
  createdAt: new Date()
}
```

### Script de Inicialização (opcional)

```bash
# Executar script de setup inicial
node scripts/setup-initial-data.js
```

## 🚀 **INICIALIZAÇÃO E TESTES**

### 1️⃣ **Verificar Instalação**

```bash
# 1. Iniciar servidor
npm run dev

# 2. Acessar aplicação
# http://localhost:5000

# 3. Verificar logs
# - Backend deve conectar ao Firebase
# - Frontend deve carregar sem erros
# - WhatsApp deve inicializar (se configurado)
```

### 2️⃣ **Teste Básico de Funcionalidades**

```bash
# 1. Login no sistema
# - Acessar http://localhost:5000/login
# - Usar credenciais do usuário master

# 2. Criar cliente teste
# - Ir em "Clientes" > "Novo Cliente"
# - Preencher dados básicos

# 3. Criar vaga teste
# - Ir em "Vagas" > "Nova Vaga"
# - Adicionar 2-3 perguntas

# 4. Testar upload de candidatos
# - Ir em "Lista de Candidatos"
# - Fazer upload de arquivo CSV
```

### 3️⃣ **Configuração do WhatsApp (Opcional)**

```bash
# 1. Acessar configurações
# http://localhost:5000/configuracoes

# 2. Gerar QR Code
# - Clicar "Conectar WhatsApp"
# - Escanear QR Code com celular

# 3. Testar envio
# - Usar função "Teste de Mensagem"
```

## 🔧 **RESOLUÇÃO DE PROBLEMAS COMUNS**

### ❌ **Erro de Conexão Firebase**
```bash
# Verificar credenciais
cat firebase-admin-key.json | jq .project_id

# Verificar permissões Firestore
# - Rules devem permitir read/write autenticado
```

### ❌ **Erro OpenAI API**
```bash
# Testar chave API
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Verificar créditos disponíveis
```

### ❌ **Erro de Compilação TypeScript**
```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install

# Verificar versões
npm ls typescript
```

### ❌ **Erro de CORS**
```bash
# Verificar configuração Vite
# O proxy deve estar configurado para /api/*
```

## 📊 **MONITORAMENTO E LOGS**

### Logs do Sistema
```bash
# Backend logs
tail -f logs/backend.log

# Frontend logs (browser console)
# Acessar DevTools > Console

# Firebase logs
# Acessar Firebase Console > Logs
```

### Métricas Importantes
- Conexões WhatsApp ativas
- Uso da API OpenAI
- Entrevistas completadas/mês
- Erros de transcrição
- Performance do banco de dados

## 🛡️ **SEGURANÇA E BACKUP**

### Backup Regular
```bash
# Exportar dados Firebase
npx firebase-tools firestore:export backup/$(date +%Y%m%d)

# Backup arquivos de áudio
tar -czf audio-backup-$(date +%Y%m%d).tar.gz uploads/

# Backup configurações
cp .env config-backup-$(date +%Y%m%d).env
```

### Configurações de Segurança
- Usar HTTPS em produção
- Implementar rate limiting
- Configurar rules do Firestore adequadamente
- Rotacionar chaves API regularmente

## 🚀 **DEPLOY EM PRODUÇÃO**

### Preparação
```bash
# 1. Build otimizado
npm run build

# 2. Configurar variáveis de produção
export NODE_ENV=production
export PORT=80

# 3. Usar PM2 para gerenciamento de processos
npm install -g pm2
pm2 start ecosystem.config.js
```

### Considerações de Produção
- Usar banco de dados dedicado
- Configurar SSL/TLS
- Implementar monitoramento
- Configurar backup automático
- Usar CDN para assets estáticos

## 📞 **SUPORTE E MANUTENÇÃO**

### Logs de Debug
- Backend: `server/logs/`
- WhatsApp: `whatsapp-sessions/logs/`
- Firebase: Console Firebase

### Comandos Úteis
```bash
# Limpar sessões WhatsApp
rm -rf whatsapp-sessions/*

# Limpar cache upload
rm -rf uploads/temp/*

# Verificar status serviços
npm run health-check
```

### Contatos de Suporte
- Documentação: Este arquivo
- Logs: Verificar seção de monitoramento
- Issues: Revisar configurações passo a passo