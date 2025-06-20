# BACKUP COMPLETO - SISTEMA DE RELATÓRIOS
**Data:** 20 de Junho de 2025  
**Versão:** Sistema Maximus IA  
**Componente:** Painel de Relatórios Completo  

## 📋 ÍNDICE
1. [Visão Geral do Sistema](#visao-geral)
2. [Arquitetura do Frontend](#frontend)
3. [Estrutura do Backend](#backend)
4. [Banco de Dados Firebase](#banco-dados)
5. [Rotas e Navegação](#rotas)
6. [Endpoints da API](#endpoints)
7. [Componentes UI](#componentes)
8. [Funcionalidades](#funcionalidades)
9. [Instruções de Restauração](#restauracao)

---

## 🔍 VISÃO GERAL DO SISTEMA {#visao-geral}

O sistema de relatórios é composto por:

### **Páginas Principais:**
- **ReportsHistoryPage.tsx** - Painel principal de relatórios
- **NewReportsPage.tsx** - Interface alternativa de relatórios

### **Rotas:**
- `/historico-relatorios` - Rota principal do sistema
- Botão "Relatórios" na Sidebar (FileText icon)

### **Funcionalidades Core:**
1. **Visualização de Seleções** - Lista todos os processos seletivos
2. **Análise de Candidatos** - Interface horizontal com cards de candidatos
3. **Sistema de Categorização** - 4 categorias com persistência no Firebase
4. **Player de Áudio** - Reprodução de respostas dos candidatos
5. **Filtros e Busca** - Por nome, email, telefone
6. **Controle de Acesso** - Masters veem todos, clientes apenas seus dados

---

## 🎨 ARQUITETURA DO FRONTEND {#frontend}

### **Estrutura de Componentes:**
```
client/src/pages/
├── ReportsHistoryPage.tsx     # Painel principal
├── NewReportsPage.tsx         # Interface alternativa
└── components/
    └── Sidebar.tsx            # Navegação (linha 36 e 47)
```

### **Hooks e Estado:**
- `useAuth()` - Controle de acesso por role
- `useQuery()` - Busca de dados dos relatórios
- `useMutation()` - Atualizações de categoria
- `useState()` - Estado local (abas, filtros, busca)

### **Bibliotecas UI:**
- Shadcn/UI components
- Lucide Icons (FileText para botão Relatórios)
- TanStack Query para gerenciamento de estado
- Tailwind CSS para estilização

---

## ⚙️ ESTRUTURA DO BACKEND {#backend}

### **Endpoints Principais:**
```
server/routes.ts:
├── GET /api/reports                          # Lista relatórios
├── GET /api/reports/:reportId/candidates     # Candidatos do relatório
├── GET /api/reports/candidate-categories/:selectionId  # Categorias
├── POST /api/reports/candidate-categories    # Salvar categoria
└── GET /api/reports/:reportId/responses/:candidateId   # Respostas detalhadas
```

### **Serviços Relacionados:**
- **storage.ts** - Métodos de acesso ao Firebase
- **aiComparisonService.ts** - Análise de respostas com OpenAI

---

## 🗄️ BANCO DE DADOS FIREBASE {#banco-dados}

### **Coleções Principais:**

#### **1. `reports` Collection**
```javascript
Document ID: "report_{selectionId}_{timestamp}"
{
  id: string,
  selectionId: string,
  selectionName: string,
  jobName: string,
  clientId: number,
  clientName: string,
  candidateListName: string,
  totalCandidates: number,
  completedInterviews: number,
  generatedAt: Timestamp,
  createdAt: Timestamp
}
```

#### **2. `reportCandidates` Collection**
```javascript
Document ID: "report_{reportId}_{candidateId}"
{
  id: string,
  reportId: string,
  originalCandidateId: string,
  name: string,
  email: string,
  whatsapp: string,
  totalScore: number,
  status: "completed" | "pending",
  completedAt: Timestamp,
  createdAt: Timestamp
}
```

#### **3. `candidateCategories` Collection**
```javascript
Document ID: "candidate_{candidateId}_selection_{selectionId}"
{
  id: string,
  candidateId: number,
  selectionId: string,
  reportId: string,
  clientId: number,
  category: "melhor" | "mediano" | "em_duvida" | "nao_contratar",
  createdAt: string,
  updatedAt: string
}
```

#### **4. `reportResponses` Collection**
```javascript
Document ID: "{reportId}_{reportCandidateId}_{questionNumber}"
{
  id: string,
  reportId: string,
  reportCandidateId: string,
  questionNumber: number,
  questionText: string,
  transcription: string,
  audioFile: string,
  score: number,
  aiAnalysis: string,
  recordingDuration: number,
  createdAt: Timestamp
}
```

### **Relacionamentos:**
- `reports` 1:N `reportCandidates`
- `reportCandidates` 1:N `reportResponses`
- `candidateCategories` relaciona candidatos com seleções
- Filtro por `clientId` garante isolamento entre clientes

---

## 🛣️ ROTAS E NAVEGAÇÃO {#rotas}

### **Configuração em App.tsx:**
```typescript
<Route path="/historico-relatorios">
  <PrivateRoute allowedRoles={['master', 'client']}>
    <Layout>
      <ReportsHistoryPage />
    </Layout>
  </PrivateRoute>
</Route>
```

### **Configuração na Sidebar.tsx:**
```typescript
// Linha 36 (Master) e 47 (Client)
{ path: "/historico-relatorios", label: "Relatórios", icon: FileText }
```

---

## 🔌 ENDPOINTS DA API {#endpoints}

### **GET /api/reports**
- **Função:** Lista todos os relatórios
- **Filtro:** Por clientId (clientes veem apenas seus dados)
- **Resposta:** Array de relatórios com estatísticas

### **GET /api/reports/:reportId/candidates**
- **Função:** Lista candidatos de um relatório específico
- **Includes:** Dados básicos + totalScore + status
- **Cache:** Implementado com TanStack Query

### **GET /api/reports/candidate-categories/:selectionId**
- **Função:** Busca categorias salvas para uma seleção
- **Filtro:** Por selectionId e clientId
- **Resposta:** Array de categorias com timestamps

### **POST /api/reports/candidate-categories**
- **Função:** Salva/atualiza categoria de candidato
- **Payload:** `{ candidateId, selectionId, reportId, clientId, category }`
- **Upsert:** Atualiza se existe, cria se não existe

### **GET /api/reports/:reportId/responses/:candidateId**
- **Função:** Busca respostas detalhadas de um candidato
- **Includes:** Perguntas, transcrições, áudio, análise IA
- **Ordenação:** Por questionNumber

---

## 🧩 COMPONENTES UI {#componentes}

### **Interface de 3 Abas:**
1. **"Candidatos"** - Grid horizontal de cards
2. **"Análise"** - Análise por pontuação
3. **"Selecionados"** - Filtro por categoria

### **Cards de Candidatos:**
- Layout horizontal compacto
- Nome, email, WhatsApp
- Pontuação alinhada à direita
- 4 botões de categoria com cores distintas
- Player de áudio integrado

### **Sistema de Categorização:**
```typescript
const categories = [
  { key: "melhor", label: "Melhor", color: "green" },
  { key: "mediano", label: "Mediano", color: "orange" },
  { key: "em_duvida", label: "Em Dúvida", color: "gray" },
  { key: "nao_contratar", label: "Não", color: "red" }
];
```

### **Controles de Busca:**
- Campo de busca por nome/email/telefone
- Paginação (12 itens por página)
- Contador de resultados

---

## ⚡ FUNCIONALIDADES {#funcionalidades}

### **1. Controle de Acesso**
- **Masters:** Dropdown para selecionar cliente
- **Clientes:** Dados filtrados automaticamente por clientId
- **Middleware:** Verificação de autorização em todos os endpoints

### **2. Sistema de Categorização**
- **Persistência:** Firebase collection `candidateCategories`
- **Estado Visual:** Botões mantêm cor ao retornar para painel
- **Upsert Logic:** Atualiza categoria existente ou cria nova

### **3. Player de Áudio**
- **Controles:** Play/Pause/Stop
- **Estado:** Sincronizado entre componentes
- **Arquivos:** Formato .ogg armazenados em `uploads/`

### **4. Análise IA**
- **Serviço:** aiComparisonService.ts
- **OpenAI:** Comparação resposta vs resposta perfeita
- **Score:** 0-100% com feedback detalhado

### **5. Interface Responsiva**
- **Desktop:** Grid horizontal otimizado
- **Mobile:** Layout adaptável
- **Performance:** Paginação e cache inteligente

---

## 🔧 INSTRUÇÕES DE RESTAURAÇÃO {#restauracao}

### **1. Arquivos Frontend:**
```bash
# Copiar páginas principais
client/src/pages/ReportsHistoryPage.tsx
client/src/pages/NewReportsPage.tsx

# Verificar rota na Sidebar
client/src/components/Sidebar.tsx (linhas 36 e 47)

# Verificar rota no App
client/src/App.tsx (linha ~119)
```

### **2. Arquivos Backend:**
```bash
# Endpoints de relatórios
server/routes.ts (buscar por "/api/reports")

# Métodos de storage
server/storage.ts (métodos relacionados a reports)

# Serviço de análise IA
server/aiComparisonService.ts
```

### **3. Configuração Firebase:**
Verificar se as coleções existem:
- `reports`
- `reportCandidates` 
- `candidateCategories`
- `reportResponses`

### **4. Dependências:**
```json
{
  "@tanstack/react-query": "^5.x",
  "lucide-react": "^0.x",
  "@radix-ui/*": "^1.x"
}
```

### **5. Teste de Funcionamento:**
1. Login como cliente ou master
2. Navegar para `/historico-relatorios`
3. Verificar se lista de seleções carrega
4. Clicar em "Ver Candidatos"
5. Testar botões de categorização
6. Verificar player de áudio
7. Confirmar persistência no Firebase

### **6. Debug Common Issues:**
- **Dados não carregam:** Verificar filtro por clientId
- **Categorias não salvam:** Verificar endpoint POST
- **Áudio não toca:** Verificar paths dos arquivos
- **Permissões:** Verificar role-based access

---

## 📊 ESTATÍSTICAS DO SISTEMA

- **Frontend:** 2 páginas principais + componentes
- **Backend:** 5 endpoints específicos de relatórios
- **Firebase:** 4 coleções principais
- **Funcionalidades:** 5 módulos core
- **Controle de Acesso:** 2 níveis (master/client)
- **Interface:** 3 abas + busca + paginação

---

**🔄 ÚLTIMA ATUALIZAÇÃO:** 20/06/2025 05:10 AM  
**✅ STATUS:** Sistema completamente funcional  
**🛡️ SEGURANÇA:** Isolamento por clientId implementado  
**🎯 READY FOR RESTORE:** Backup completo documentado  