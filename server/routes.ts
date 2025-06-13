import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertClientSchema, insertJobSchema, insertQuestionSchema, 
         insertCandidateSchema, insertSelectionSchema, insertInterviewSchema, 
         insertResponseSchema, insertApiConfigSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";

const JWT_SECRET = process.env.JWT_SECRET || "maximus-interview-secret-key";
const upload = multer({ dest: 'uploads/' });

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    clientId?: number;
  };
}

// Authentication middleware
const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      clientId: user.role === 'client' ? decoded.clientId : undefined
    };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Role authorization middleware
const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Express.Response, next: Express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Check regular users first
      let user = await storage.getUserByEmail(email);
      let clientId;
      
      // If not found in users, check clients
      if (!user) {
        const client = await storage.getClientByEmail(email);
        if (client && await bcrypt.compare(password, client.password)) {
          user = {
            id: client.id,
            email: client.email,
            role: 'client',
            name: client.companyName,
            password: client.password,
            createdAt: client.createdAt
          };
          clientId = client.id;
        }
      }
      
      if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ 
        id: user.id, 
        email: user.email, 
        role: user.role,
        clientId 
      }, JWT_SECRET);
      
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role, 
          name: user.name,
          clientId 
        } 
      });
    } catch (error) {
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      userData.password = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser(userData);
      res.status(201).json({ id: user.id, email: user.email, role: user.role });
    } catch (error) {
      res.status(400).json({ message: 'Registration failed' });
    }
  });

  // Master routes
  app.get("/api/stats", authenticate, authorize(['master']), async (req, res) => {
    try {
      const stats = await storage.getInterviewStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  app.get("/api/clients", authenticate, authorize(['master']), async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch clients' });
    }
  });

  app.post("/api/clients", authenticate, authorize(['master']), async (req, res) => {
    try {
      console.log("Dados recebidos:", req.body);
      
      // Converter strings de data para objetos Date antes da validação
      const processedData = {
        ...req.body,
        contractStart: req.body.contractStart ? new Date(req.body.contractStart) : undefined,
        additionalLimitExpiry: req.body.additionalLimitExpiry ? new Date(req.body.additionalLimitExpiry) : undefined,
        contractEnd: req.body.contractEnd ? new Date(req.body.contractEnd) : undefined,
      };
      
      console.log("Dados processados:", processedData);
      
      const clientData = insertClientSchema.parse(processedData);
      console.log("Dados validados:", clientData);
      
      clientData.password = await bcrypt.hash(clientData.password, 10);
      console.log("Senha hasheada com sucesso");
      
      const client = await storage.createClient(clientData);
      console.log("Cliente criado com sucesso:", client);
      res.status(201).json(client);
    } catch (error) {
      console.error("Erro detalhado ao criar cliente:", error);
      res.status(400).json({ 
        message: 'Failed to create client',
        error: error.message 
      });
    }
  });

  app.put("/api/clients/:id", authenticate, authorize(['master']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10);
      }
      
      const client = await storage.updateClient(id, updates);
      res.json(client);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update client' });
    }
  });

  app.patch("/api/clients/:id", authenticate, authorize(['master']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      // Processar datas se estiverem presentes
      if (updates.contractStart) {
        updates.contractStart = new Date(updates.contractStart);
      }
      if (updates.contractEnd) {
        updates.contractEnd = new Date(updates.contractEnd);
      }
      
      console.log('PATCH - Dados recebidos para atualização:', updates);
      
      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10);
      }
      
      const client = await storage.updateClient(id, updates);
      res.json(client);
    } catch (error) {
      console.error('Erro ao fazer PATCH do cliente:', error);
      res.status(400).json({ message: 'Failed to update client' });
    }
  });

  app.delete("/api/clients/:id", authenticate, authorize(['master']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteClient(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: 'Failed to delete client' });
    }
  });

  // API Configuration routes
  app.get("/api/config", authenticate, authorize(['master']), async (req, res) => {
    try {
      const config = await storage.getApiConfig();
      res.json(config || {});
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch config' });
    }
  });

  app.post("/api/config", authenticate, authorize(['master']), async (req, res) => {
    try {
      const configData = insertApiConfigSchema.parse(req.body);
      const config = await storage.upsertApiConfig(configData);
      res.json(config);
    } catch (error) {
      res.status(400).json({ message: 'Failed to save config' });
    }
  });

  // Client routes
  app.get("/api/client/stats", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.clientId!;
      const stats = await storage.getClientStats(clientId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch client stats' });
    }
  });

  app.get("/api/jobs", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      let jobs;
      if (req.user!.role === 'master') {
        // Master pode ver todas as vagas
        jobs = await storage.getJobs();
      } else {
        // Cliente vê apenas suas vagas
        const clientId = req.user!.clientId!;
        jobs = await storage.getJobsByClientId(clientId);
      }
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch jobs' });
    }
  });

  app.post("/api/jobs", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.role === 'master' ? req.body.clientId || 1 : req.user!.clientId || 1;
      
      const jobData = insertJobSchema.parse({
        ...req.body,
        clientId: clientId
      });
      
      const job = await storage.createJob(jobData);
      res.status(201).json(job);
    } catch (error) {
      console.error("Erro ao criar vaga:", error);
      res.status(400).json({ message: 'Failed to create job' });
    }
  });

  app.put("/api/jobs/:id", authenticate, authorize(['client']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.updateJob(id, req.body);
      res.json(job);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update job' });
    }
  });

  app.delete("/api/jobs/:id", authenticate, authorize(['client']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteJob(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: 'Failed to delete job' });
    }
  });

  // Questions routes
  app.get("/api/questions", authenticate, authorize(['client', 'master']), async (req, res) => {
    try {
      const jobId = parseInt(req.query.jobId as string);
      const questions = await storage.getQuestionsByJobId(jobId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch questions' });
    }
  });

  app.get("/api/questions/count", authenticate, authorize(['client', 'master']), async (req, res) => {
    try {
      // Buscar contagem de perguntas por vaga
      const jobs = await storage.getJobs();
      const questionsCount: Record<number, number> = {};
      
      for (const job of jobs) {
        const questions = await storage.getQuestionsByJobId(job.id);
        questionsCount[job.id] = questions.length;
      }
      
      res.json(questionsCount);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch questions count' });
    }
  });

  app.post("/api/questions", authenticate, authorize(['client', 'master']), async (req, res) => {
    try {
      const questionData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(questionData);
      res.status(201).json(question);
    } catch (error) {
      console.error("Erro ao criar pergunta:", error);
      res.status(400).json({ message: 'Failed to create question' });
    }
  });

  app.get("/api/jobs/:jobId/questions", authenticate, authorize(['client']), async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const questions = await storage.getQuestionsByJobId(jobId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch questions' });
    }
  });

  app.post("/api/jobs/:jobId/questions", authenticate, authorize(['client']), async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const questionData = insertQuestionSchema.parse({
        ...req.body,
        jobId
      });
      
      const question = await storage.createQuestion(questionData);
      res.status(201).json(question);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create question' });
    }
  });

  app.patch("/api/questions/:id", authenticate, authorize(['client', 'master']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const question = await storage.updateQuestion(id, req.body);
      res.json(question);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update question' });
    }
  });

  app.delete("/api/questions/:id", authenticate, authorize(['client', 'master']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteQuestion(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: 'Failed to delete question' });
    }
  });

  app.delete("/api/questions/:id", authenticate, authorize(['client']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteQuestion(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: 'Failed to delete question' });
    }
  });

  // Candidates routes
  app.get("/api/candidates", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.clientId!;
      const candidates = await storage.getCandidatesByClientId(clientId);
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch candidates' });
    }
  });

  app.post("/api/candidates", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const candidateData = insertCandidateSchema.parse({
        ...req.body,
        clientId: req.user!.clientId!
      });
      
      const candidate = await storage.createCandidate(candidateData);
      res.status(201).json(candidate);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create candidate' });
    }
  });

  app.post("/api/candidates/bulk", authenticate, authorize(['client']), upload.single('file'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // In a real implementation, you would parse CSV/XLSX file here
      // For demo purposes, we'll simulate parsing
      const candidatesData = [
        { name: "João Silva", email: "joao@email.com", whatsapp: "+5511999999999" },
        { name: "Maria Santos", email: "maria@email.com", whatsapp: "+5511888888888" }
      ].map(data => ({
        ...data,
        clientId: req.user!.clientId!
      }));

      const candidates = await storage.createCandidates(candidatesData);
      res.status(201).json(candidates);
    } catch (error) {
      res.status(400).json({ message: 'Failed to import candidates' });
    }
  });

  app.put("/api/candidates/:id", authenticate, authorize(['client']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const candidate = await storage.updateCandidate(id, req.body);
      res.json(candidate);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update candidate' });
    }
  });

  app.delete("/api/candidates/:id", authenticate, authorize(['client']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCandidate(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: 'Failed to delete candidate' });
    }
  });

  // Selections routes
  app.get("/api/selections", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.clientId!;
      const selections = await storage.getSelectionsByClientId(clientId);
      res.json(selections);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch selections' });
    }
  });

  app.post("/api/selections", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const selectionData = insertSelectionSchema.parse({
        ...req.body,
        clientId: req.user!.clientId!
      });
      
      const selection = await storage.createSelection(selectionData);
      res.status(201).json(selection);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create selection' });
    }
  });

  app.put("/api/selections/:id", authenticate, authorize(['client']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const selection = await storage.updateSelection(id, req.body);
      res.json(selection);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update selection' });
    }
  });

  // Interview routes (public for candidates)
  app.get("/api/interview/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const interview = await storage.getInterviewByToken(token);
      
      if (!interview) {
        return res.status(404).json({ message: 'Interview not found' });
      }

      // Get selection and job details
      const selection = await storage.getSelectionById(interview.selectionId);
      const job = selection ? await storage.getJobById(selection.jobId) : null;
      const questions = job ? await storage.getQuestionsByJobId(job.id) : [];
      
      res.json({
        interview,
        selection,
        job,
        questions: questions.map(q => ({ 
          id: q.id, 
          questionText: q.questionText, 
          maxTime: q.maxTime, 
          order: q.order 
        }))
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch interview' });
    }
  });

  app.put("/api/interview/:token/start", async (req, res) => {
    try {
      const token = req.params.token;
      const interview = await storage.getInterviewByToken(token);
      
      if (!interview) {
        return res.status(404).json({ message: 'Interview not found' });
      }

      const updatedInterview = await storage.updateInterview(interview.id, {
        status: 'started',
        startedAt: new Date()
      });
      
      res.json(updatedInterview);
    } catch (error) {
      res.status(500).json({ message: 'Failed to start interview' });
    }
  });

  app.post("/api/interview/:token/response", upload.single('audio'), async (req, res) => {
    try {
      const token = req.params.token;
      const { questionId } = req.body;
      
      const interview = await storage.getInterviewByToken(token);
      if (!interview) {
        return res.status(404).json({ message: 'Interview not found' });
      }

      let audioUrl = '';
      let transcription = '';
      let score = 0;

      if (req.file) {
        // In a real implementation, you would:
        // 1. Upload to Firebase Storage
        // 2. Use OpenAI Whisper for transcription
        // 3. Use ChatGPT for analysis and scoring
        
        audioUrl = `/uploads/${req.file.filename}`;
        transcription = "Sample transcription from audio file";
        score = Math.floor(Math.random() * 100); // Mock score
      }

      const response = await storage.createResponse({
        interviewId: interview.id,
        questionId: parseInt(questionId),
        audioUrl,
        transcription,
        score,
        aiAnalysis: { similarity: score, feedback: "Sample AI analysis" },
        recordingDuration: 120
      });

      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Failed to save response' });
    }
  });

  app.put("/api/interview/:token/complete", async (req, res) => {
    try {
      const token = req.params.token;
      const interview = await storage.getInterviewByToken(token);
      
      if (!interview) {
        return res.status(404).json({ message: 'Interview not found' });
      }

      // Calculate total score from responses
      const responses = await storage.getResponsesByInterviewId(interview.id);
      const totalScore = responses.length > 0 
        ? Math.round(responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length)
        : 0;

      // Determine category based on score
      let category = 'low';
      if (totalScore >= 80) category = 'high';
      else if (totalScore >= 60) category = 'medium';

      const updatedInterview = await storage.updateInterview(interview.id, {
        status: 'completed',
        completedAt: new Date(),
        totalScore,
        category,
        aiAnalysis: { 
          overallScore: totalScore,
          category,
          summary: "AI-generated interview summary"
        }
      });
      
      res.json(updatedInterview);
    } catch (error) {
      res.status(500).json({ message: 'Failed to complete interview' });
    }
  });

  // Results routes
  app.get("/api/selections/:id/results", authenticate, authorize(['client']), async (req, res) => {
    try {
      const selectionId = parseInt(req.params.id);
      const interviews = await storage.getInterviewsBySelectionId(selectionId);
      
      const results = await Promise.all(interviews.map(async (interview) => {
        const candidate = await storage.getCandidateById(interview.candidateId);
        const responses = await storage.getResponsesByInterviewId(interview.id);
        
        return {
          interview,
          candidate,
          responses
        };
      }));
      
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch results' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
