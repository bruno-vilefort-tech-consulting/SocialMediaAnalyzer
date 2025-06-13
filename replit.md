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