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
import { whatsappQRService } from "./whatsappQRService";
import { whatsappManager } from "./whatsappManager";

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
    console.log('🔐 Authorization check:', {
      userRole: req.user?.role,
      allowedRoles: roles,
      userExists: !!req.user
    });
    
    if (!req.user || !roles.includes(req.user.role)) {
      console.log('❌ Authorization failed for user:', req.user?.email, 'Role:', req.user?.role, 'Required:', roles);
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
      console.log('Dados recebidos para criação de vaga:', req.body);
      
      // Garantir que clientId seja um número válido
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

      // Validar dados básicos da vaga
      const jobData = insertJobSchema.parse({
        nomeVaga: req.body.nomeVaga,
        descricaoVaga: req.body.descricaoVaga || '',
        clientId: clientId,
        status: req.body.status || 'ativo'
      });
      
      // Criar vaga com perguntas integradas
      const vagaCompleta = {
        ...jobData,
        perguntas: req.body.perguntas || []
      };
      
      console.log('Criando vaga com dados:', vagaCompleta);
      const job = await storage.createJob(vagaCompleta);
      
      res.status(201).json(job);
    } catch (error) {
      console.error("Erro ao criar vaga:", error);
      res.status(400).json({ message: 'Failed to create job', error: error.message });
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
      const id = req.params.id; // Manter como string para Firebase
      console.log('Atualizando vaga ID:', id, 'com dados:', req.body);
      const job = await storage.updateJob(id, req.body);
      res.json(job);
    } catch (error) {
      console.error('Erro na rota de atualização:', error);
      res.status(400).json({ message: 'Failed to update job', error: error.message });
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
      if (req.user!.role === 'master') {
        // Master pode ver listas de todos os clientes OU filtrar por cliente específico
        const clientIdFilter = req.query.clientId as string;
        if (clientIdFilter) {
          const lists = await storage.getCandidateListsByClientId(parseInt(clientIdFilter));
          console.log('🔍 Master buscando listas do cliente:', clientIdFilter, '- encontradas:', lists.length);
          res.json(lists);
        } else {
          const lists = await storage.getAllCandidateLists();
          console.log('🔍 Master buscando todas as listas:', lists.length);
          res.json(lists);
        }
      } else {
        // Cliente vê APENAS suas próprias listas - ISOLAMENTO TOTAL
        const lists = await storage.getCandidateListsByClientId(req.user!.clientId!);
        console.log('🔍 Cliente buscando listas do clientId:', req.user!.clientId, '- encontradas:', lists.length);
        res.json(lists);
      }
    } catch (error) {
      console.error('Erro ao buscar listas de candidatos:', error);
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

  // Endpoint específico para candidatos de uma lista
  app.get("/api/lists/:listId/candidates", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const listId = parseInt(req.params.listId);
      console.log(`🔍 Buscando candidatos da lista ${listId}`);
      
      if (isNaN(listId)) {
        return res.status(400).json({ message: 'Invalid list ID' });
      }
      
      const candidates = await storage.getCandidatesByListId(listId);
      console.log(`📋 Encontrados ${candidates.length} candidatos na lista ${listId}`);
      
      res.json(candidates);
    } catch (error) {
      console.error('Erro ao buscar candidatos da lista:', error);
      res.status(500).json({ message: 'Failed to fetch list candidates' });
    }
  });

  // Endpoint para buscar todos os relacionamentos candidato-lista-memberships
  app.get("/api/candidate-list-memberships", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      console.log('🔍 Buscando todos os candidate-list-memberships');
      const memberships = await storage.getAllCandidateListMemberships();
      console.log(`📋 Retornando ${memberships.length} memberships para o frontend`);
      res.json(memberships);
    } catch (error) {
      console.error('Erro ao buscar candidate-list-memberships:', error);
      res.status(500).json({ message: 'Failed to fetch candidate list memberships' });
    }
  });

  // Candidates routes
  app.get("/api/candidates", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const clientIdFilter = req.query.clientId as string;
      
      if (req.user!.role === 'master') {
        // Master pode ver candidatos de todos os clientes OU filtrar por cliente específico
        if (clientIdFilter) {
          const candidates = await storage.getCandidatesByClientId(parseInt(clientIdFilter));
          res.json(candidates);
        } else {
          // Se não especificar cliente, retornar vazio para evitar confusão
          res.json([]);
        }
      } else {
        // Cliente só vê seus próprios candidatos - ISOLAMENTO TOTAL
        const candidates = await storage.getCandidatesByClientId(req.user!.clientId!);
        res.json(candidates);
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch candidates' });
    }
  });

  app.post("/api/candidates", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      console.log('🔍 Dados recebidos no endpoint POST /api/candidates:', req.body);
      
      const { name, email, whatsapp, listId, clientId } = req.body;
      
      // Validar campos obrigatórios
      if (!name || !email || !whatsapp || !listId || !clientId) {
        return res.status(400).json({ 
          message: 'Campos obrigatórios: name, email, whatsapp, listId, clientId' 
        });
      }
      
      // Criar candidato no Firebase
      const candidateData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.trim(),
        clientId: parseInt(clientId),
        listId: parseInt(listId)
      };
      
      console.log('💾 Criando candidato com dados:', candidateData);
      const candidate = await storage.createCandidate(candidateData);
      
      console.log('✅ Candidato criado:', candidate);
      res.status(201).json(candidate);
    } catch (error) {
      console.error('❌ Erro ao criar candidato:', error);
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

      // Buscar candidatos existentes na lista para verificar duplicatas
      const existingCandidates = await storage.getCandidatesByListId(parseInt(listId));
      
      // Validate and transform data
      const validCandidates = [];
      const duplicates = [];
      const errors = [];

      for (let index = 0; index < jsonData.length; index++) {
        const row = jsonData[index];
        
        try {
          const name = row['Nome'] || row['nome'] || row['Name'] || row['name'] || '';
          const email = row['Email'] || row['email'] || '';
          const phone = row['Celular'] || row['celular'] || row['Telefone'] || row['telefone'] || row['Phone'] || row['phone'] || '';

          // Verificar se os campos estão preenchidos e não são apenas espaços vazios
          if (!name || !name.toString().trim()) {
            errors.push(`Linha ${index + 2}: Nome é obrigatório`);
            continue;
          }
          
          if (!email || !email.toString().trim()) {
            errors.push(`Linha ${index + 2}: Email é obrigatório`);
            continue;
          }
          
          if (!phone || !phone.toString().trim()) {
            errors.push(`Linha ${index + 2}: Celular é obrigatório`);
            continue;
          }

          // Validate email format
          const emailStr = String(email).trim().toLowerCase();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(emailStr)) {
            errors.push(`Linha ${index + 2}: Email inválido - ${emailStr}`);
            continue;
          }

          // Validate Brazilian phone format
          const phoneStr = String(phone);
          const phoneDigits = phoneStr.replace(/\D/g, '');
          if (phoneDigits.length < 10 || phoneDigits.length > 11) {
            errors.push(`Linha ${index + 2}: Celular deve ter 10 ou 11 dígitos - ${phone}`);
            continue;
          }

          const nameStr = String(name).trim();

          // Verificar duplicatas
          const isDuplicate = existingCandidates.some(existing => 
            existing.name.toLowerCase() === nameStr.toLowerCase() ||
            existing.email.toLowerCase() === emailStr ||
            existing.phone === phoneDigits
          );

          if (isDuplicate) {
            duplicates.push({
              line: index + 2,
              name: nameStr,
              email: emailStr,
              phone: phoneDigits,
              reason: 'Candidato já existe na lista (nome, email ou celular duplicado)'
            });
            continue;
          }

          const clientId = req.user!.role === 'master' ? req.body.clientId || 1 : req.user!.clientId!;

          validCandidates.push({
            name: nameStr,
            email: emailStr,
            phone: phoneDigits,
            clientId,
            listId: parseInt(listId)
          });
        } catch (error) {
          errors.push(`Linha ${index + 2}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
      }

      // Se há erros críticos, retornar erro
      if (errors.length > 0) {
        return res.status(400).json({ 
          message: 'Erros encontrados no arquivo', 
          errors 
        });
      }

      // Importar apenas candidatos válidos (não duplicados)
      let importedCandidates = [];
      if (validCandidates.length > 0) {
        importedCandidates = await storage.createCandidates(validCandidates);
      }

      // Preparar resposta
      const response: any = {
        message: `${importedCandidates.length} candidatos importados com sucesso`,
        imported: importedCandidates.length,
        duplicates: duplicates.length,
        candidates: importedCandidates
      };

      if (duplicates.length > 0) {
        response.duplicatesList = duplicates;
        response.message += `. ${duplicates.length} candidatos não foram importados por já existirem na lista`;
      }

      res.status(201).json(response);
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
  app.get("/api/selections", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      let selections = [];
      
      if (req.user!.role === 'master') {
        // Master pode ver seleções de todos os clientes OU filtrar por cliente específico
        const clientIdFilter = req.query.clientId ? parseInt(req.query.clientId as string) : null;
        if (clientIdFilter) {
          selections = await storage.getSelectionsByClientId(clientIdFilter);
          console.log(`Master buscando seleções do cliente ${clientIdFilter}: ${selections.length} encontradas`);
        } else {
          // Para master sem filtro, buscar todas as seleções de todos os clientes
          const clients = await storage.getClients();
          for (const client of clients) {
            const clientSelections = await storage.getSelectionsByClientId(client.id);
            selections.push(...clientSelections);
          }
          console.log(`Master buscando todas as seleções: ${selections.length} encontradas`);
        }
      } else {
        // Cliente só vê suas próprias seleções - ISOLAMENTO TOTAL
        selections = await storage.getSelectionsByClientId(req.user!.clientId!);
        console.log(`Cliente ${req.user!.email} buscando suas seleções: ${selections.length} encontradas`);
      }
      
      res.json(selections);
    } catch (error) {
      console.error('Erro ao buscar selections:', error);
      res.status(500).json({ message: 'Failed to fetch selections' });
    }
  });

  app.post("/api/selections", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      console.log('Received selection data:', req.body);
      
      const selectionData = {
        ...req.body,
        clientId: req.user!.role === 'master' ? req.body.clientId : req.user!.clientId!
      };
      
      console.log('Processed selection data:', selectionData);
      
      const selection = await storage.createSelection(selectionData);
      console.log('✅ Seleção criada:', {
        id: selection.id,
        status: selection.status,
        sendVia: selection.sendVia,
        candidateListId: selection.candidateListId
      });
      
      // Enviar convites automaticamente se a seleção for criada como "active"
      if (selection.status === 'active' && selection.sendVia) {
        console.log('🚀 INICIANDO ENVIO AUTOMÁTICO - Selection ID:', selection.id, 'Via:', selection.sendVia);
        
        try {
          // Buscar dados necessários
          const job = await storage.getJobById(selection.jobId);
          console.log('📝 Job encontrado para envio automático:', job);
          
          const candidates = await storage.getCandidatesByClientId(selection.clientId);
          console.log('👥 Candidatos encontrados para envio automático:', candidates.length, 'candidatos');
          
          if (!job) {
            console.log('❌ Job não encontrado para envio automático');
            return res.status(201).json(selection);
          }
          
          if (candidates.length === 0) {
            console.log('❌ Nenhum candidato encontrado para envio automático');
            return res.status(201).json(selection);
          }
          
          const client = await storage.getClientById(selection.clientId);
          const questions = await storage.getQuestionsByJobId(job.id);
          const baseUrl = process.env.REPL_URL || 'http://localhost:5000';
          let messagesSent = 0;
          
          // Buscar candidatos da lista específica
          const listCandidates = await storage.getCandidatesByListId(selection.candidateListId!);
          console.log('👥 Candidatos da lista encontrados:', listCandidates.length, 'candidatos');
          
          for (const candidate of listCandidates) {
            console.log('📱 Processando candidato:', candidate.name, candidate.whatsapp || candidate.email);
            
            // Gerar token único para cada candidato
            const token = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
            
            const interview = await storage.createInterview({
              selectionId: selection.id,
              candidateId: candidate.id,
              token,
              status: 'pending'
            });
            
            console.log('🎤 Entrevista criada:', interview.id, 'Token:', token);
            
            // Enviar via WhatsApp se configurado
            if (selection.sendVia === 'whatsapp' || selection.sendVia === 'both') {
              if (candidate.whatsapp) {
                console.log('📱 Enviando convite WhatsApp para:', candidate.whatsapp);
                
                // Preparar mensagem WhatsApp com placeholders
                let whatsappMessage = selection.whatsappTemplate || '';
                whatsappMessage = whatsappMessage
                  .replace(/\[nome do candidato\]/g, candidate.name)
                  .replace(/\[Nome do Cliente\]/g, client?.companyName || 'Nossa Empresa')
                  .replace(/\[Nome da Vaga\]/g, job.nomeVaga)
                  .replace(/\[número de perguntas\]/g, questions.length.toString());

                // Garantir que WhatsApp está inicializado e conectado
                const whatsappService = await ensureWhatsAppReady();
                if (!whatsappService) {
                  console.log(`❌ WhatsApp Service não disponível para ${candidate.whatsapp}`);
                  throw new Error('WhatsApp Service não disponível');
                }
                
                // Aguardar mais tempo para garantir conexão ativa
                console.log(`🔄 Aguardando conexão WhatsApp para ${candidate.whatsapp}...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                try {
                  console.log(`📱 Tentando envio WhatsApp para ${candidate.whatsapp}`);
                  const whatsappResult = await whatsappService.sendTextMessage(
                    candidate.whatsapp,
                    whatsappMessage
                  );
                  
                  await storage.createMessageLog({
                    interviewId: interview.id,
                    type: 'whatsapp',
                    channel: 'whatsapp',
                    status: whatsappResult ? 'sent' : 'failed'
                  });
                  
                  if (whatsappResult) {
                    messagesSent++;
                    console.log(`✅ WhatsApp enviado para ${candidate.whatsapp}`);
                  } else {
                    console.error(`❌ Falha ao enviar WhatsApp para ${candidate.whatsapp}`);
                  }
                } catch (whatsappError) {
                  console.error('❌ Erro no envio WhatsApp:', whatsappError);
                  await storage.createMessageLog({
                    interviewId: interview.id,
                    type: 'whatsapp',
                    channel: 'whatsapp',
                    status: 'failed'
                  });
                }
              } else {
                console.log('⚠️ Candidato sem WhatsApp:', candidate.name);
              }
            }
            
            // Enviar via Email se configurado
            if (selection.sendVia === 'email' || selection.sendVia === 'both') {
              if (candidate.email) {
                console.log('📧 Enviando convite email para:', candidate.email);
                
                const interviewLink = `${baseUrl}/interview/${token}`;
                const { emailService } = await import('./emailService');
                
                // Preparar mensagens email com placeholders
                let emailMessage = selection.emailTemplate || '';
                let emailSubject = selection.emailSubject || 'Convite para Entrevista';

                emailMessage = emailMessage
                  .replace(/\[nome do candidato\]/g, candidate.name)
                  .replace(/\[Nome do Cliente\]/g, client?.companyName || 'Nossa Empresa')
                  .replace(/\[Nome da Vaga\]/g, job.nomeVaga)
                  .replace(/\[número de perguntas\]/g, questions.length.toString())
                  .replace(/\{link\}/g, interviewLink);

                emailSubject = emailSubject
                  .replace(/\{vaga\}/g, job.nomeVaga)
                  .replace(/\[Nome da Vaga\]/g, job.nomeVaga);

                if (!emailMessage.includes(interviewLink)) {
                  emailMessage += `\n\nPara iniciar sua entrevista, clique no link abaixo:\n${interviewLink}`;
                }
                
                try {
                  const emailResult = await emailService.sendEmail({
                    to: candidate.email,
                    subject: emailSubject,
                    html: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2563eb;">${emailSubject}</h2>
                        <div style="line-height: 1.6; white-space: pre-line;">
                          ${emailMessage}
                        </div>
                        <div style="margin-top: 30px; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
                          <h3 style="color: #1f2937; margin-top: 0;">Link da Entrevista:</h3>
                          <a href="${interviewLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            INICIAR ENTREVISTA
                          </a>
                          <p style="margin-top: 15px; font-size: 14px; color: #6b7280;">
                            Ou copie e cole este link no seu navegador:<br>
                            <span style="word-break: break-all;">${interviewLink}</span>
                          </p>
                        </div>
                      </div>
                    `
                  });
                  
                  await storage.createMessageLog({
                    interviewId: interview.id,
                    type: 'email',
                    channel: 'email',
                    status: emailResult ? 'sent' : 'failed'
                  });
                  
                  if (emailResult) {
                    messagesSent++;
                    console.log(`✅ Email enviado para ${candidate.email}`);
                  }
                } catch (emailError) {
                  console.error('❌ Erro no envio email:', emailError);
                }
              } else {
                console.log('⚠️ Candidato sem email:', candidate.name);
              }
            }
          }
          
          // Atualizar status da seleção para 'enviado'
          if (messagesSent > 0) {
            await storage.updateSelection(selection.id, { status: 'enviado' });
            console.log(`✅ Seleção criada e ${messagesSent} mensagens enviadas automaticamente`);
          }
        } catch (emailError) {
          console.error('Erro ao enviar emails automáticos:', emailError);
          // Não falhar a criação da seleção se o email falhar
        }
      }
      
      res.status(201).json(selection);
    } catch (error) {
      console.error('Error creating selection:', error);
      res.status(400).json({ 
        message: 'Failed to create selection',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.patch("/api/selections/:id", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const selection = await storage.updateSelection(id, req.body);
      res.json(selection);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update selection' });
    }
  });

  app.delete("/api/selections/:id", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSelection(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: 'Failed to delete selection' });
    }
  });

  app.post("/api/selections/:id/send", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      console.log('🚀 INICIANDO ENVIO DE EMAILS - Selection ID:', req.params.id);
      
      const id = parseInt(req.params.id);
      const selection = await storage.getSelectionById(id);
      
      console.log('📋 Selection encontrada:', selection);
      
      if (!selection) {
        console.log('❌ Selection não encontrada');
        return res.status(404).json({ message: 'Selection not found' });
      }

      // Get job and candidates data - using correct field names
      const job = await storage.getJobById(selection.jobId);
      console.log('📝 Job encontrado:', job);
      
      // Get candidates from the specific list
      const candidates = selection.candidateListId 
        ? await storage.getCandidatesByListId(selection.candidateListId)
        : await storage.getCandidatesByClientId(selection.clientId);
      console.log('👥 Candidatos encontrados:', candidates.length, 'candidatos');
      console.log('🔍 Debug candidatos:', candidates.map(c => ({ id: c.id, name: c.name, whatsapp: c.whatsapp })));
      
      if (!job || candidates.length === 0) {
        console.log('❌ Job ou candidatos não encontrados. Job:', !!job, 'Candidatos:', candidates.length);
        return res.status(400).json({ message: 'Job or candidates not found' });
      }

      const interviews = [];
      const baseUrl = process.env.REPL_URL || 'http://localhost:5000';

      for (const candidate of candidates) {
        // Generate unique token for each candidate
        const token = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        const interview = await storage.createInterview({
          selectionId: id,
          candidateId: candidate.id,
          token,
          status: 'pending'
        });

        // Create interview link
        const interviewLink = `${baseUrl}/interview/${token}`;

        // Get client info for template placeholders
        const client = await storage.getClientById(selection.clientId);
        const questions = await storage.getQuestionsByJobId(job.id);
        
        // Prepare messages with candidate name and interview link using correct placeholders
        let whatsappMessage = selection.whatsappTemplate || '';
        let emailMessage = selection.emailTemplate || '';
        let emailSubject = selection.emailSubject || 'Convite para Entrevista';

        // Replace all placeholders in WhatsApp message
        whatsappMessage = whatsappMessage
          .replace(/\[nome do candidato\]/g, candidate.name)
          .replace(/\[Nome do Cliente\]/g, client?.companyName || 'Nossa Empresa')
          .replace(/\[Nome da Vaga\]/g, job.nomeVaga)
          .replace(/\[número de perguntas\]/g, questions.length.toString())
          .replace(/\{nome\}/g, candidate.name)
          .replace(/\{vaga\}/g, job.nomeVaga)
          .replace(/\{link\}/g, interviewLink);

        // Replace all placeholders in email message and add interview link
        emailMessage = emailMessage
          .replace(/\[nome do candidato\]/g, candidate.name)
          .replace(/\[Nome do Cliente\]/g, client?.companyName || 'Nossa Empresa')
          .replace(/\[Nome do Colaborador da Empresa\]/g, 'Equipe de RH')
          .replace(/\[Nome da Vaga\]/g, job.nomeVaga)
          .replace(/\[número de perguntas\]/g, questions.length.toString())
          .replace(/\{nome\}/g, candidate.name)
          .replace(/\{vaga\}/g, job.nomeVaga)
          .replace(/\{link\}/g, interviewLink);

        // Add interview link to email if not already present
        if (!emailMessage.includes(interviewLink)) {
          emailMessage += `\n\nPara iniciar sua entrevista, clique no link abaixo:\n${interviewLink}`;
        }

        // Replace placeholders in email subject
        emailSubject = emailSubject
          .replace(/\{vaga\}/g, job.nomeVaga)
          .replace(/\[Nome da Vaga\]/g, job.nomeVaga);

        // Check sendVia field to determine what to send
        const shouldSendWhatsApp = selection.sendVia === 'whatsapp' || selection.sendVia === 'both';
        const shouldSendEmail = selection.sendVia === 'email' || selection.sendVia === 'both';

        // Send real emails using Resend with custom templates
        if (shouldSendEmail && candidate.email) {
          console.log('📧 Tentando enviar email para:', candidate.email);
          console.log('📧 Subject:', emailSubject);
          console.log('📧 Message preview:', emailMessage.substring(0, 100) + '...');
          console.log('📧 Interview link:', interviewLink);
          
          const { emailService } = await import('./emailService');
          
          try {
            console.log('📧 Chamando emailService.sendEmail...');
            const emailResult = await emailService.sendEmail({
              to: candidate.email,
              subject: emailSubject,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #2563eb;">${emailSubject}</h2>
                  <div style="line-height: 1.6; white-space: pre-line;">
                    ${emailMessage}
                  </div>
                  <div style="margin-top: 30px; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
                    <h3 style="color: #1f2937; margin-top: 0;">Link da Entrevista:</h3>
                    <a href="${interviewLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                      INICIAR ENTREVISTA
                    </a>
                    <p style="margin-top: 15px; font-size: 14px; color: #6b7280;">
                      Ou copie e cole este link no seu navegador:<br>
                      <span style="word-break: break-all;">${interviewLink}</span>
                    </p>
                  </div>
                  <div style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
                    Este email foi enviado automaticamente pelo Sistema de Entrevistas AI.
                  </div>
                </div>
              `,
              candidateName: candidate.name,
              jobTitle: job.nomeVaga
            });
            
            console.log('📧 Resultado do emailService:', emailResult);

            await storage.createMessageLog({
              interviewId: interview.id,
              type: 'email',
              channel: 'email',
              status: emailResult.success ? 'sent' : 'failed'
            });

            if (emailResult.success) {
              console.log(`✅ Email enviado para ${candidate.email} - Message ID: ${emailResult.messageId}`);
            } else {
              console.error(`❌ Falha ao enviar email para ${candidate.email}: ${emailResult.error}`);
            }

          } catch (error) {
            console.error('❌ Erro no serviço de email:', error);
            await storage.createMessageLog({
              interviewId: interview.id,
              type: 'email', 
              channel: 'email',
              status: 'failed'
            });
          }
        }

        // Send WhatsApp messages
        if (shouldSendWhatsApp && candidate.whatsapp) {
          try {
            // Normalizar número WhatsApp (adicionar 55 se necessário)
            let normalizedPhone = candidate.whatsapp;
            if (!normalizedPhone.startsWith('55')) {
              normalizedPhone = '55' + normalizedPhone;
            }
            
            // Verificar disponibilidade do WhatsApp service
            console.log(`🔍 Verificando WhatsApp service:`, {
              serviceExists: !!whatsappQRService,
              serviceType: typeof whatsappQRService,
              hasSendMethod: typeof whatsappQRService?.sendTextMessage
            });

            // Tentar forçar o uso do service mesmo se parecer indisponível
            let serviceToUse = whatsappQRService;
            
            if (!serviceToUse) {
              console.log(`⚠️ Service parece null, tentando reimportar...`);
              try {
                const { whatsappQRService: freshService } = await import('./whatsappQRService.js');
                serviceToUse = freshService;
                console.log(`✅ Service reimportado:`, !!serviceToUse);
              } catch (reimportError) {
                console.log(`❌ Falha ao reimportar:`, reimportError);
              }
            }

            if (!serviceToUse || typeof serviceToUse.sendTextMessage !== 'function') {
              console.log(`❌ WhatsApp service definitivamente não disponível - pulando envio para ${normalizedPhone}`);
              await storage.createMessageLog({
                interviewId: interview.id,
                type: 'whatsapp',
                channel: 'whatsapp',
                status: 'failed'
              });
              continue;
            }

            console.log(`🔍 Tentando envio WhatsApp para ${normalizedPhone} via service ativo`);
            
            // Inicializar se necessário
            try {
              await serviceToUse.ensureInitialized();
              console.log(`✅ WhatsApp service inicializado com sucesso`);
            } catch (initError) {
              console.log(`⚠️ Aviso na inicialização WhatsApp:`, initError);
            }

            // Verificar status de conectividade com validação robusta
            let connectionStatus = { isConnected: false };
            try {
              if (serviceToUse && typeof serviceToUse.getConnectionStatus === 'function') {
                connectionStatus = serviceToUse.getConnectionStatus() || { isConnected: false };
              } else {
                console.log(`⚠️ Método getConnectionStatus não disponível no service`);
              }
            } catch (statusError) {
              console.log(`⚠️ Erro ao verificar status de conexão:`, statusError.message);
            }
            console.log(`🔍 Status de conexão WhatsApp: ${JSON.stringify(connectionStatus)}`);
            
            // Tentar enviar via WhatsApp com retry
            let whatsappSuccess = false;
            let attempts = 0;
            const maxAttempts = 2;
            
            while (!whatsappSuccess && attempts < maxAttempts) {
              attempts++;
              try {
                whatsappSuccess = await serviceToUse.sendTextMessage(
                  normalizedPhone, 
                  whatsappMessage
                );
                
                if (whatsappSuccess) {
                  console.log(`✅ WhatsApp enviado para ${normalizedPhone}: ${whatsappMessage.substring(0, 50)}...`);
                  break;
                } else {
                  console.log(`⚠️ Tentativa ${attempts} falhou para ${normalizedPhone}`);
                  if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                  }
                }
              } catch (error) {
                console.error(`❌ Erro tentativa ${attempts} para ${normalizedPhone}:`, error);
                if (attempts < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                }
              }
            }
            
            await storage.createMessageLog({
              interviewId: interview.id,
              type: 'whatsapp',
              channel: 'whatsapp',
              status: whatsappSuccess ? 'sent' : 'failed'
            });
            
            if (!whatsappSuccess) {
              console.log(`❌ Todas tentativas falharam para ${normalizedPhone}`);
            }
            
          } catch (error) {
            console.error(`❌ Erro geral ao enviar WhatsApp para ${candidate.whatsapp}:`, error);
            await storage.createMessageLog({
              interviewId: interview.id,
              type: 'whatsapp',
              channel: 'whatsapp',
              status: 'failed'
            });
          }
        }

        interviews.push({
          ...interview,
          candidate,
          interviewLink
        });
      }

      // Update selection status to 'enviado'
      await storage.updateSelection(id, { status: 'enviado' });
      
      res.json({ 
        message: `Entrevistas enviadas para ${interviews.length} candidatos`,
        interviews: interviews.length
      });
    } catch (error) {
      console.error('Send interviews error:', error);
      res.status(500).json({ message: 'Falha ao enviar entrevistas' });
    }
  });

  // TTS route for OpenAI text-to-speech
  app.post("/api/tts", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: 'Text is required' });
      }

      // Get API config for OpenAI
      const apiConfig = await storage.getApiConfig();
      if (!apiConfig?.openaiApiKey) {
        return res.status(500).json({ message: 'OpenAI API key not configured' });
      }

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiConfig.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: apiConfig.openaiModel || 'tts-1',
          voice: apiConfig.openaiVoice || 'nova',
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error('OpenAI TTS request failed');
      }

      const audioBuffer = await response.arrayBuffer();
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      });
      
      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error('TTS Error:', error);
      res.status(500).json({ message: 'Failed to generate audio' });
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

      // Check if interview is already completed or expired
      if (interview.status === 'completed') {
        return res.json({
          interview,
          candidate: { name: 'Candidato', email: '' },
          selection: { nomeSelecao: 'Entrevista' },
          job: { nomeVaga: 'Vaga', descricaoVaga: '' },
          questions: []
        });
      }

      // Get selection and job details
      const selection = await storage.getSelectionById(interview.selectionId);
      const job = selection ? await storage.getJobById(selection.jobId) : null;
      const candidate = await storage.getCandidateById(interview.candidateId);
      const questions = job ? await storage.getQuestionsByJobId(job.id) : [];

      const interviewData = {
        interview,
        candidate: candidate || { name: 'Candidato', email: '' },
        selection: selection || { nomeSelecao: 'Entrevista' },
        job: job || { nomeVaga: 'Vaga', descricaoVaga: '' },
        questions: questions.sort((a, b) => a.numeroPergunta - b.numeroPergunta)
      };

      res.json(interviewData);
    } catch (error) {
      console.error('Get interview error:', error);
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
      const { questionId, duration } = req.body;
      
      const interview = await storage.getInterviewByToken(token);
      if (!interview) {
        return res.status(404).json({ message: 'Interview not found' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Audio file is required' });
      }

      // Get API config for OpenAI
      const apiConfig = await storage.getApiConfig();
      let transcription = '';
      let score = 0;
      
      if (apiConfig?.openaiApiKey) {
        try {
          // Transcribe audio using OpenAI Whisper
          const formData = new FormData();
          const audioBlob = new Blob([req.file.buffer], { type: 'audio/webm' });
          formData.append('file', audioBlob, 'audio.webm');
          formData.append('model', 'whisper-1');

          const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiConfig.openaiApiKey}`,
            },
            body: formData,
          });

          if (whisperResponse.ok) {
            const result = await whisperResponse.json();
            transcription = result.text;

            // Get the question for analysis
            const question = await storage.getQuestionsByJobId(interview.selectionId);
            const currentQuestion = question.find(q => q.id === parseInt(questionId));
            
            if (currentQuestion) {
              // Analyze response with ChatGPT
              const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiConfig.openaiApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'gpt-4o',
                  messages: [
                    {
                      role: 'system',
                      content: 'Você é um especialista em análise de entrevistas. Avalie a resposta do candidato comparando com a resposta ideal. Retorne apenas um número de 0 a 100 representando a qualidade da resposta.'
                    },
                    {
                      role: 'user',
                      content: `Pergunta: ${currentQuestion.perguntaCandidato}\n\nResposta Ideal: ${currentQuestion.respostaPerfeita}\n\nResposta do Candidato: ${transcription}\n\nAvalie a resposta (0-100):`
                    }
                  ],
                  max_tokens: 50,
                }),
              });

              if (analysisResponse.ok) {
                const analysisResult = await analysisResponse.json();
                const scoreText = analysisResult.choices[0]?.message?.content || '0';
                score = Math.max(0, Math.min(100, parseInt(scoreText.match(/\d+/)?.[0] || '0')));
              }
            }
          }
        } catch (error) {
          console.error('OpenAI API error:', error);
        }
      }

      const response = await storage.createResponse({
        interviewId: interview.id,
        questionId: parseInt(questionId),
        audioUrl: req.file ? `/uploads/${req.file.filename}` : '',
        transcription,
        score,
        aiAnalysis: { similarity: score, feedback: "Análise automática da resposta" },
        recordingDuration: parseInt(duration) || 0
      });

      res.status(201).json(response);
    } catch (error) {
      console.error('Save response error:', error);
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

  // WhatsApp Manager Routes - Client-specific connections
  app.get("/api/whatsapp/connections", authenticate, authorize(['master']), async (req, res) => {
    try {
      const { whatsappManager } = await import('./whatsappManager');
      const connections = await whatsappManager.getClientConnections();
      res.json(connections);
    } catch (error) {
      console.error('Erro ao buscar conexões WhatsApp:', error);
      res.status(500).json({ error: 'Falha ao buscar conexões' });
    }
  });

  app.post("/api/whatsapp/connect", authenticate, authorize(['master']), async (req, res) => {
    try {
      const { clientId, clientName } = req.body;
      
      if (!clientId || !clientName) {
        return res.status(400).json({ error: 'clientId e clientName são obrigatórios' });
      }

      const { whatsappManager } = await import('./whatsappManager');
      const connectionId = await whatsappManager.createConnection(clientId, clientName);
      res.json({ success: true, connectionId });
    } catch (error) {
      console.error('Erro ao criar conexão WhatsApp:', error);
      res.status(500).json({ error: 'Falha ao criar conexão' });
    }
  });

  app.post("/api/whatsapp/disconnect/:connectionId", authenticate, authorize(['master']), async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { whatsappManager } = await import('./whatsappManager');
      await whatsappManager.disconnectClient(connectionId);
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao desconectar WhatsApp:', error);
      res.status(500).json({ error: 'Falha ao desconectar' });
    }
  });

  app.delete("/api/whatsapp/connections/:connectionId", authenticate, authorize(['master']), async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { whatsappManager } = await import('./whatsappManager');
      await whatsappManager.deleteConnection(connectionId);
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao deletar conexão WhatsApp:', error);
      res.status(500).json({ error: 'Falha ao deletar conexão' });
    }
  });

  app.post("/api/whatsapp/test/:connectionId", authenticate, authorize(['master']), async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'phoneNumber e message são obrigatórios' });
      }

      const { whatsappManager } = await import('./whatsappManager');
      const success = await whatsappManager.sendMessage(connectionId, phoneNumber, message);
      
      if (success) {
        res.json({ success: true, message: 'Mensagem enviada com sucesso' });
      } else {
        res.status(500).json({ error: 'Falha ao enviar mensagem' });
      }
    } catch (error) {
      console.error('Erro ao testar conexão WhatsApp:', error);
      res.status(500).json({ error: 'Falha ao enviar mensagem de teste' });
    }
  });

  app.get("/api/whatsapp/status/:connectionId", authenticate, authorize(['master']), async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { whatsappManager } = await import('./whatsappManager');
      const status = whatsappManager.getConnectionStatus(connectionId);
      res.json(status);
    } catch (error) {
      console.error('Erro ao obter status da conexão WhatsApp:', error);
      res.status(500).json({ error: 'Falha ao obter status da conexão' });
    }
  });

  // API Configuration routes
  app.get("/api/config", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      const config = await storage.getApiConfig();
      res.json(config || {});
    } catch (error) {
      console.error('Error fetching API config:', error);
      res.status(500).json({ error: 'Failed to fetch configuration' });
    }
  });

  app.post("/api/config", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      const config = await storage.upsertApiConfig(req.body);
      res.json(config);
    } catch (error) {
      console.error('Error saving API config:', error);
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  });

  // Test OpenAI API endpoint
  app.post("/api/test-openai", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
      }

      // Test the API key with a simple request
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        res.json({ success: true, message: 'OpenAI API key is valid' });
      } else {
        res.status(400).json({ success: false, error: 'Invalid OpenAI API key' });
      }
    } catch (error) {
      console.error('Error testing OpenAI API:', error);
      res.status(500).json({ success: false, error: 'Failed to test OpenAI API' });
    }
  });

  // Get interview results for a selection
  app.get("/api/selections/:id/results", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const selectionId = parseInt(req.params.id);
      const interviews = await storage.getInterviewsBySelectionId(selectionId);
      
      const results = [];
      for (const interview of interviews) {
        const responses = await storage.getResponsesByInterviewId(interview.id);
        const candidate = await storage.getCandidateById(interview.candidateId);
        
        if (candidate) {
          results.push({
            interview,
            candidate,
            responses
          });
        }
      }
      
      res.json(results);
    } catch (error) {
      console.error('Error fetching selection results:', error);
      res.status(500).json({ error: 'Failed to fetch results' });
    }
  });

  // Upload Audio Route - Firebase Storage for demo
  app.post("/api/upload-audio", upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No audio file provided' });
      }

      // For demo purposes, we'll store the file locally and return a URL
      const audioUrl = `/uploads/${req.file.filename}`;
      
      res.json({ 
        audioUrl,
        fileName: req.file.filename,
        message: 'Audio uploaded successfully' 
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: 'Upload failed' });
    }
  });

  // Transcription Route - OpenAI Whisper for demo
  app.post("/api/transcribe", async (req, res) => {
    try {
      const { audioUrl } = req.body;
      
      if (!audioUrl) {
        return res.status(400).json({ message: 'Audio URL is required' });
      }

      const config = await storage.getApiConfig();
      if (!config?.openaiApiKey) {
        return res.status(500).json({ message: 'OpenAI API key not configured' });
      }

      // For demo, we'll simulate transcription with a placeholder
      // In production, this would download the audio and send to Whisper API
      const transcription = "Esta é uma transcrição simulada da resposta do candidato para demonstração do sistema.";
      
      res.json({ 
        transcription,
        language: 'pt',
        message: 'Transcription completed' 
      });
    } catch (error) {
      console.error('Transcription error:', error);
      res.status(500).json({ message: 'Transcription failed' });
    }
  });

  // Demo Responses Route - Save interview responses for demo
  app.post("/api/demo-responses", async (req, res) => {
    try {
      const {
        questionId,
        questionText,
        audioUrl,
        transcription,
        duration,
        candidateName,
        jobTitle
      } = req.body;

      // For demo purposes, we'll just log the response
      console.log('📝 Demo Response Saved:', {
        questionId,
        questionText,
        transcription,
        duration,
        candidateName,
        jobTitle
      });

      // Simulate saving to database
      const response = {
        id: Date.now(),
        questionId,
        questionText,
        audioUrl,
        transcription,
        duration,
        candidateName,
        jobTitle,
        savedAt: new Date()
      };

      res.json({ 
        response,
        message: 'Response saved successfully' 
      });
    } catch (error) {
      console.error('Save response error:', error);
      res.status(500).json({ message: 'Failed to save response' });
    }
  });

  // Get interview responses for reports page with client isolation
  app.get("/api/interview-responses", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      console.log(`🔍 Buscando entrevistas para relatórios - Usuário: ${req.user?.role} (ID: ${req.user?.id})`);
      
      const { collection, getDocs, query, where, doc, getDoc } = await import('firebase/firestore');
      const { firebaseDb } = await import('./storage');
      
      let allInterviews: any[] = [];
      
      // Buscar entrevistas com isolamento por cliente
      const allInterviewsSnapshot = await getDocs(collection(firebaseDb, 'interviews'));
      console.log(`📋 Total de entrevistas encontradas: ${allInterviewsSnapshot.docs.length}`);
      
      // Processar entrevistas com filtro por cliente
      for (const interviewDoc of allInterviewsSnapshot.docs) {
        const interviewData = interviewDoc.data();
        
        // Buscar candidato da entrevista para verificar o clientId
        let candidateData = null;
        try {
          if (interviewData.candidateId) {
            const candidateDoc = await getDoc(doc(firebaseDb, 'candidates', String(interviewData.candidateId)));
            if (candidateDoc.exists()) {
              candidateData = candidateDoc.data();
              
              // ISOLAMENTO POR CLIENTE: Pular se não for do cliente correto
              if (req.user?.role === 'client' && candidateData.clientId !== req.user.clientId) {
                continue; // Pular esta entrevista
              }
            }
          }
        } catch (err) {
          console.log(`⚠️ Erro ao buscar candidato ${interviewData.candidateId}:`, err);
          continue; // Pular em caso de erro
        }
        
        // Se não achou candidato ou não é do cliente, pular
        if (!candidateData) continue;
        
        // Buscar respostas da entrevista
        const responsesQuery = query(
          collection(firebaseDb, 'responses'),
          where('interviewId', '==', interviewDoc.id)
        );
        const responsesSnapshot = await getDocs(responsesQuery);
        
        const responses = responsesSnapshot.docs.map(responseDoc => {
          const responseData = responseDoc.data();
          return {
            questionId: responseData.questionId || 1,
            questionText: responseData.questionText || 'Pergunta não disponível',
            responseText: responseData.transcription || responseData.responseText || 'Sem transcrição',
            audioFile: responseData.audioUrl || responseData.audioFile || null,
            timestamp: responseData.timestamp || responseData.createdAt
          };
        });
        
        // Criar registro de entrevista para relatórios
        allInterviews.push({
          id: interviewDoc.id,
          selectionId: interviewData.selectionId || 'N/A',
          selectionName: `Entrevista ${interviewDoc.id}`,
          candidateId: interviewData.candidateId,
          candidateName: candidateData.name || 'Candidato desconhecido',
          candidatePhone: candidateData.whatsapp || candidateData.phone || 'N/A',
          candidateEmail: candidateData.email || 'N/A',
          jobName: interviewData.jobName || 'Vaga não identificada',
          status: interviewData.status || 'completed',
          startTime: interviewData.startTime || interviewData.createdAt || null,
          endTime: interviewData.endTime || interviewData.completedAt || null,
          responses: responses,
          totalQuestions: responses.length,
          answeredQuestions: responses.length,
          clientId: candidateData.clientId // Adicionar para auditoria
        });
        
        console.log(`✅ Entrevista processada: ${candidateData.name} (Cliente: ${candidateData.clientId}) - ${responses.length} respostas`);
      }
      
      console.log(`✅ Total de entrevistas processadas para usuário ${req.user?.role}: ${allInterviews.length}`);
      res.json(allInterviews);
      
    } catch (error) {
      console.error('Erro ao buscar entrevistas:', error);
      res.status(500).json({ message: 'Erro ao buscar dados das entrevistas' });
    }
  });

  // Endpoint temporário para limpeza completa de candidatos e listas
  app.post("/api/cleanup-candidates-lists", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      console.log('🧹 Iniciando limpeza completa de candidatos e listas...');
      
      const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
      const { firebaseDb } = await import('./db');
      
      let totalDeleted = 0;
      
      // 1. Deletar todos os candidate-list-memberships
      console.log('🗑️ Deletando candidate-list-memberships...');
      const membershipsSnapshot = await getDocs(collection(firebaseDb, 'candidate-list-memberships'));
      for (const membershipDoc of membershipsSnapshot.docs) {
        await deleteDoc(doc(firebaseDb, 'candidate-list-memberships', membershipDoc.id));
        totalDeleted++;
      }
      console.log(`✅ ${membershipsSnapshot.size} memberships deletados`);
      
      // 2. Deletar todos os candidatos
      console.log('🗑️ Deletando candidatos...');
      const candidatesSnapshot = await getDocs(collection(firebaseDb, 'candidates'));
      for (const candidateDoc of candidatesSnapshot.docs) {
        await deleteDoc(doc(firebaseDb, 'candidates', candidateDoc.id));
        totalDeleted++;
      }
      console.log(`✅ ${candidatesSnapshot.size} candidatos deletados`);
      
      // 3. Deletar todas as listas de candidatos
      console.log('🗑️ Deletando listas de candidatos...');
      const listsSnapshot = await getDocs(collection(firebaseDb, 'candidate-lists'));
      for (const listDoc of listsSnapshot.docs) {
        await deleteDoc(doc(firebaseDb, 'candidate-lists', listDoc.id));
        totalDeleted++;
      }
      console.log(`✅ ${listsSnapshot.size} listas deletadas`);
      
      // 4. Verificação final
      const finalCandidates = await getDocs(collection(firebaseDb, 'candidates'));
      const finalLists = await getDocs(collection(firebaseDb, 'candidate-lists'));
      const finalMemberships = await getDocs(collection(firebaseDb, 'candidate-list-memberships'));
      
      console.log(`📊 Verificação final: ${finalCandidates.size} candidatos, ${finalLists.size} listas, ${finalMemberships.size} memberships restantes`);
      
      res.json({ 
        success: true, 
        message: 'Limpeza completa concluída com sucesso',
        deleted: {
          memberships: membershipsSnapshot.size,
          candidates: candidatesSnapshot.size,
          lists: listsSnapshot.size,
          total: totalDeleted
        },
        remaining: {
          candidates: finalCandidates.size,
          lists: finalLists.size,
          memberships: finalMemberships.size
        }
      });
    } catch (error) {
      console.error('❌ Erro na limpeza:', error);
      res.status(500).json({ message: 'Erro na limpeza', error: error instanceof Error ? error.message : String(error) });
    }
  });

  // WhatsApp QR endpoints - completely optional and non-blocking
  let whatsappQRService: any = null;
  
  // NO WhatsApp initialization during server startup to prevent crashes
  console.log('📱 WhatsApp QR Service: Inicialização adiada para não bloquear servidor');
  
  // Helper function to safely initialize WhatsApp only when needed
  const ensureWhatsAppReady = async () => {
    if (!whatsappQRService) {
      try {
        // Only initialize WhatsApp when explicitly requested
        const { WhatsAppQRService } = await import('./whatsappQRService');
        whatsappQRService = new WhatsAppQRService();
        console.log('✅ WhatsApp QR Service inicializado sob demanda');
        
        // Aguardar um momento para a inicialização e carregamento de dados
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.log('⚠️ WhatsApp QR Service não disponível:', error instanceof Error ? error.message : String(error));
        whatsappQRService = null;
      }
    }
    return whatsappQRService;
  };

  app.get("/api/whatsapp-qr/status", async (req, res) => {
    try {
      const service = await ensureWhatsAppReady();
      if (!service) {
        return res.status(500).json({ 
          error: 'WhatsApp QR Service não disponível',
          isConnected: false,
          qrCode: null 
        });
      }
      
      const status = service.getConnectionStatus();
      res.json({
        isConnected: status.isConnected,
        qrCode: status.qrCode,
        phone: status.phoneNumber,
        lastConnection: status.lastConnection
      });
    } catch (error) {
      console.error('❌ Erro ao obter status WhatsApp QR:', error);
      res.status(500).json({ 
        error: 'Erro interno',
        isConnected: false,
        qrCode: null 
      });
    }
  });

  app.post("/api/whatsapp-qr/reconnect", async (req, res) => {
    try {
      if (!whatsappQRService) {
        return res.status(500).json({ error: 'WhatsApp QR Service não disponível' });
      }
      
      console.log('🔄 Iniciando reconexão WhatsApp QR via API...');
      await whatsappQRService.reconnect();
      
      res.json({ 
        success: true, 
        message: 'Processo de reconexão iniciado. Aguarde alguns segundos para o QR Code.' 
      });
    } catch (error) {
      console.error('❌ Erro na reconexão WhatsApp QR:', error);
      res.status(500).json({ 
        error: 'Falha na reconexão',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/whatsapp-qr/disconnect", async (req, res) => {
    try {
      if (!whatsappQRService) {
        return res.status(500).json({ error: 'WhatsApp QR Service não disponível' });
      }
      
      console.log('🔌 Desconectando WhatsApp QR via API...');
      await whatsappQRService.disconnect();
      
      res.json({ 
        success: true, 
        message: 'WhatsApp desconectado com sucesso' 
      });
    } catch (error) {
      console.error('❌ Erro ao desconectar WhatsApp QR:', error);
      res.status(500).json({ 
        error: 'Falha na desconexão',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/whatsapp-qr/test", async (req, res) => {
    try {
      const service = await ensureWhatsAppReady();
      if (!service) {
        return res.status(500).json({ 
          success: false,
          error: 'WhatsApp QR Service não disponível' 
        });
      }
      
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ 
          success: false,
          error: 'Telefone e mensagem são obrigatórios' 
        });
      }
      
      console.log(`🧪 Testando envio WhatsApp para ${phoneNumber}: ${message.substring(0, 50)}...`);
      
      const result = await service.sendTextMessage(phoneNumber, message);
      
      if (result) {
        res.json({ 
          success: true, 
          message: 'Mensagem de teste enviada com sucesso' 
        });
      } else {
        res.status(500).json({ 
          success: false,
          error: 'Falha ao enviar mensagem de teste' 
        });
      }
    } catch (error) {
      console.error('❌ Erro no teste WhatsApp:', error);
      res.status(500).json({ 
        success: false,
        error: 'Erro interno no teste',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // WhatsApp Manager endpoints - New system with client selection
  app.get("/api/whatsapp/connections", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { whatsappManager } = await import('./whatsappManager');
      const connections = await whatsappManager.getClientConnections();
      
      // Filter connections based on user role
      if (req.user?.role === 'client') {
        const userClientId = req.user.clientId?.toString();
        const filteredConnections = connections.filter(conn => conn.clientId === userClientId);
        return res.json(filteredConnections);
      }
      
      res.json(connections);
    } catch (error) {
      console.error('Erro ao buscar conexões WhatsApp:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  app.post("/api/whatsapp/connect", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { clientId, clientName } = req.body;
      
      if (!clientId || !clientName) {
        return res.status(400).json({ error: 'clientId e clientName são obrigatórios' });
      }

      // For client users, validate they can only connect their own client
      if (req.user?.role === 'client' && req.user.clientId?.toString() !== clientId) {
        return res.status(403).json({ error: 'Acesso negado: você só pode conectar seu próprio cliente' });
      }

      const { whatsappManager } = await import('./whatsappManager');
      const connectionId = await whatsappManager.createConnection(clientId, clientName);
      
      res.json({ success: true, connectionId });
    } catch (error) {
      console.error('Erro ao criar conexão WhatsApp:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  app.get("/api/whatsapp/status/:connectionId", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { connectionId } = req.params;
      const { whatsappManager } = await import('./whatsappManager');
      const status = whatsappManager.getConnectionStatus(connectionId);
      res.json(status);
    } catch (error) {
      console.error('Erro ao buscar status da conexão:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  app.post("/api/whatsapp/disconnect/:connectionId", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { connectionId } = req.params;
      const { whatsappManager } = await import('./whatsappManager');
      await whatsappManager.disconnectClient(connectionId);
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao desconectar WhatsApp:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  app.delete("/api/whatsapp/connection/:connectionId", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      const { connectionId } = req.params;
      const { whatsappManager } = await import('./whatsappManager');
      await whatsappManager.deleteConnection(connectionId);
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao deletar conexão:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  app.post("/api/whatsapp/send/:connectionId", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { connectionId } = req.params;
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'phoneNumber e message são obrigatórios' });
      }

      const success = await whatsappManager.sendMessage(connectionId, phoneNumber, message);
      
      res.json({ success });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // WhatsApp Manager Routes - New system for client-specific connections
  app.get("/api/whatsapp/connections", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const connections = await whatsappManager.getClientConnections();
      
      // Filter connections based on user role
      let filteredConnections = connections;
      if (req.user?.role === 'client' && req.user.clientId) {
        filteredConnections = connections.filter(conn => conn.clientId === req.user!.clientId.toString());
      }
      
      res.json(filteredConnections);
    } catch (error) {
      console.error('Error fetching WhatsApp connections:', error);
      res.status(500).json({ message: 'Failed to fetch connections' });
    }
  });

  app.post("/api/whatsapp/connect", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { clientId, clientName } = req.body;
      
      if (!clientId || !clientName) {
        return res.status(400).json({ message: 'Client ID and name are required' });
      }
      
      // For client users, ensure they can only create connections for their own client
      if (req.user?.role === 'client' && req.user.clientId?.toString() !== clientId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const connectionId = await whatsappManager.createConnection(clientId, clientName);
      res.json({ connectionId, message: 'Connection created successfully' });
    } catch (error) {
      console.error('Error creating WhatsApp connection:', error);
      res.status(500).json({ message: 'Failed to create connection' });
    }
  });

  app.get("/api/whatsapp/status/:connectionId", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { connectionId } = req.params;
      const status = whatsappManager.getConnectionStatus(connectionId);
      res.json(status);
    } catch (error) {
      console.error('Error getting WhatsApp status:', error);
      res.status(500).json({ message: 'Failed to get status' });
    }
  });

  app.post("/api/whatsapp/disconnect/:connectionId", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { connectionId } = req.params;
      await whatsappManager.disconnectClient(connectionId);
      res.json({ message: 'Connection disconnected successfully' });
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error);
      res.status(500).json({ message: 'Failed to disconnect' });
    }
  });

  app.delete("/api/whatsapp/connection/:connectionId", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      const { connectionId } = req.params;
      await whatsappManager.deleteConnection(connectionId);
      res.json({ message: 'Connection deleted successfully' });
    } catch (error) {
      console.error('Error deleting WhatsApp connection:', error);
      res.status(500).json({ message: 'Failed to delete connection' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
