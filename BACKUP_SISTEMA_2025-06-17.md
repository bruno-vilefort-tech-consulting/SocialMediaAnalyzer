# BACKUP COMPLETO DO SISTEMA - 17 de junho de 2025

## RESUMO EXECUTIVO

Sistema de entrevistas por IA totalmente funcional com integração WhatsApp, gerenciamento multi-cliente e interface web completa. Todas as funcionalidades principais implementadas e testadas.

## ARQUITETURA DO SISTEMA

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **UI**: Shadcn/UI components + Tailwind CSS
- **Estado**: TanStack Query + React Context
- **Roteamento**: Wouter
- **Formulários**: React Hook Form + Zod validation

### Backend
- **Runtime**: Node.js + Express.js + TypeScript
- **Banco de Dados**: Firebase Firestore (migrado do PostgreSQL)
- **Autenticação**: JWT + bcrypt
- **Upload**: Multer para arquivos de áudio
- **Sessões**: express-session

### Integrações Externas
- **OpenAI**: TTS (text-to-speech), Whisper (transcrição), GPT-4o (análise)
- **WhatsApp**: Baileys library para automação
- **Email**: Resend para envio de convites
- **Firebase**: Firestore para dados + Storage para arquivos

## ESTRUTURA DE USUÁRIOS

### 1. Usuários Master
- **Email**: daniel@grupomaximuns.com.br
- **Senha**: daniel580190 (hash bcrypt)
- **Permissões**: Acesso total ao sistema, gerenciam clientes

### 2. Clientes Corporativos
- **Grupo Maximuns**: ID 1749849987543
- **Universidade dos Campeões**: ID 1749852235275
- **Campos**: companyName, cnpj, email, senha hash, limites mensais

### 3. Usuários Cliente (NOVO)
- **Sistema implementado**: Usuários subordinados aos clientes
- **Campos**: name, email, password (hash bcrypt), role=client, clientId
- **Funcionalidade**: Interface completa de CRUD integrada ao painel de clientes

## FUNCIONALIDADES PRINCIPAIS

### 1. Gerenciamento de Clientes
- ✅ CRUD completo de clientes corporativos
- ✅ Usuários subordinados por cliente
- ✅ Controle de limites mensais
- ✅ Validação CNPJ e campos obrigatórios

### 2. Sistema de Vagas
- ✅ Criação de vagas por cliente
- ✅ Perguntas personalizadas por vaga
- ✅ Respostas ideais para comparação IA

### 3. Gerenciamento de Candidatos
- ✅ Listas de candidatos por cliente
- ✅ Upload CSV em massa
- ✅ Sistema many-to-many (candidato em múltiplas listas)
- ✅ Campo WhatsApp obrigatório

### 4. Processo de Seleção
- ✅ Criação de seleções (vaga + lista candidatos)
- ✅ Envio automático WhatsApp e Email
- ✅ Links únicos de entrevista por candidato

### 5. Entrevistas por IA
- ✅ Interface web para candidatos
- ✅ Perguntas por áudio TTS OpenAI
- ✅ Gravação de respostas
- ✅ Transcrição automática Whisper
- ✅ Análise e pontuação GPT-4o
- ✅ Categorização automática (high/medium/low)

### 6. WhatsApp Automation
- ✅ QR Code para conexão
- ✅ Envio automático de convites
- ✅ Sistema de reconexão automática
- ✅ Detecção de conflitos de dispositivo
- ✅ Logs detalhados de mensagens

### 7. Dashboards e Relatórios
- ✅ Dashboard master com estatísticas globais
- ✅ Dashboard cliente com dados filtrados
- ✅ Relatórios de entrevistas com scores
- ✅ Exportação de resultados

## CONFIGURAÇÕES E APIs

### OpenAI (Compartilhado - Masters)
- **Chave API**: Configurada globalmente
- **Modelo**: GPT-4o padrão
- **TTS Voice**: Nova (português brasileiro)

### WhatsApp QR (Por Cliente)
- **Sistema**: Baileys + QR Code
- **Status**: Conexão automática com retry
- **Persistência**: Firebase para credenciais

### Configurações de Voz (Por Cliente)
- **Padrão**: Voz "Nova" feminina brasileira
- **Opções**: Nova, Shimmer, Alloy, Onyx
- **Preview**: Teste de voz integrado

## BANCO DE DADOS FIREBASE

### Coleções Principais
```
users/                  # Usuários master e cliente
├── master users (role: master)
└── client users (role: client, clientId)

clients/               # Clientes corporativos
├── companyName, cnpj, email
├── monthlyLimit, contractDates
└── responsibleData

jobs/                  # Vagas
├── nomeVaga, descricaoVaga
├── clientId (filtro)
└── perguntas (subcoleção)

candidates/            # Candidatos
├── name, email, whatsapp
└── clientId (obrigatório)

candidateListMemberships/  # Relacionamento many-to-many
├── candidateId, listId
└── clientId

selections/            # Processos seletivos
├── jobId, candidateListId
└── status, dates

interviews/            # Entrevistas individuais
├── token único
├── selectionId, candidateId
└── status, scores

responses/             # Respostas por pergunta
├── interviewId, questionId
├── audioUrl, transcription
└── score, aiAnalysis

apiConfigs/            # Configurações por entidade
├── master_ID (OpenAI global)
└── client_ID (TTS, WhatsApp)

masterSettings/        # Configurações globais
└── openaiApiKey, model
```

## PROBLEMAS RESOLVIDOS RECENTEMENTE

### 1. Criação de Usuários Cliente (CRÍTICO)
- **Problema**: Erro 500 ao criar usuário - método createClientUser não existia
- **Solução**: Implementado método completo no storage.ts
- **Resultado**: Sistema funcional com hash bcrypt das senhas

### 2. Formatação de Datas Firebase
- **Problema**: "Invalid time value" ao exibir datas
- **Solução**: Tratamento correto de timestamps Firebase {seconds}
- **Resultado**: Datas exibidas corretamente em todas interfaces

### 3. Criptografia de Senhas
- **Problema**: Senhas salvas em texto plano
- **Solução**: Hash bcrypt antes de salvar no Firebase
- **Resultado**: Mesmo padrão de segurança para todos usuários

## ESTRUTURA DE ARQUIVOS PRINCIPAL

```
/
├── client/src/
│   ├── components/
│   │   ├── ClientUserManager.tsx    # CRUD usuários cliente
│   │   ├── Layout.tsx               # Layout principal
│   │   └── Sidebar.tsx             # Navegação
│   ├── pages/
│   │   ├── ClientsPage.tsx         # Gerenciamento clientes
│   │   ├── CandidatesPage.tsx      # Gerenciamento candidatos
│   │   ├── CadastroVagasPage.tsx   # Criação vagas
│   │   └── SelectionsPage.tsx      # Processos seletivos
│   └── lib/
│       └── queryClient.ts          # TanStack Query config
├── server/
│   ├── routes.ts                   # Todas APIs REST
│   ├── storage.ts                  # Interface Firebase
│   ├── WhatsAppQRService.ts        # Automação WhatsApp
│   └── initializeFirebaseData.ts   # Dados iniciais
├── shared/
│   └── schema.ts                   # Tipos TypeScript
└── whatsapp-auth/                  # Credenciais WhatsApp
```

## VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```
DATABASE_URL=postgresql://...       # Não usado (Firebase ativo)
OPENAI_API_KEY=sk-...              # Configurado via interface
RESEND_API_KEY=re_...              # Para envio emails
FIREBASE_CONFIG={"..."}            # Configuração Firebase
NODE_ENV=production
PORT=5000
```

## DEPENDÊNCIAS CRÍTICAS

### Backend
- @whiskeysockets/baileys (WhatsApp)
- firebase/firestore (Banco)
- bcrypt (Criptografia)
- jsonwebtoken (Auth)
- openai (IA)
- multer (Upload)
- express (Server)

### Frontend
- @tanstack/react-query (Estado)
- @radix-ui/* (Componentes)
- react-hook-form (Formulários)
- zod (Validação)
- date-fns (Datas)
- wouter (Roteamento)

## COMANDOS DE DEPLOY

```bash
# Desenvolvimento
npm run dev

# Build produção
npm run build

# Migração banco (se necessário)
npm run db:push

# Inicialização dados
node server/initializeFirebaseData.ts
```

## STATUS ATUAL - 17/06/2025

### ✅ FUNCIONAL COMPLETO
- Sistema de autenticação multi-role
- CRUD completo todos módulos
- WhatsApp automation operacional
- Entrevistas por IA funcionando
- Upload CSV candidatos
- Envio emails automático
- Dashboards e relatórios
- **Sistema usuários cliente integrado**

### ⚠️ ATENÇÃO
- WhatsApp QR pode desconectar (reconexão automática)
- Chave OpenAI deve estar configurada
- Firebase rules devem permitir operações

### 🔧 PRÓXIMAS MELHORIAS SUGERIDAS
- Relatórios avançados PDF
- Notificações push
- Integração calendário
- API webhooks
- Backup automático

## DADOS DE TESTE DISPONÍVEIS

### Usuário Master
- Email: daniel@grupomaximuns.com.br
- Senha: daniel580190

### Candidatos Teste
- Daniel Silva: 5511984316526
- Jacqueline de Souza: 5511994640330

### Vagas Exemplo
- "Assistente Administrativo" (Grupo Maximuns)
- "Professor de Matemática" (Universidade)

---

**BACKUP CRIADO**: 17 de junho de 2025, 14:46 UTC-3
**VERSÃO SISTEMA**: Produção estável
**AUTOR**: Sistema AI Assistant
**PRÓXIMA REVISÃO**: Conforme necessidade

---

## INSTRUÇÕES DE RESTAURAÇÃO

1. **Clonar repositório** em novo ambiente
2. **Instalar dependências**: `npm install`
3. **Configurar Firebase** com credenciais
4. **Definir variáveis ambiente** conforme lista
5. **Executar inicialização**: dados mestres
6. **Testar login master** primeiro
7. **Verificar WhatsApp QR** funcionamento
8. **Validar upload candidatos** CSV
9. **Confirmar entrevistas** end-to-end

Sistema totalmente funcional e pronto para produção.