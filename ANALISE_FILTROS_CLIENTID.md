# Análise de Filtros por ClientId no Sistema

## Resumo Executivo

**CRÍTICO**: Vários endpoints importantes não estão implementando corretamente o filtro por clientId, permitindo vazamento de dados entre clientes.

## Status por Menu/Endpoint

### ✅ CORRETO - Jobs/Vagas (GET /api/jobs)
- **Master**: Vê todas as vagas de todos os clientes
- **Cliente**: Filtrado corretamente por `req.user.clientId`
- **Código**: Linhas 400-417 em routes.ts

### ❌ PROBLEMA - Candidatos (GET /api/candidates)  
- **Master**: Funciona, mas retorna array vazio se não especificar clientId no query
- **Cliente**: Filtrado corretamente por `req.user.clientId`
- **Problema**: Master deveria ver todos ou ter filtro padrão mais intuitivo

### ✅ CORRETO - Seleções (GET /api/selections)
- **Master**: Vê todas as seleções de todos os clientes
- **Cliente**: Filtrado corretamente por `req.user.clientId`
- **Código**: Linhas 1000-1024 em routes.ts

### ❌ CRÍTICO - Listas de Candidatos (GET /api/candidate-lists)
- **TODOS**: Não filtra por clientId - VAZAMENTO DE DADOS
- **Problema**: Usuários cliente veem listas de outros clientes
- **Local**: Linha ~650-680 em routes.ts

### ❌ CRÍTICO - Memberships (GET /api/candidate-list-memberships)
- **TODOS**: Não filtra por clientId - VAZAMENTO DE DADOS  
- **Problema**: Retorna relacionamentos de todos os clientes
- **Local**: Linhas 749-758 em routes.ts

### ✅ CORRETO - Clientes (GET /api/clients)
- **Master**: Acesso total (correto)
- **Cliente**: Sem acesso (authorize(['master']) - correto)
- **Código**: Linhas 230-237 em routes.ts

### ✅ CORRETO - Configurações API (GET /api/config)
- **Master**: Acesso total (correto)
- **Cliente**: Sem acesso (authorize(['master']) - correto)
- **Código**: Linhas 1936-1954 em routes.ts

### ⚠️ REVISAR - Relatórios/Resultados (GET /api/selections/:id/results)
- **Autenticação**: Cliente + Master permitidos
- **Problema**: Não verifica se a seleção pertence ao cliente
- **Local**: Linhas 1985-2000 em routes.ts

## Problemas Críticos Identificados

1. **candidate-lists**: Usuários cliente veem listas de outros clientes
2. **candidate-list-memberships**: Exposição de relacionamentos entre clientes
3. **selections results**: Cliente pode acessar resultados de outros clientes especificando ID

## Impacto de Segurança

- **Alto**: Vazamento de dados entre clientes corporativos
- **Violação LGPD**: Exposição de dados pessoais de candidatos
- **Compliance**: Falta de isolamento entre clientes

## Correções Necessárias

1. Adicionar filtro clientId em candidate-lists
2. Adicionar filtro clientId em candidate-list-memberships  
3. Validar ownership em selections results
4. Melhorar filtro padrão em candidates para master

Data da análise: 2025-06-17