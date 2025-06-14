# AI Interview System

## Overview

This is a full-stack AI-powered interview system built with React, Express.js, PostgreSQL, and Drizzle ORM. The application enables corporate clients to conduct automated video interviews with candidates using AI for transcription and analysis. The system supports three user roles: master administrators, corporate clients, and candidates.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: Shadcn/UI components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **State Management**: TanStack Query for server state, React Context for authentication
- **Routing**: Wouter for lightweight client-side routing

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **File Handling**: Multer for audio file uploads
- **Session Management**: express-session with PostgreSQL session store

### Database Schema
The system uses a comprehensive PostgreSQL schema with the following main entities:
- **Users**: Authentication for all system users
- **Clients**: Corporate client management with credit limits
- **Jobs**: Job positions with descriptions
- **Questions**: Interview questions per job with ideal answers
- **Candidates**: Candidate information and contact details
- **Selections**: Interview campaigns linking jobs and candidates
- **Interviews**: Individual interview sessions with tokens
- **Responses**: Audio responses with transcriptions and AI scores
- **API Configs**: System-wide configuration management
- **Message Logs**: Communication tracking

## Key Components

### Audio Recording System
- Browser-based audio recording using MediaRecorder API
- Real-time duration tracking and visual feedback
- WebM audio format with configurable quality settings
- Audio playback controls for review

### AI Integration Framework
- OpenAI integration for text-to-speech generation
- Whisper API for audio transcription
- GPT-4o for response analysis and scoring
- Configurable AI parameters and prompts

### Multi-Role Dashboard System
- **Master Dashboard**: System-wide analytics and client management
- **Client Dashboard**: Job and candidate management interface
- **Interview Interface**: Candidate-facing interview experience

### File Upload System
- CSV bulk import for candidate data
- Audio file handling for interview responses
- Secure file storage with validation

## Data Flow

1. **Master Admin** creates and manages corporate clients
2. **Corporate Clients** create job positions with custom interview questions
3. **Clients** upload candidate lists and create selection campaigns
4. **System** sends WhatsApp/email invitations to candidates
5. **Candidates** access interviews via unique tokens
6. **AI System** processes audio responses and generates scores
7. **Clients** review results and analytics

## External Dependencies

### Core Dependencies
- **Database**: @neondatabase/serverless for PostgreSQL connectivity
- **ORM**: drizzle-orm with drizzle-kit for migrations
- **UI Components**: @radix-ui/* for accessible component primitives
- **Validation**: zod for schema validation with drizzle-zod integration
- **Authentication**: bcrypt for password hashing, jsonwebtoken for JWTs

### AI Services
- **OpenAI**: For TTS, transcription, and response analysis
- **Firebase**: For file storage and additional services
- **WhatsApp Business API**: For candidate communication

### Development Tools
- **TypeScript**: Full type safety across frontend and backend
- **Vite**: Fast development server with HMR
- **Tailwind CSS**: Utility-first styling framework
- **ESLint/Prettier**: Code quality and formatting

## Deployment Strategy

### Development Environment
- **Platform**: Replit with Node.js 20 runtime
- **Database**: PostgreSQL 16 module
- **Port Configuration**: Application runs on port 5000
- **Development Server**: `npm run dev` with auto-reload

### Production Build
- **Frontend**: Vite builds optimized static assets
- **Backend**: esbuild bundles server code for production
- **Database**: Drizzle migrations for schema deployment
- **Deployment**: Replit autoscale deployment target

### Environment Configuration
- Database connection via `DATABASE_URL` environment variable
- JWT secret configuration for authentication
- OpenAI API key for AI features
- WhatsApp API credentials for messaging

## User Preferences

Preferred communication style: Simple, everyday language in Brazilian Portuguese (português brasileiro).

## Recent Changes

- June 14, 2025: Interface de entrevista natural completamente otimizada - ChatGPT Voice Mode
  - **Interface totalmente limpa**: Removido texto das mensagens na tela para experiência idêntica ao ChatGPT
  - **Saudação personalizada**: Sistema usa nome do candidato do banco de dados na boas-vindas
  - **Fluxo automático**: Conversa continua automaticamente após 2 segundos de silêncio do candidato
  - **Timing otimizado**: Sistema detecta quando candidato para de falar e prossegue naturalmente
  - **Controle de conflitos**: Evita interrupção da IA quando candidato fala durante reprodução
  - **Prompt personalizado**: "Olá [Nome]! Muito prazer, eu sou a Ana, entrevistadora do Grupo Maximus"
  - **Sistema robusto**: Tratamento de erros e timeouts para experiência fluida
  - **Interface minimalista**: Apenas indicadores visuais (microfone, alto-falante, ondas sonoras)

- June 14, 2025: Sistema de entrevista natural em tempo real implementado
  - **Nova página NaturalInterviewPage**: Interface completa para entrevista conversacional com IA
  - **Animações visuais avançadas**: Ondas sonoras dinâmicas quando IA fala, indicadores visuais quando candidato é ouvido
  - **Reconhecimento de voz em tempo real**: Integração com Web Speech API para captura contínua
  - **Conversa natural com GPT**: Sistema de prompts organizados para conduzir entrevista humana
  - **Endpoints dedicados**: /api/natural-tts, /api/natural-conversation, /api/interview/complete
  - **Arquivo de prompts estruturado**: server/prompts.ts com categorias para diferentes situações
  - **Visualizador de amplitude**: Barras animadas que reagem à voz do candidato em tempo real
  - **Fluxo natural**: Boas-vindas → perguntas conversacionais → confirmações → finalização calorosa
  - **Rota /natural-interview/:token**: Acesso direto à nova interface de entrevista natural

- June 14, 2025: Sistema de configurações da API completamente reformulado com interfaces específicas por usuário
  - **Interface diferenciada por usuário**: Master vê configurações completas, Cliente apenas configuração de voz
  - **Voz padrão Nova definida**: Feminina natural e clara como padrão para português brasileiro
  - **Botão salvar chave API**: Master pode salvar chave OpenAI com botão dedicado ao lado do campo
  - **Vozes otimizadas para brasileiro**: Apenas Nova, Shimmer, Alloy e Onyx - removidas vozes inadequadas
  - **Preview de voz para clientes**: Clientes podem testar vozes usando chave configurada pelo master
  - **Seleção de modelo GPT**: Master escolhe entre GPT-3.5 Turbo, GPT-4, GPT-4 Turbo, GPT-4o
  - **Endpoint TTS atualizado**: Suporte para master (própria chave) e cliente (chave do sistema)
  - **Configurações específicas salvas**: Cliente salva apenas voz, Master salva todas configurações

- June 14, 2025: Sistema de voz otimizado e validação OpenAI corrigida
  - **Sistema de login master corrigido**: Problema na ordem de parâmetros apiRequest resolvido
  - **Validação OpenAI melhorada**: Mensagens específicas para quota excedida, chave inválida, formato incorreto
  - **Voz do navegador otimizada**: Seleção automática da melhor voz portuguesa disponível  
  - **Configurações de áudio ajustadas**: Rate 0.85, pitch 1.1, volume 0.9 para reduzir robotização
  - **Sistema de fallback robusto**: TTS OpenAI → Web Speech API → mensagem de texto
  - **Logs detalhados implementados**: Rastreamento completo de problemas de áudio e gravação
  - **Detecção de compatibilidade**: Verificações robustas para MediaRecorder e getUserMedia

- June 14, 2025: Sistema de entrevistas totalmente funcional - Problema dos links resolvido
  - **Links de entrevista 100% funcionais**: Corrigido problema crítico na query do frontend
  - **Frontend query corrigida**: Mudança de queryKey de array para string única `/api/interview/${token}`
  - **Busca robusta de jobs implementada**: Sistema resolve automaticamente discrepância de IDs Firebase vs frontend
  - **API de entrevistas otimizada**: Logs detalhados e busca inteligente por ID parcial funcionando
  - **Sistema de emails completamente operacional**: URLs corretas sendo enviadas via Resend
  - **Interface de entrevista carregando dados completos**: Job, candidato, seleção e perguntas
  - **Função duplicar seleção implementada**: Botão copy na tabela funcionando
  - **Exibição de data/hora melhorada**: Formato brasileiro com horário em linha separada
  - **Schema atualizado**: candidateListId vincula seleções a listas específicas de candidatos

- June 13, 2025: Sistema de formulários inline implementado
  - Removidos todos os popups do sistema conforme solicitado pelo usuário
  - Sistema de cadastro de vagas convertido para formulário inline sem popups
  - Sistema de cadastro de clientes convertido para formulário inline sem popups
  - Seleção de cliente para usuários master implementada no cadastro de vagas
  - Usuários cliente cadastram vagas apenas para si mesmos
  - Todas as funcionalidades mantidas com interface mais integrada

- June 13, 2025: Database migration completed - System migrated to Firebase Firestore
  - Successfully migrated from PostgreSQL to Firebase Firestore as primary database
  - FirebaseStorage class fully implemented with all IStorage interface methods
  - Firebase Firestore API enabled and configured with security rules
  - Master user account active in Firebase: daniel@grupomaximuns.com.br / daniel580190
  - All data persistence now uses Firebase Firestore for real-time capabilities and scalability
  - Authentication and authorization working perfectly with Firebase backend

## Changelog

- June 13, 2025: Initial setup and database integration