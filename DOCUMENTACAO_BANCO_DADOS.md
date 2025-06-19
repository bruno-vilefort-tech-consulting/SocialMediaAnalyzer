# 📊 DOCUMENTAÇÃO COMPLETA DO BANCO DE DADOS - SISTEMA DE ENTREVISTAS IA

## 🏗️ ARQUITETURA GERAL

O sistema utiliza **Firebase Firestore** como banco de dados principal. Todas as coleções são gerenciadas através do arquivo `server/storage.ts` que implementa a interface `IStorage`.

## 📋 COLEÇÕES DO BANCO DE DADOS

### 1️⃣ **USERS** - Usuários do Sistema
```json
{
  "id": "1750131049173",
  "email": "danielmoreirabraga@gmail.com",
  "name": "Daniel Braga",
  "role": "client", // ou "master"
  "clientId": 1749849987543, // apenas para role "client"
  "password": "$2b$10$xJhi8oVahr0lmYfntEeTGeYR8eyNkO4x3P2Lo0Opyw/EVJX2XZDMG",
  "status": "active",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```
**Funcionalidade**: Armazena credenciais e perfis de usuários masters e clientes.

### 2️⃣ **CLIENTS** - Empresas Clientes
```json
{
  "id": 1749849987543,
  "companyName": "Grupo Maximuns",
  "email": "contato@grupomaximuns.com.br",
  "password": "$2b$10$...",
  "monthlyLimit": 5,
  "currentUsage": 0,
  "contractEnd": null,
  "additionalLimitExpiry": null,
  "createdAt": "Timestamp"
}
```
**Funcionalidade**: Dados das empresas que contratam o serviço de entrevistas.

### 3️⃣ **JOBS** - Vagas de Emprego
```json
{
  "id": "1750101952075",
  "nomeVaga": "Consultor Financeiro",
  "descricaoVaga": "Vaga para consultor com experiência...",
  "clientId": 1749849987543,
  "createdAt": "Timestamp"
}
```
**Funcionalidade**: Cadastro de vagas disponíveis por cliente.

### 4️⃣ **QUESTIONS** - Perguntas das Entrevistas
```json
{
  "id": 1750101952076,
  "jobId": "1750101952075",
  "questionText": "Você é consultor há quanto tempo?",
  "idealAnswer": "Espero uma resposta com experiência...",
  "questionOrder": 1,
  "createdAt": "Timestamp"
}
```
**Funcionalidade**: Perguntas específicas para cada vaga.

### 5️⃣ **CANDIDATE-LISTS** - Listas de Candidatos
```json
{
  "id": 1750273793939,
  "name": "Consultor 10",
  "description": "Lista de consultores financeiros",
  "clientId": 1749849987543,
  "createdAt": "Timestamp"
}
```
**Funcionalidade**: Organização de candidatos em listas temáticas.

### 6️⃣ **CANDIDATES** - Candidatos
```json
{
  "id": 1750309705713,
  "name": "Daniel Braga",
  "email": "dmbl@hotmail.com",
  "whatsapp": "5511984316526",
  "clientId": 1749849987543,
  "createdAt": "Timestamp"
}
```
**Funcionalidade**: Dados pessoais dos candidatos.

### 7️⃣ **CANDIDATE-LIST-MEMBERSHIPS** - Relacionamentos N:N
```json
{
  "id": "1750309705713_1750273793939",
  "candidateId": 1750309705713,
  "listId": 1750273793939,
  "clientId": 1749849987543,
  "createdAt": "Timestamp"
}
```
**Funcionalidade**: Relacionamento muitos-para-muitos entre candidatos e listas.

### 8️⃣ **SELECTIONS** - Campanhas de Entrevista
```json
{
  "id": 1750361142848,
  "name": "Consultor GM 17",
  "jobId": "1750101952075",
  "candidateListId": 1750273793939,
  "clientId": 1749849987543,
  "status": "enviado", // ou "active", "completed"
  "sendVia": "whatsapp",
  "whatsappTemplate": "Olá [nome do candidato]...",
  "deadline": "2025-06-26T19:25:57.305Z",
  "createdAt": "Timestamp"
}
```
**Funcionalidade**: Campanhas que conectam vagas, candidatos e entrevistas.

### 9️⃣ **INTERVIEWS** - Entrevistas Individuais
```json
{
  "id": "interview_1750309705713",
  "selectionId": 1750361142848,
  "candidateId": 1750309705713,
  "status": "completed", // ou "invited", "in_progress"
  "totalScore": 85,
  "startedAt": "Timestamp",
  "completedAt": "Timestamp",
  "createdAt": "Timestamp"
}
```
**Funcionalidade**: Controle individual de cada entrevista.

### 🔟 **RESPONSES** - Respostas dos Candidatos
```json
{
  "id": "1750361142848_candidate_1750361142848_5511984316526_R2_1750361222360",
  "selectionId": "1750361142848",
  "candidateId": "candidate_1750361142848_5511984316526",
  "questionId": 2,
  "questionText": "Você já deu consultoria financeira antes?",
  "transcription": "Sim, eu já trabalhei muito com essa área financeira...",
  "audioFile": "audio_5511984316526_1750361142848_R2.ogg",
  "score": 85,
  "recordingDuration": 15000,
  "aiAnalysis": "Resposta demonstra experiência...",
  "createdAt": "Timestamp"
}
```
**Funcionalidade**: Armazena respostas de áudio, transcrições e pontuações.

## 🔄 **SISTEMA DE RELATÓRIOS INDEPENDENTES**

### 1️⃣1️⃣ **REPORTS** - Relatórios Históricos
```json
{
  "id": "report_1750361142848_1750361171096",
  "selectionId": "1750361142848",
  "selectionName": "Consultor GM 17",
  "jobName": "Consultor Financeiro",
  "clientId": 1749849987543,
  "clientName": "Grupo Maximuns",
  "candidateListName": "Consultor 10",
  "totalCandidates": 1,
  "completedInterviews": 1,
  "createdAt": "Timestamp"
}
```

### 1️⃣2️⃣ **REPORT-CANDIDATES** - Candidatos do Relatório
```json
{
  "id": "reportCandidate_1750361142848_1750309705713",
  "reportId": "report_1750361142848_1750361171096",
  "originalCandidateId": "1750309705713",
  "name": "Daniel Braga",
  "email": "dmbl@hotmail.com",
  "whatsapp": "5511984316526",
  "status": "completed",
  "totalScore": 85,
  "completedAt": "Timestamp",
  "createdAt": "Timestamp"
}
```

### 1️⃣3️⃣ **REPORT-RESPONSES** - Respostas do Relatório
```json
{
  "id": "reportResponse_1750361142848_1750309705713_2",
  "reportId": "report_1750361142848_1750361171096",
  "reportCandidateId": "reportCandidate_1750361142848_1750309705713",
  "questionNumber": 2,
  "questionText": "Você já deu consultoria financeira antes?",
  "transcription": "Sim, eu já trabalhei muito com essa área financeira...",
  "audioFile": "audio_5511984316526_1750361142848_R2.ogg",
  "score": 85,
  "recordingDuration": 15000,
  "aiAnalysis": "Resposta demonstra experiência...",
  "createdAt": "Timestamp"
}
```

## ⚙️ **CONFIGURAÇÕES DO SISTEMA**

### 1️⃣4️⃣ **API-CONFIGS** - Configurações por Cliente
```json
{
  "id": "client_1749849987543",
  "entityType": "client",
  "entityId": "1749849987543",
  "openaiApiKey": "sk-...",
  "openaiModel": "gpt-4o",
  "voice": "nova",
  "qrCode": "data:image/png;base64...",
  "connectionStatus": "connected",
  "lastConnected": "Timestamp",
  "createdAt": "Timestamp"
}
```

### 1️⃣5️⃣ **MASTER-SETTINGS** - Configurações Globais
```json
{
  "id": "master_settings",
  "openaiApiKey": "sk-...",
  "openaiModel": "gpt-4o",
  "defaultVoice": "nova",
  "createdAt": "Timestamp"
}
```

### 1️⃣6️⃣ **MESSAGE-LOGS** - Logs de Comunicação
```json
{
  "id": "log_1750361142848_5511984316526",
  "interviewId": "interview_1750309705713",
  "candidatePhone": "5511984316526",
  "messageType": "question", // ou "response", "system"
  "content": "Pergunta enviada via áudio",
  "timestamp": "Timestamp",
  "successful": true
}
```

## 🔗 **RELACIONAMENTOS ENTRE COLEÇÕES**

```
CLIENTS (1) ←→ (N) USERS (via clientId)
CLIENTS (1) ←→ (N) JOBS
CLIENTS (1) ←→ (N) CANDIDATE-LISTS
CLIENTS (1) ←→ (N) CANDIDATES
JOBS (1) ←→ (N) QUESTIONS
JOBS (1) ←→ (N) SELECTIONS
CANDIDATE-LISTS (1) ←→ (N) SELECTIONS
CANDIDATE-LISTS (N) ←→ (N) CANDIDATES (via MEMBERSHIPS)
SELECTIONS (1) ←→ (N) INTERVIEWS
INTERVIEWS (1) ←→ (N) RESPONSES
SELECTIONS (1) ←→ (1) REPORTS (histórico independente)
```

## 🔄 **FLUXO DE DADOS PRINCIPAL**

1. **Cliente** cria **Job** com **Questions**
2. **Cliente** cria **Candidate-List** e adiciona **Candidates**
3. **Cliente** cria **Selection** conectando Job + Lista
4. **Sistema** envia convites via WhatsApp
5. **Candidatos** respondem criando **Interviews** e **Responses**
6. **Sistema** gera **Report** independente preservando histórico

## 📊 **NOMENCLATURA DE ARQUIVOS DE ÁUDIO**

- **Formato**: `audio_[whatsapp]_[selectionId]_R[numero].ogg`
- **Exemplo**: `audio_5511984316526_1750361142848_R2.ogg`
- **Localização**: Pasta `/uploads/`

## 🔧 **MÉTODOS DE ACESSO (storage.ts)**

### Usuários
- `getUserById()`, `getUserByEmail()`, `createUser()`, `updateUser()`

### Clientes
- `getClients()`, `getClientById()`, `createClient()`, `updateClient()`

### Vagas e Perguntas
- `getJobsByClientId()`, `createJob()`, `getQuestionsByJobId()`

### Candidatos e Listas
- `getCandidatesByClientId()`, `createCandidate()`, `addCandidateToList()`

### Seleções e Entrevistas
- `getSelectionsByClientId()`, `createSelection()`, `getInterviewsBySelectionId()`

### Relatórios (Sistema Independente)
- `getAllReports()`, `generateReportFromSelection()`, `deleteReport()`

## 🛡️ **SEGURANÇA E ISOLAMENTO**

- **Filtro por clientId**: Cada operação valida acesso por cliente
- **Autenticação JWT**: Tokens incluem role e clientId
- **Middleware de autorização**: Verifica permissões por endpoint
- **Dados isolados**: Relatórios preservam informações independentes

## 🔄 **BACKUP E RESTAURAÇÃO**

Para backup completo:
1. Exportar todas as coleções do Firebase
2. Salvar arquivos de áudio da pasta `/uploads/`
3. Preservar configurações de ambiente
4. Documentar estrutura de dados atual

Para restauração:
1. Configurar novo projeto Firebase
2. Importar todas as coleções
3. Restaurar arquivos de áudio
4. Configurar variáveis de ambiente
5. Testar fluxo completo de entrevistas