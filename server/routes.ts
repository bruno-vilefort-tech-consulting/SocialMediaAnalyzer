import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { transcriptionService } from "./transcriptionService";
import { insertUserSchema, insertClientSchema, insertJobSchema, insertQuestionSchema, 
         insertCandidateSchema, insertCandidateListSchema, insertSelectionSchema, insertInterviewSchema, 
         insertResponseSchema, insertApiConfigSchema, insertReportFolderSchema, insertReportFolderAssignmentSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { firebaseDb } from "./db";
import admin from "firebase-admin";
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from "firebase/firestore";
import { createTestCandidates, checkTestCandidatesExist } from "./createTestCandidates";
import { htmlExportService } from "./htmlExportService";
import { emailService } from "./emailService";

const JWT_SECRET = process.env.JWT_SECRET || 'maximus-interview-system-secret-key-2024';
console.log(`🔑 JWT_SECRET configurado: ${JWT_SECRET?.substring(0, 10)}...`);

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    clientId?: string;
  };
}

// Authentication middleware
const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Token de autenticação necessário' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Erro de autenticação:', error);
    res.status(401).json({ message: 'Token inválido' });
  }
};

// Authorization middleware factory
const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    next();
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios' });
      }

      const user = await storage.validateUserPassword(email, password);
      if (!user) {
        return res.status(401).json({ message: 'Credenciais inválidas' });
      }

      const token = jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.clientId
      }, JWT_SECRET, { expiresIn: '24h' });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.clientId
        }
      });
    } catch (error) {
      console.error('❌ Erro no login:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // User routes
  app.get('/api/users', authenticate, authorize(['master']), async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.post('/api/users', authenticate, authorize(['master']), async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      res.status(201).json(user);
    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Client routes
  app.get('/api/clients', authenticate, authorize(['master']), async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error('❌ Erro ao buscar clientes:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.post('/api/clients', authenticate, authorize(['master']), async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData);
      res.status(201).json(client);
    } catch (error) {
      console.error('❌ Erro ao criar cliente:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Job routes
  app.get('/api/jobs', authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user?.role === 'client' ? req.user.clientId : req.query.clientId as string;
      const jobs = await storage.getJobsByClientId(clientId || '');
      res.json(jobs);
    } catch (error) {
      console.error('❌ Erro ao buscar vagas:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.post('/api/jobs', authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const jobData = insertJobSchema.parse(req.body);
      const clientId = req.user?.role === 'client' ? req.user.clientId : jobData.clientId;
      
      const job = await storage.createJob({
        ...jobData,
        clientId: clientId || ''
      });
      
      res.status(201).json(job);
    } catch (error) {
      console.error('❌ Erro ao criar vaga:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Candidate routes
  app.get('/api/candidates', authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user?.role === 'client' ? req.user.clientId : req.query.clientId as string;
      const candidates = await storage.getCandidatesByClientId(clientId || '');
      res.json(candidates);
    } catch (error) {
      console.error('❌ Erro ao buscar candidatos:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.post('/api/candidates', authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const candidateData = insertCandidateSchema.parse(req.body);
      const clientId = req.user?.role === 'client' ? req.user.clientId : candidateData.clientId;
      
      const candidate = await storage.createCandidate({
        ...candidateData,
        clientId: clientId || ''
      });
      
      res.status(201).json(candidate);
    } catch (error) {
      console.error('❌ Erro ao criar candidato:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Assessment email sending route
  app.post('/api/send-assessment-email', authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { 
        assessmentType, 
        candidates, 
        emailSubject, 
        emailMessage, 
        sendNow, 
        scheduleDate, 
        scheduleTime 
      } = req.body;

      const clientId = req.user?.role === 'client' ? req.user.clientId : req.body.clientId;

      if (!assessmentType || !candidates || !emailSubject || !emailMessage) {
        return res.status(400).json({ 
          message: 'Campos obrigatórios: assessmentType, candidates, emailSubject, emailMessage' 
        });
      }

      let candidateList = [];
      
      if (candidates.type === 'list' && candidates.listId) {
        candidateList = await storage.getCandidatesByListId(candidates.listId);
      } else if (candidates.type === 'search' && candidates.selectedCandidates) {
        candidateList = candidates.selectedCandidates;
      }

      if (candidateList.length === 0) {
        return res.status(400).json({ message: 'Nenhum candidato encontrado para envio' });
      }

      let successCount = 0;
      let errorCount = 0;

      for (const candidate of candidateList) {
        if (!candidate.email) {
          errorCount++;
          continue;
        }

        try {
          const personalizedMessage = emailMessage
            .replace(/\[nome do candidato\]/g, candidate.name)
            .replace(/\[clienteid\]/g, clientId || '');

          const result = await emailService.sendAssessmentEmail({
            to: candidate.email,
            subject: emailSubject,
            message: personalizedMessage,
            assessmentType,
            candidateName: candidate.name
          });

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (emailError) {
          console.error(`❌ Erro ao enviar email para ${candidate.email}:`, emailError);
          errorCount++;
        }
      }

      res.json({
        success: true,
        message: `Emails enviados: ${successCount} sucesso, ${errorCount} erros`,
        details: {
          total: candidateList.length,
          success: successCount,
          errors: errorCount
        }
      });

    } catch (error) {
      console.error('❌ Erro ao enviar emails de assessment:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Evolution API endpoints - removed but keeping stub for compatibility
  app.post('/api/evolution/connect', authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    res.json({ success: true, message: 'Evolution API removida - use Baileys' });
  });

  app.post('/api/evolution/disconnect', authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    res.json({ success: true, message: 'Evolution API removida - use Baileys' });
  });

  app.get('/api/evolution/status', authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    res.json({ success: true, isConnected: false, message: 'Evolution API removida' });
  });

  app.post('/api/evolution/test', authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    res.json({ success: true, message: 'Evolution API removida - use Baileys' });
  });

  return server;
}