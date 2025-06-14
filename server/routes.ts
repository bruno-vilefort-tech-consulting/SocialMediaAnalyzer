import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertClientSchema, insertJobSchema, insertQuestionSchema, 
         insertCandidateSchema, insertCandidateListSchema, insertSelectionSchema, insertInterviewSchema, 
         insertResponseSchema, insertApiConfigSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";

const JWT_SECRET = process.env.JWT_SECRET || "maximus-interview-secret-key";
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

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
    
    // Try to find user in users table first
    let user = await storage.getUserById(decoded.id);
    
    // If not found in users table, try clients table
    if (!user) {
      const client = await storage.getClientById(decoded.id);
      if (client) {
        user = {
          id: client.id,
          email: client.email,
          role: 'client',
          createdAt: client.createdAt
        };
      }
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      clientId: user.role === 'client' ? user.id : undefined
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
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
      
      // Se contractEnd for null (contrato indeterminado), manter como null
      // Se contractEnd tiver valor, converter para Date
      if (updates.contractEnd === null) {
        updates.contractEnd = null;
      } else if (updates.contractEnd) {
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
      // Garantir que clientId seja um número válido e não muito grande
      let clientId = 1;
      if (req.user!.role === 'master') {
        clientId = req.body.clientId && Number.isInteger(req.body.clientId) && req.body.clientId < 2147483647 
          ? req.body.clientId 
          : 1;
      } else {
        clientId = req.user!.clientId && req.user!.clientId < 2147483647 
          ? req.user!.clientId 
          : 1;
      }

      console.log('ClientId para vaga:', clientId);
      console.log('Dados recebidos do frontend:', req.body);
      
      // Mapear campos antigos para novos se necessário
      const bodyData = {
        nomeVaga: req.body.nomeVaga || req.body.title,
        descricaoVaga: req.body.descricaoVaga || req.body.description,
        clientId: clientId,
        status: req.body.status || 'ativo'
      };
      
      const jobData = insertJobSchema.parse(bodyData);
      
      const job = await storage.createJob(jobData);
      res.status(201).json(job);
    } catch (error) {
      console.error("Erro ao criar vaga:", error);
      res.status(400).json({ message: 'Failed to create job' });
    }
  });

  app.put("/api/jobs/:id", authenticate, authorize(['client', 'master']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.updateJob(id, req.body);
      res.json(job);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update job' });
    }
  });

  app.patch("/api/jobs/:id", authenticate, authorize(['client', 'master']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.updateJob(id, req.body);
      res.json(job);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update job' });
    }
  });

  app.delete("/api/jobs/:id", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      console.log('Tentando deletar vaga ID:', id, 'pelo usuário:', req.user?.email);
      
      // Converter para string para ser compatível com Firebase
      await storage.deleteJob(id);
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao deletar vaga:', error);
      res.status(400).json({ message: 'Failed to delete job' });
    }
  });

  // Questions routes
  app.get("/api/questions/:jobId", authenticate, authorize(['client', 'master']), async (req, res) => {
    try {
      const jobId = req.params.jobId;
      const questions = await storage.getQuestionsByJobId(jobId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch questions' });
    }
  });

  app.get("/api/jobs/:id/questions", authenticate, authorize(['client', 'master']), async (req, res) => {
    try {
      const jobId = req.params.id;
      const questions = await storage.getQuestionsByJobId(jobId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch questions' });
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

  app.patch("/api/questions/:id", authenticate, authorize(['client', 'master']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const question = await storage.updateQuestion(id, req.body);
      res.json(question);
    } catch (error) {
      console.error("Erro ao atualizar pergunta:", error);
      res.status(400).json({ message: 'Failed to update question' });
    }
  });

  app.delete("/api/questions/:id", authenticate, authorize(['client', 'master']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteQuestion(id);
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao deletar pergunta:", error);
      res.status(400).json({ message: 'Failed to delete question' });
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
      console.log('Dados recebidos para pergunta:', req.body);
      
      const questionData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(questionData);
      
      console.log('Pergunta criada:', question);
      
      res.status(201).json(question);
    } catch (error) {
      console.error("Erro ao criar pergunta:", error);
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

  // Candidate Lists routes
  app.get("/api/candidate-lists", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.role === 'master' ? 1 : req.user!.clientId!;
      const lists = await storage.getCandidateListsByClientId(clientId);
      res.json(lists);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch candidate lists' });
    }
  });

  app.post("/api/candidate-lists", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      console.log('Dados recebidos para lista de candidatos:', req.body);
      console.log('Usuário:', req.user);
      
      const clientId = req.user!.role === 'master' ? req.body.clientId || 1 : req.user!.clientId!;
      const listData = insertCandidateListSchema.parse({ 
        ...req.body, 
        clientId 
      });
      
      console.log('Dados validados para lista:', listData);
      
      const list = await storage.createCandidateList(listData);
      
      console.log('Lista criada:', list);
      
      res.status(201).json(list);
    } catch (error) {
      console.error('Erro ao criar lista de candidatos:', error);
      res.status(400).json({ message: 'Failed to create candidate list', error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/candidate-lists/:id", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      console.log('Tentando deletar lista ID:', req.params.id, 'pelo usuário:', req.user?.email);
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid list ID' });
      }
      
      await storage.deleteCandidateList(id);
      
      console.log('Lista deletada com sucesso:', id);
      
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao deletar lista de candidatos:', error);
      res.status(400).json({ message: 'Failed to delete candidate list', error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Candidates routes
  app.get("/api/candidates", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const listId = req.query.listId as string;
      if (listId) {
        const candidates = await storage.getCandidatesByListId(parseInt(listId));
        res.json(candidates);
      } else {
        const clientId = req.user!.role === 'master' ? 1 : req.user!.clientId!;
        const candidates = await storage.getCandidatesByClientId(clientId);
        res.json(candidates);
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch candidates' });
    }
  });

  app.post("/api/candidates", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.role === 'master' ? req.body.clientId || 1 : req.user!.clientId!;
      const candidateData = { ...req.body, clientId };
      const candidate = await storage.createCandidate(candidateData);
      res.status(201).json(candidate);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create candidate' });
    }
  });

  app.post("/api/candidates/bulk", authenticate, authorize(['client', 'master']), upload.single('file'), async (req: AuthRequest, res) => {
    try {
      console.log('Arquivo recebido:', req.file);
      
      if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
      }

      if (!req.file.buffer) {
        return res.status(400).json({ message: 'Arquivo inválido ou corrompido' });
      }

      const { listId } = req.body;
      if (!listId) {
        return res.status(400).json({ message: 'Lista de candidatos obrigatória' });
      }

      // Verificar se o arquivo tem conteúdo
      if (req.file.buffer.length === 0) {
        return res.status(400).json({ message: 'Arquivo vazio' });
      }

      // Parse Excel/CSV file
      const xlsx = await import('xlsx');
      console.log('Buffer length:', req.file.buffer.length);
      
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return res.status(400).json({ message: 'Arquivo Excel não contém planilhas válidas' });
      }
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        return res.status(400).json({ message: 'Arquivo vazio ou formato inválido' });
      }

      // Validate and transform data
      const candidatesData = jsonData.map((row: any, index: number) => {
        const name = row['Nome'] || row['nome'] || row['Name'] || row['name'];
        const email = row['Email'] || row['email'];
        const phone = row['Celular'] || row['celular'] || row['Telefone'] || row['telefone'] || row['Phone'] || row['phone'];

        if (!name || !email || !phone) {
          throw new Error(`Linha ${index + 2}: Nome, Email e Celular são obrigatórios`);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error(`Linha ${index + 2}: Email inválido - ${email}`);
        }

        // Validate Brazilian phone format
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length < 10 || phoneDigits.length > 11) {
          throw new Error(`Linha ${index + 2}: Celular deve ter 10 ou 11 dígitos - ${phone}`);
        }

        const clientId = req.user!.role === 'master' ? req.body.clientId || 1 : req.user!.clientId!;

        return {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phoneDigits,
          clientId,
          listId: parseInt(listId)
        };
      });

      const candidates = await storage.createCandidates(candidatesData);
      res.status(201).json({
        message: `${candidates.length} candidatos importados com sucesso`,
        candidates
      });
    } catch (error: any) {
      console.error('Erro na importação:', error);
      res.status(400).json({ message: error.message || 'Falha na importação de candidatos' });
    }
  });

  app.patch("/api/candidates/:id", authenticate, authorize(['client', 'master']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const candidate = await storage.updateCandidate(id, req.body);
      res.json(candidate);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update candidate' });
    }
  });

  app.delete("/api/candidates/:id", authenticate, authorize(['client', 'master']), async (req, res) => {
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
          perguntaCandidato: q.perguntaCandidato, 
          respostaPerfeita: q.respostaPerfeita, 
          numeroPergunta: q.numeroPergunta 
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
