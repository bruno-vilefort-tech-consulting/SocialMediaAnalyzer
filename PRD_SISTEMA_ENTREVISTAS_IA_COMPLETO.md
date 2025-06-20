# 📋 PRD - Sistema de Entrevistas por IA via WhatsApp

## 📑 ÍNDICE
1. [Visão Geral](#visão-geral)
2. [Arquitetura Técnica](#arquitetura-técnica)
3. [Funcionalidades Detalhadas](#funcionalidades-detalhadas)
4. [Fluxos de Usuário](#fluxos-de-usuário)
5. [Especificações de Interface](#especificações-de-interface)
6. [Integrações e APIs](#integrações-e-apis)
7. [Banco de Dados](#banco-de-dados)
8. [Configurações e Variáveis](#configurações-e-variáveis)
9. [Requisitos Técnicos](#requisitos-técnicos)
10. [Casos de Uso Avançados](#casos-de-uso-avançados)

---

## 📊 VISÃO GERAL

### **Objetivo**
Sistema completo de entrevistas automatizadas por IA que permite empresas realizarem seleções de candidatos via WhatsApp com transcrição automática e análise inteligente de respostas.

### **Personas**
1. **Master Administrator**: Gerencia o sistema, clientes e configurações globais
2. **Cliente Corporativo**: Empresa que contrata o serviço para realizar entrevistas
3. **Candidato**: Pessoa que participa da entrevista via WhatsApp

### **Proposta de Valor**
- Automatização completa do processo de entrevista
- Análise de candidatos por IA (GPT-4o)
- Transcrição automática de áudios (Whisper)
- Sistema multi-tenancy com isolamento total de dados
- Relatórios independentes e histórico preservado

---

## 🏗️ ARQUITETURA TÉCNICA

### **Stack Tecnológico**
```
Frontend: React 18 + TypeScript + Vite
Backend: Node.js + Express.js + TypeScript
Database: Firebase Firestore (NoSQL)
UI Framework: Shadcn/UI + Radix UI + Tailwind CSS
State Management: TanStack Query + React Context
Routing: Wouter
Validation: Zod + React Hook Form
```

### **Integrações Externas**
```
WhatsApp: @whiskeysockets/baileys (conexão direta)
OpenAI: GPT-4o (análise) + Whisper (transcrição) + TTS (text-to-speech)
Firebase: Firestore (database) + Storage (arquivos)
Authentication: JWT + bcrypt
```

### **Estrutura de Diretórios**
```
project/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── hooks/          # Custom hooks (useAuth, etc)
│   │   └── lib/            # Utilitários e configurações
├── server/                 # Backend Node.js
│   ├── storage.ts          # Camada de dados (Firebase)
│   ├── routes.ts           # Rotas da API
│   ├── whatsappBaileyService.ts # Serviço WhatsApp
│   ├── interactiveInterviewService.ts # Lógica de entrevistas
│   ├── aiComparisonService.ts # Análise IA
│   └── prompts.ts          # Templates de prompts
├── shared/                 # Tipos e schemas compartilhados
├── uploads/                # Arquivos de áudio das entrevistas
└── whatsapp-sessions/      # Sessões WhatsApp por cliente
```

---

## ⚙️ FUNCIONALIDADES DETALHADAS

### **1. AUTENTICAÇÃO E AUTORIZAÇÃO**

#### **Sistema de Usuários**
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  password: string; // bcrypt hash
  role: 'master' | 'client';
  clientId?: number; // Para usuários cliente
  isActive: boolean;
  createdAt: Date;
}
```

#### **Controle de Acesso**
- **Master**: Acesso total, gerencia clientes
- **Client**: Acesso apenas aos próprios dados (isolamento por clientId)
- JWT com expiração de 24h
- Middleware de autenticação em todas as rotas protegidas

### **2. GESTÃO DE CLIENTES**

#### **Entidade Cliente**
```typescript
interface Client {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  contractStart: Date;
  contractEnd?: Date;
  additionalLimitExpiry?: Date;
  creditLimit: number;
  currentUsage: number;
  isActive: boolean;
  createdAt: Date;
}
```

#### **Funcionalidades**
- CRUD completo de clientes (apenas Masters)
- Controle de créditos e limites
- Isolamento total de dados por cliente

### **3. SISTEMA DE VAGAS**

#### **Entidade Job**
```typescript
interface Job {
  id: number;
  clientId: number;
  nomeVaga: string;
  descricao: string;
  salario?: string;
  localTrabalho?: string;
  tipoContrato?: string;
  beneficios?: string;
  requisitos?: string;
  perguntas: Array<{
    id: number;
    pergunta: string;
    respostaPadrao: string;
    peso: number;
  }>;
  isActive: boolean;
  createdAt: Date;
}
```

#### **Funcionalidades**
- Cadastro de vagas com até 10 perguntas
- Respostas padrão para comparação IA
- Sistema de peso por pergunta
- Filtro por cliente (isolamento de dados)

### **4. GESTÃO DE CANDIDATOS**

#### **Entidade Candidate**
```typescript
interface Candidate {
  id: number;
  clientId: number;
  name: string;
  email: string;
  whatsapp: string;
  cpf?: string;
  endereco?: string;
  experiencia?: string;
  formacao?: string;
  observacoes?: string;
  createdAt: Date;
}
```

#### **Sistema de Listas**
```typescript
interface CandidateList {
  id: number;
  clientId: number;
  name: string;
  description: string;
  createdAt: Date;
}

interface CandidateListMembership {
  id: number;
  candidateId: number;
  listId: number;
  clientId: number;
  createdAt: Date;
}
```

#### **Funcionalidades**
- CRUD de candidatos por cliente
- Sistema de listas de candidatos (relacionamento N:N)
- Importação em massa via CSV/Excel
- Validação de dados obrigatórios

### **5. SISTEMA DE SELEÇÕES**

#### **Entidade Selection**
```typescript
interface Selection {
  id: number;
  clientId: number;
  name: string;
  jobId: number;
  candidateListId: number;
  deadline: Date;
  scheduledFor?: Date;
  sendVia: 'whatsapp';
  whatsappTemplate: string;
  status: 'draft' | 'active' | 'enviado' | 'finalizado';
  createdAt: Date;
}
```

#### **Funcionalidades**
- Criação de campanhas de seleção
- Template personalizável de convite WhatsApp
- Envio automático ou agendado
- Progress tracking em tempo real

### **6. SISTEMA DE ENTREVISTAS VIA WHATSAPP**

#### **Fluxo Completo**
1. **Convite**: Mensagem personalizada com botões 1/2
2. **Aceitação**: Comando "1" inicia entrevista
3. **Perguntas**: Sequenciais com áudio TTS + texto
4. **Respostas**: Apenas por áudio (texto rejeitado)
5. **Transcrição**: Whisper processa automaticamente
6. **Finalização**: Mensagem de conclusão

#### **Entidade Interview**
```typescript
interface Interview {
  id: string;
  selectionId: number;
  candidateId: string;
  token: string;
  status: 'pending' | 'in_progress' | 'completed' | 'abandoned';
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

interface InterviewResponse {
  id: number;
  interviewId: string;
  questionId: number;
  questionText: string;
  responseText: string;
  audioFile: string;
  score?: number;
  aiAnalysis?: string;
  timestamp: Date;
}
```

#### **Nomenclatura de Áudios**
```
Formato: audio_[telefone]_[selectionId]_R[numero].ogg
Exemplo: audio_5511984316526_1750361142848_R1.ogg
```

### **7. ANÁLISE POR IA**

#### **Serviço de Comparação**
```typescript
interface ComparisonRequest {
  question: string;
  candidateAnswer: string;
  perfectAnswer: string;
}

interface ComparisonResult {
  score: number; // 0-100
  feedback: string;
  similarities: string[];
  differences: string[];
}
```

#### **Prompts Configurados**
- Análise individual de respostas
- Comparação com resposta padrão
- Geração de feedback construtivo
- Pontuação automática (0-100)

### **8. SISTEMA DE RELATÓRIOS INDEPENDENTE**

#### **Entidade Report (Isolada)**
```typescript
interface Report {
  id: string;
  originalSelectionId: number;
  clientId: number;
  selectionName: string;
  jobTitle: string;
  candidatesData: Array<{
    id: string;
    name: string;
    email: string;
    whatsapp: string;
    responses: Array<{
      questionText: string;
      responseText: string;
      audioFile: string;
      score: number;
      aiAnalysis: string;
    }>;
    totalScore: number;
    category: 'Melhor' | 'Mediano' | 'Em dúvida' | 'Não';
    completedAt: Date;
  }>;
  generatedAt: Date;
}
```

#### **Características**
- **Independente**: Dados duplicados para preservação histórica
- **Isolado**: Mantém informações mesmo se entidades originais forem deletadas
- **Categorização**: Sistema de 4 categorias por candidato
- **Player de áudio**: Controles integrados para reprodução

---

## 🔄 FLUXOS DE USUÁRIO

### **Fluxo Master Administrator**
```
1. Login → Dashboard Master
2. Gerenciar Clientes → CRUD completo
3. Configurações Globais → OpenAI API, TTS
4. WhatsApp por Cliente → QR Code individual
5. Relatórios Gerais → Visualização cross-client
```

### **Fluxo Cliente Corporativo**
```
1. Login → Dashboard Cliente
2. Cadastrar Vaga → Perguntas + respostas padrão
3. Gerenciar Candidatos → Listas + importação
4. Criar Seleção → Template WhatsApp personalizado
5. Enviar Convites → Progress tracking
6. Analisar Resultados → Relatórios + categorização
```

### **Fluxo Candidato WhatsApp**
```
1. Recebe Convite → Template personalizado
2. Responde "1" → Aceita entrevista
3. Recebe Boas-vindas → Instruções
4. Responde Perguntas → Apenas por áudio
5. Finaliza → Mensagem de conclusão
```

---

## 🎨 ESPECIFICAÇÕES DE INTERFACE

### **Design System**
```css
/* Cores Principais */
Primary: hsl(221, 83%, 53%)    /* Azul principal */
Secondary: hsl(210, 40%, 98%)  /* Cinza claro */
Success: hsl(142, 76%, 36%)    /* Verde */
Warning: hsl(45, 93%, 47%)     /* Amarelo */
Error: hsl(0, 84%, 60%)        /* Vermelho */

/* Tipografia */
Font Family: Inter, system-ui, sans-serif
Heading: font-weight: 600
Body: font-weight: 400
Small: font-size: 0.875rem
```

### **Componentes Principais**
1. **Sidebar**: Navegação responsiva com ícones
2. **Dashboard Cards**: Métricas e estatísticas
3. **Data Tables**: Listagem com paginação
4. **Modal Forms**: Formulários de criação/edição
5. **Progress Bars**: Tracking de processos
6. **Audio Players**: Controles de reprodução

### **Responsividade**
- **Desktop**: Layout com sidebar fixa
- **Tablet**: Sidebar colapsível
- **Mobile**: Menu hamburger + navegação bottom

---

## 🔗 INTEGRAÇÕES E APIS

### **OpenAI Integration**
```typescript
// TTS (Text-to-Speech)
POST https://api.openai.com/v1/audio/speech
{
  "model": "tts-1",
  "input": "texto da pergunta",
  "voice": "nova", // configurável por cliente
  "response_format": "opus",
  "speed": 1.0
}

// Whisper (Transcrição)
POST https://api.openai.com/v1/audio/transcriptions
FormData:
- file: audio.ogg
- model: whisper-1
- language: pt
- response_format: text

// GPT-4o (Análise)
POST https://api.openai.com/v1/chat/completions
{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "system",
      "content": "Analise a resposta do candidato..."
    }
  ]
}
```

### **WhatsApp Baileys**
```typescript
// Configuração por Cliente
whatsapp-sessions/client_{clientId}/
├── creds.json
├── keys.json
└── session-auth-info.json

// Envio de Mensagem
socket.sendMessage(phoneNumber, {
  text: "mensagem"
});

// Envio de Áudio
socket.sendMessage(phoneNumber, {
  audio: Buffer.from(audioData),
  mimetype: 'audio/mp4',
  ptt: true
});
```

### **Firebase Firestore**
```typescript
// Coleções Principais
users/                  // Usuários do sistema
clients/               // Clientes corporativos
jobs/                  // Vagas
candidates/            // Candidatos
candidateListMemberships/ // Relação candidato-lista
selections/            // Seleções/campanhas
interviews/            // Entrevistas
interviewResponses/    // Respostas das entrevistas
reports/               // Relatórios independentes
apiConfigs/            // Configurações por entidade
masterSettings/        // Configurações globais
messageLogs/           // Logs de comunicação
```

---

## 💾 BANCO DE DADOS

### **Schema Completo Firebase**

#### **Coleção: users**
```json
{
  "id": "1750131049173",
  "name": "Daniel Braga",
  "email": "danielmoreirabraga@gmail.com",
  "password": "$2b$10$hashedPassword",
  "role": "client",
  "clientId": 1749849987543,
  "isActive": true,
  "createdAt": "2025-06-17T10:30:49.173Z"
}
```

#### **Coleção: clients**
```json
{
  "id": 1749849987543,
  "companyName": "Grupo Maximuns",
  "contactName": "Daniel Moreira",
  "email": "contato@maximuns.com",
  "phone": "11984316526",
  "address": "São Paulo, SP",
  "contractStart": "2025-01-01T00:00:00Z",
  "creditLimit": 1000,
  "currentUsage": 150,
  "isActive": true,
  "createdAt": "2025-06-17T08:33:07.543Z"
}
```

#### **Coleção: jobs**
```json
{
  "id": 1750273678956,
  "clientId": 1749849987543,
  "nomeVaga": "Consultor Comercial",
  "descricao": "Vaga para consultor comercial",
  "salario": "R$ 3.000 + comissões",
  "perguntas": [
    {
      "id": 1,
      "pergunta": "Fale sobre sua experiência em vendas",
      "respostaPadrao": "Tenho X anos de experiência...",
      "peso": 3
    }
  ],
  "isActive": true,
  "createdAt": "2025-06-18T15:27:58.956Z"
}
```

#### **Coleção: candidateListMemberships**
```json
{
  "id": 1750296526559,
  "candidateId": 1750296139453,
  "listId": 1750296055819,
  "clientId": 1749849987543,
  "createdAt": "2025-06-19T01:28:46.559Z"
}
```

#### **Coleção: reports** (Independente)
```json
{
  "id": "report_1750361142848_20250619",
  "originalSelectionId": 1750361142848,
  "clientId": 1749849987543,
  "selectionName": "Consultor GM 6",
  "jobTitle": "Consultor Comercial Sênior",
  "candidatesData": [
    {
      "id": "candidate_1750361142848_5511984316526",
      "name": "Daniel Moreira",
      "email": "teste@teste.com",
      "whatsapp": "5511984316526",
      "responses": [
        {
          "questionText": "Fale sobre sua experiência em vendas",
          "responseText": "Estão vendendo, eles não dão resposta correta 100% do tempo...",
          "audioFile": "uploads/audio_5511984316526_1750361142848_R1.ogg",
          "score": 85,
          "aiAnalysis": "Resposta demonstra conhecimento prático..."
        }
      ],
      "totalScore": 87,
      "category": "Melhor",
      "completedAt": "2025-06-19T12:45:30Z"
    }
  ],
  "generatedAt": "2025-06-19T12:50:00Z"
}
```

---

## ⚙️ CONFIGURAÇÕES E VARIÁVEIS

### **Variáveis de Ambiente**
```env
# Database
DATABASE_URL=firebase_connection_string

# JWT
JWT_SECRET=maximus-interview-system-secret-key-2024

# OpenAI
OPENAI_API_KEY=sk-xxx

# Firebase
FIREBASE_PROJECT_ID=projeto-id
FIREBASE_PRIVATE_KEY=chave-privada
FIREBASE_CLIENT_EMAIL=email-servico

# Server
PORT=5000
NODE_ENV=production
```

### **Configurações por Cliente**
```typescript
interface ApiConfig {
  entityType: 'master' | 'client';
  entityId: string;
  openaiVoice: 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer';
  whatsappConnected: boolean;
  whatsappQrCode?: string;
  whatsappLastConnection?: Date;
}
```

### **Configurações Globais**
```typescript
interface MasterSettings {
  openaiApiKey: string;
  openaiModel: 'gpt-4o' | 'gpt-4';
  whisperModel: 'whisper-1';
  defaultVoice: 'nova';
  maxInterviewDuration: 3600; // segundos
  maxAudioSize: 25000000; // bytes
}
```

---

## 🔧 REQUISITOS TÉCNICOS

### **Performance**
- Tempo de resposta API: < 500ms
- Upload de áudio: < 30s
- Transcrição Whisper: < 60s
- Análise GPT-4o: < 30s

### **Escalabilidade**
- Suporte a 100+ clientes simultâneos
- 1000+ entrevistas por dia
- Armazenamento: 10GB+ de áudios
- Sessões WhatsApp: 50+ conexões ativas

### **Segurança**
- Autenticação JWT com renovação
- Isolamento total de dados por cliente
- Validação de entrada (Zod)
- Rate limiting em APIs sensíveis
- Logs de auditoria

### **Disponibilidade**
- Uptime: 99.9%
- Backup automático (Firebase)
- Reconexão automática WhatsApp
- Fallback para erros de IA

---

## 🎯 CASOS DE USO AVANÇADOS

### **Caso 1: Empresa com 50 Candidatos**
```
1. Cliente cadastra vaga com 5 perguntas
2. Importa 50 candidatos via CSV
3. Cria seleção com template personalizado
4. Envia convites via WhatsApp
5. 40 candidatos respondem "1"
6. Sistema processa 200 áudios (40×5)
7. IA analisa e pontua automaticamente
8. Relatório gerado com categorização
9. Cliente acessa resultados em tempo real
```

### **Caso 2: Multi-tenancy Isolado**
```
Cliente A: 
- 20 candidatos para "Vendedor"
- WhatsApp: 11999999999
- Voz: "nova"
- Áudios: audio_11999999999_selecaoA_R1.ogg

Cliente B:
- 15 candidatos para "Analista" 
- WhatsApp: 11888888888
- Voz: "alloy"
- Áudios: audio_11888888888_selecaoB_R1.ogg

Isolamento Total: Nenhum cliente vê dados do outro
```

### **Caso 3: Relatório Histórico Preservado**
```
Cenário: Cliente deleta vaga e candidatos após 6 meses
Resultado: Relatório independente mantém:
- Dados completos dos candidatos
- Transcrições das respostas
- Arquivos de áudio
- Análises da IA
- Pontuações e categorias

Benefício: Histórico preservado para auditoria
```

---

## 📈 MÉTRICAS E ANALYTICS

### **Dashboard Master**
- Total de clientes ativos
- Entrevistas realizadas (mês/ano)
- Usage por cliente
- Status das conexões WhatsApp
- Relatórios gerados

### **Dashboard Cliente**
- Candidatos cadastrados
- Entrevistas pendentes/concluídas
- Score médio por vaga
- Distribuição por categoria
- Histórico de seleções

### **Logs Operacionais**
```typescript
interface MessageLog {
  id: string;
  interviewId: string;
  type: 'invitation' | 'question' | 'response' | 'completion';
  channel: 'whatsapp';
  status: 'sent' | 'delivered' | 'failed';
  content?: string;
  timestamp: Date;
}
```

---

## 🚀 IMPLEMENTAÇÃO RECOMENDADA

### **Fase 1: Core System (4 semanas)**
1. Autenticação e usuários
2. CRUD de clientes, vagas, candidatos
3. Interface básica com Shadcn/UI
4. Banco Firebase + schemas

### **Fase 2: WhatsApp Integration (3 semanas)**
1. Baileys setup + QR Code
2. Fluxo de entrevista básico
3. Sistema de comandos 1/2
4. Armazenamento de áudios

### **Fase 3: IA Integration (2 semanas)**
1. OpenAI Whisper transcrição
2. GPT-4o análise de respostas
3. TTS para perguntas
4. Sistema de pontuação

### **Fase 4: Relatórios (2 semanas)**
1. Sistema independente de reports
2. Categorização de candidatos
3. Player de áudio integrado
4. Exportação de dados

### **Fase 5: Polimento (1 semana)**
1. Otimizações de performance
2. Tratamento de erros
3. Testes de carga
4. Documentação final

---

## 📚 REFERÊNCIAS TÉCNICAS

### **Dependências Principais**
```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^6.x",
    "openai": "^4.x",
    "firebase": "^10.x",
    "react": "^18.x",
    "@tanstack/react-query": "^5.x",
    "wouter": "^3.x",
    "zod": "^3.x",
    "bcrypt": "^5.x",
    "jsonwebtoken": "^9.x",
    "express": "^4.x",
    "typescript": "^5.x"
  }
}
```

### **Estrutura de Resposta API**
```typescript
// Sucesso
{
  "success": true,
  "data": any,
  "message"?: string
}

// Erro
{
  "success": false,
  "error": string,
  "details"?: any
}
```

### **Endpoints Principais**
```
Auth:
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

Clients:
GET    /api/clients
POST   /api/clients
PUT    /api/clients/:id
DELETE /api/clients/:id

Jobs:
GET    /api/jobs
POST   /api/jobs
PUT    /api/jobs/:id

Candidates:
GET    /api/candidates
POST   /api/candidates
POST   /api/candidates/bulk-import

Selections:
GET    /api/selections
POST   /api/selections
POST   /api/selections/:id/send

Reports:
GET    /api/reports
GET    /api/reports/:id

WhatsApp:
GET    /api/client/whatsapp/status
POST   /api/client/whatsapp/connect
POST   /api/client/whatsapp/disconnect
POST   /api/client/whatsapp/test
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### **Backend**
- [ ] Setup Node.js + Express + TypeScript
- [ ] Configuração Firebase Firestore
- [ ] Sistema de autenticação JWT
- [ ] CRUD completo de entidades
- [ ] Integração Baileys WhatsApp
- [ ] Integração OpenAI (Whisper + GPT + TTS)
- [ ] Sistema de uploads de áudio
- [ ] Middleware de autorização
- [ ] Sistema de logs
- [ ] Tratamento de erros

### **Frontend**
- [ ] Setup React + Vite + TypeScript
- [ ] Configuração Shadcn/UI + Tailwind
- [ ] Sistema de autenticação
- [ ] Dashboard responsivo
- [ ] CRUD interfaces
- [ ] Formulários com validação Zod
- [ ] Sistema de upload de arquivos
- [ ] Player de áudio integrado
- [ ] Navegação com Wouter
- [ ] Estado global com TanStack Query

### **Integrações**
- [ ] WhatsApp QR Code generation
- [ ] Fluxo completo de entrevista
- [ ] Transcrição automática
- [ ] Análise por IA
- [ ] Sistema de relatórios
- [ ] Notificações em tempo real
- [ ] Sistema de backup
- [ ] Monitoramento de performance

---

**📄 Documento Técnico Completo - Sistema de Entrevistas por IA**
*Versão 1.0 - Dezembro 2024*
*Preparado para implementação completa em qualquer stack tecnológico*