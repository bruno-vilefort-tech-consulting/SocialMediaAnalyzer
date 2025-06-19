# 📁 ESTRUTURA COMPLETA DO PROJETO - SISTEMA DE ENTREVISTAS IA

## 🏗️ VISÃO GERAL DA ARQUITETURA

```
Sistema de Entrevistas IA/
├── 🎨 Frontend (React + TypeScript)
├── 🖥️ Backend (Express + TypeScript)
├── 🔥 Banco de Dados (Firebase Firestore)
├── 🤖 Integração IA (OpenAI)
└── 📱 WhatsApp (Baileys)
```

## 📂 ESTRUTURA DE DIRETÓRIOS

```
sistema-entrevistas-ia/
│
├── 📁 client/                          # Frontend React Application
│   ├── 📁 src/
│   │   ├── 📁 components/             # Componentes reutilizáveis
│   │   │   ├── 📁 ui/                 # Componentes UI (Shadcn)
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── form.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   └── toast.tsx
│   │   │   ├── Header.tsx             # Cabeçalho da aplicação
│   │   │   ├── Layout.tsx             # Layout principal
│   │   │   └── Sidebar.tsx            # Menu lateral
│   │   │
│   │   ├── 📁 pages/                  # Páginas da aplicação
│   │   │   ├── LoginPage.tsx          # Tela de login
│   │   │   ├── DashboardPage.tsx      # Dashboard unificado
│   │   │   ├── MasterDashboard.tsx    # Dashboard masters
│   │   │   ├── ClientDashboard.tsx    # Dashboard clientes
│   │   │   ├── ClientsPage.tsx        # Gestão de clientes
│   │   │   ├── CadastroVagasPage.tsx  # Cadastro de vagas
│   │   │   ├── CandidatesPage.tsx     # Gestão candidatos
│   │   │   ├── SelectionsPage.tsx     # Campanhas entrevista
│   │   │   ├── NewReportsPage.tsx     # Relatórios principais
│   │   │   ├── ReportsHistoryPage.tsx # Histórico relatórios
│   │   │   ├── InterviewPage.tsx      # Interface entrevista
│   │   │   ├── ApiConfigPage.tsx      # Configurações API
│   │   │   └── UnauthorizedPage.tsx   # Página não autorizado
│   │   │
│   │   ├── 📁 hooks/                  # Custom React Hooks
│   │   │   ├── useAuth.tsx            # Hook autenticação
│   │   │   ├── useAudio.ts            # Hook gravação áudio
│   │   │   └── use-toast.ts           # Hook notificações
│   │   │
│   │   ├── 📁 lib/                    # Utilitários frontend
│   │   │   ├── queryClient.ts         # TanStack Query config
│   │   │   └── utils.ts               # Funções utilitárias
│   │   │
│   │   ├── App.tsx                    # Componente raiz
│   │   ├── main.tsx                   # Ponto de entrada
│   │   └── index.css                  # Estilos globais
│   │
│   ├── 📁 public/                     # Assets estáticos
│   ├── index.html                     # Template HTML
│   └── package.json                   # Dependências frontend
│
├── 📁 server/                          # Backend Express Application
│   ├── index.ts                       # Servidor principal
│   ├── routes.ts                      # Definição de rotas
│   ├── storage.ts                     # Interface banco dados
│   ├── interactiveInterviewService.ts # Serviço entrevistas
│   ├── simpleInterviewService.ts      # Serviço simplificado
│   ├── whatsappBaileyService.ts       # Integração WhatsApp
│   └── vite.ts                        # Configuração Vite
│
├── 📁 shared/                          # Código compartilhado
│   └── schema.ts                      # Schemas Drizzle/Zod
│
├── 📁 uploads/                         # Arquivos de áudio
│   ├── audio_5511984316526_1750361142848_R1.ogg
│   ├── audio_5511984316526_1750361142848_R2.ogg
│   └── temp/                          # Arquivos temporários
│
├── 📁 whatsapp-sessions/              # Sessões WhatsApp
│   ├── client_1749849987543/
│   │   ├── creds.json
│   │   └── keys.json
│   └── logs/
│
├── 📁 tokens/                         # Tokens temporários
│
├── 📁 attached_assets/                # Assets anexados
│
├── 📄 Arquivos de Configuração
│   ├── package.json                  # Dependências principais
│   ├── tsconfig.json                 # Config TypeScript
│   ├── vite.config.ts                # Config Vite
│   ├── tailwind.config.ts            # Config Tailwind
│   ├── postcss.config.js             # Config PostCSS
│   ├── drizzle.config.ts             # Config Drizzle ORM
│   ├── components.json               # Config Shadcn/UI
│   └── .gitignore                    # Arquivos ignorados
│
└── 📄 Documentação
    ├── replit.md                     # Histórico do projeto
    ├── DOCUMENTACAO_BANCO_DADOS.md   # Docs banco dados
    ├── INSTRUCOES_INSTALACAO.md      # Guia instalação
    └── ESTRUTURA_PROJETO.md          # Este arquivo
```

## 🔧 TECNOLOGIAS UTILIZADAS

### Frontend
- **React 18**: Framework principal
- **TypeScript**: Tipagem estática
- **Vite**: Build tool e dev server
- **TanStack Query**: Estado servidor
- **Wouter**: Roteamento
- **Shadcn/UI**: Componentes UI
- **Tailwind CSS**: Estilização
- **Radix UI**: Primitivos acessíveis

### Backend
- **Node.js 20**: Runtime
- **Express.js**: Framework web
- **TypeScript**: Tipagem estática
- **Firebase Admin**: Banco dados
- **JWT**: Autenticação
- **bcrypt**: Hash senhas
- **Multer**: Upload arquivos

### Banco de Dados
- **Firebase Firestore**: NoSQL database
- **Drizzle ORM**: Type-safe ORM
- **Zod**: Validação schemas

### Integrações Externas
- **OpenAI API**: Transcrição/análise
- **WhatsApp Baileys**: Mensageria
- **Firebase Storage**: Arquivos

## 🎯 PRINCIPAIS FUNCIONALIDADES

### 👨‍💼 Para Masters
- Gestão completa de clientes
- Configurações globais do sistema
- Visualização de todas as entrevistas
- Relatórios consolidados
- Configuração de APIs

### 🏢 Para Clientes
- Cadastro de vagas e perguntas
- Gestão de listas de candidatos
- Criação de campanhas de entrevista
- Acompanhamento em tempo real
- Relatórios específicos

### 👤 Para Candidatos
- Interface de entrevista amigável
- Gravação de áudio intuitiva
- Feedback imediato
- Acesso via link único

## 🔄 FLUXO DE DADOS

```
1. Cliente cria Vaga → Questions
2. Cliente cria Lista → Candidates
3. Cliente cria Selection (Vaga + Lista)
4. Sistema envia convites via WhatsApp
5. Candidatos acessam via token único
6. Respostas gravadas → Whisper API
7. Transcrições → GPT Analysis
8. Relatórios gerados automaticamente
```

## 🛡️ SEGURANÇA

### Autenticação
- JWT tokens com expiração
- Bcrypt para hash de senhas
- Middleware de autenticação
- Autorização baseada em roles

### Isolamento de Dados
- Filtros por clientId
- Validação de ownership
- Sessões isoladas por cliente
- Dados históricos independentes

## 📊 SISTEMA DE RELATÓRIOS

### Relatórios Ativos (NewReportsPage)
- Dados em tempo real
- Filtros avançados
- Análise de performance
- Categorização de candidatos

### Histórico Independente (ReportsHistoryPage)
- Snapshots preservados
- Dados isolados das entidades originais
- Nomenclatura única de áudios
- Resistente a exclusões

## 🎵 NOMENCLATURA DE ÁUDIOS

```
Formato: audio_[whatsapp]_[selectionId]_R[numero].ogg

Exemplos:
- audio_5511984316526_1750361142848_R1.ogg
- audio_5511984316526_1750361142848_R2.ogg

Localização: /uploads/
```

## 🔗 ROTAS PRINCIPAIS

### Frontend
```
/login                  # Autenticação
/dashboard             # Dashboard unificado
/clients               # Gestão clientes (masters)
/vagas                 # Cadastro vagas
/candidates            # Lista candidatos
/selecoes              # Campanhas entrevista
/relatorios            # Relatórios ativos
/historico-relatorios  # Histórico relatórios
/configuracoes         # Configurações API
/interview/:token      # Interface entrevista
```

### Backend API
```
POST /api/auth/login          # Login
GET  /api/client/stats        # Estatísticas cliente
GET  /api/selections          # Seleções por cliente
POST /api/selections          # Criar seleção
GET  /api/reports             # Relatórios históricos
POST /api/reports/generate    # Gerar relatório
GET  /api/whatsapp/status     # Status WhatsApp
POST /api/whatsapp/send-test  # Teste mensagem
```

## 🔧 COMANDOS DE DESENVOLVIMENTO

```bash
# Desenvolvimento
npm run dev              # Frontend + Backend
npm run client          # Apenas frontend
npm run server          # Apenas backend

# Build
npm run build           # Build produção
npm run preview         # Preview build

# Manutenção
npm run lint            # ESLint
npm run type-check      # TypeScript check
npm run clean           # Limpar cache
```

## 📈 MÉTRICAS E MONITORAMENTO

### Logs Importantes
- Conexões WhatsApp
- Transcrições Whisper
- Erros de autenticação
- Performance do banco
- Upload de arquivos

### KPIs do Sistema
- Entrevistas completadas/mês
- Taxa de conversão candidatos
- Tempo médio de entrevista
- Uso de créditos OpenAI
- Uptime do sistema

## 🔄 MANUTENÇÃO E BACKUP

### Backup Automático
- Exportação diária Firebase
- Backup arquivos de áudio
- Snapshot configurações
- Logs de sistema

### Limpeza Periódica
- Arquivos temporários
- Sessões WhatsApp expiradas
- Logs antigos (>30 dias)
- Tokens utilizados

## 🚀 DEPLOY E PRODUÇÃO

### Preparação
1. Build otimizado (`npm run build`)
2. Configuração variáveis ambiente
3. Certificados SSL/TLS
4. Configuração firewall
5. Monitoramento ativo

### Considerações
- Usar PM2 ou similar para gerenciamento
- Implementar load balancer se necessário
- Configurar backup automático
- Monitorar logs em tempo real
- Implementar alertas de sistema