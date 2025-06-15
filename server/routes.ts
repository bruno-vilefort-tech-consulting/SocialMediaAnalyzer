import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, firebaseDb } from "./storage";
import { whatsappService } from "./whatsappService";
import { whatsappQRService } from "./whatsappQRService";
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
      try {
        const client = await storage.getClientById(decoded.id);
        if (client) {
          user = {
            id: client.id,
            email: client.email,
            role: 'client',
            createdAt: client.createdAt
          };
        }
      } catch (error) {
        // Skip if ID is too large or invalid
        console.log('Cliente não encontrado para ID:', decoded.id);
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
      console.log('🔍 Buscando vagas para usuário:', req.user!.role, 'ID:', req.user!.id);
      let jobs;
      if (req.user!.role === 'master') {
        // Master pode ver todas as vagas - buscar de todos os clientes
        console.log('👑 Master buscando todas as vagas...');
        const allClients = await storage.getClients();
        console.log('📊 Clientes encontrados:', allClients.length);
        jobs = [];
        for (const client of allClients) {
          console.log(`🔍 Buscando vagas do cliente ID: ${client.id} (${client.companyName})`);
          const clientJobs = await storage.getJobsByClientId(client.id);
          console.log(`📝 Vagas encontradas para cliente ${client.id}:`, clientJobs.length);
          jobs.push(...clientJobs);
        }
      } else {
        // Cliente vê apenas suas vagas
        const clientId = req.user!.clientId!;
        console.log('👤 Cliente buscando vagas próprias, clientId:', clientId);
        jobs = await storage.getJobsByClientId(clientId);
      }
      console.log('📋 Total de vagas retornadas:', jobs.length);
      jobs.forEach(job => {
        console.log(`  - ID: ${job.id} | Nome: ${job.nomeVaga} | Cliente: ${job.clientId}`);
      });
      res.json(jobs);
    } catch (error) {
      console.error('❌ Erro detalhado na API de vagas:', error);
      res.status(500).json({ message: 'Failed to fetch jobs', error: error.message });
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
      const job = await storage.createJob(jobData);
      
      // Criar perguntas se existirem
      if (req.body.perguntas && req.body.perguntas.length > 0) {
        for (const pergunta of req.body.perguntas) {
          await storage.createQuestion({
            vagaId: job.id,
            perguntaCandidato: pergunta.pergunta,
            respostaPerfeita: pergunta.respostaPerfeita,
            numeroPergunta: pergunta.numero
          });
        }
      }
      
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
        // Master pode ver todas as seleções ou filtrar por client
        const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : null;
        if (clientId) {
          selections = await storage.getSelectionsByClientId(clientId);
        } else {
          // Para master sem filtro, buscar todas as seleções de todos os clientes
          const clients = await storage.getClients();
          for (const client of clients) {
            const clientSelections = await storage.getSelectionsByClientId(client.id);
            selections.push(...clientSelections);
          }
        }
      } else {
        // Cliente só vê suas próprias seleções
        selections = await storage.getSelectionsByClientId(req.user!.clientId!);
      }
      
      console.log(`Retornando ${selections.length} seleções para usuário ${req.user!.email}`);
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
      
      // Envio automático via WhatsApp
      if (selection.status === 'active' && selection.sendVia && (selection.sendVia === 'whatsapp' || selection.sendVia === 'both')) {
        console.log('🚀 [AUTO] Iniciando envio automático via WhatsApp');
        
        try {
          const { whatsappQRService } = await import('./whatsappQRService');
          
          // Buscar job e candidatos
          let job = await storage.getJobById(selection.jobId);
          if (!job) {
            const allJobs = await storage.getJobsByClientId(selection.clientId);
            job = allJobs.find(j => j.id.toString().startsWith(selection.jobId.toString()));
          }

          if (job) {
            const candidates = await storage.getCandidatesByListId(selection.candidateListId);
            
            if (candidates.length > 0) {
              let sentCount = 0;
              let errorCount = 0;

              console.log(`📱 [AUTO] Enviando para ${candidates.length} candidatos automaticamente`);

              for (const candidate of candidates) {
                try {
                  if (!candidate.phone) {
                    console.log(`⚠️ [AUTO] Candidato ${candidate.name} sem telefone, pulando...`);
                    errorCount++;
                    continue;
                  }

                  // Formatar telefone
                  let phone = candidate.phone.replace(/\D/g, '');
                  if (!phone.startsWith('55')) {
                    phone = '55' + phone;
                  }

                  console.log(`📨 [AUTO] Enviando para ${candidate.name} (${phone})`);
                  const success = await whatsappQRService.sendInterviewInvitation(
                    phone,
                    candidate.name,
                    job.nomeVaga,
                    selection.whatsappTemplate,
                    selection.id
                  );

                  if (success) {
                    sentCount++;
                    console.log(`✅ [AUTO] Enviado para ${candidate.name}`);
                  } else {
                    errorCount++;
                    console.log(`❌ [AUTO] Falha para ${candidate.name}`);
                  }

                  // Pequena pausa entre envios
                  await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (candidateError) {
                  console.error(`❌ [AUTO] Erro ao enviar para ${candidate.name}:`, candidateError);
                  errorCount++;
                }
              }

              console.log(`✅ [AUTO] Envio automático via WhatsApp finalizado: ${sentCount} enviados, ${errorCount} erros`);
              
              // Atualizar status da seleção para "enviado" se pelo menos 1 mensagem foi enviada
              if (sentCount > 0) {
                await storage.updateSelection(selection.id, { status: 'enviado' });
                console.log(`📊 [AUTO] Status da seleção atualizado para "enviado"`);
              }
            }
          }
        } catch (autoSendError) {
          console.error('❌ [AUTO] Erro no envio automático via WhatsApp:', autoSendError);
        }
      }
      
      // Enviar emails automaticamente se a seleção for criada como "active"
      if (selection.status === 'active' && selection.sendVia && (selection.sendVia === 'email' || selection.sendVia === 'both')) {
        console.log('🚀 INICIANDO ENVIO AUTOMÁTICO DE EMAILS - Selection ID:', selection.id);
        
        try {
          // Buscar dados necessários - implementar busca robusta
          console.log('🔍 Buscando job com ID:', selection.jobId, 'tipo:', typeof selection.jobId);
          let job = await storage.getJobById(selection.jobId);
          
          // Se não encontrou com ID exato, tentar buscar por ID parcial
          if (!job) {
            console.log('🔍 Job não encontrado com ID exato, buscando por ID parcial...');
            const allJobs = await storage.getJobsByClientId(selection.clientId);
            job = allJobs.find(j => j.id.toString().startsWith(selection.jobId.toString()));
            console.log('🔍 Job encontrado por busca parcial:', job);
          }
          
          console.log('📝 Job encontrado para envio automático:', job);
          
          // Buscar candidatos da lista específica selecionada
          let candidates = [];
          if (selection.candidateListId) {
            console.log('🎯 Buscando candidatos da lista ID:', selection.candidateListId);
            candidates = await storage.getCandidatesByListId(selection.candidateListId);
          } else {
            console.log('🎯 Nenhuma lista específica selecionada, buscando todos os candidatos do cliente');
            candidates = await storage.getCandidatesByClientId(selection.clientId);
          }
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
          const baseUrl = process.env.REPL_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
          const { emailService } = await import('./emailService');
          let emailsSent = 0;
          
          for (const candidate of candidates) {
            if (!candidate.email) {
              console.log('⚠️ Candidato sem email:', candidate.name);
              continue;
            }
            
            console.log('📧 Processando candidato:', candidate.name, candidate.email);
            
            // Gerar token único para cada candidato
            const token = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
            
            const interview = await storage.createInterview({
              selectionId: selection.id,
              candidateId: candidate.id,
              token,
              status: 'pending'
            });
            
            console.log('🎤 Entrevista criada:', interview.id, 'Token:', token);
            
            // Criar link da entrevista
            const interviewLink = `${baseUrl}/interview/${token}`;
            
            // Preparar mensagens com placeholders corretos
            let emailMessage = selection.emailTemplate || '';
            let emailSubject = selection.emailSubject || 'Convite para Entrevista';

            // Substituir placeholders
            emailMessage = emailMessage
              .replace(/\[nome do candidato\]/g, candidate.name)
              .replace(/\[Nome do Cliente\]/g, client?.companyName || 'Nossa Empresa')
              .replace(/\[Nome do Colaborador da Empresa\]/g, 'Equipe de RH')
              .replace(/\[Nome da Vaga\]/g, job.nomeVaga)
              .replace(/\[número de perguntas\]/g, questions.length.toString())
              .replace(/\{nome\}/g, candidate.name)
              .replace(/\{vaga\}/g, job.nomeVaga)
              .replace(/\{link\}/g, interviewLink);

            emailSubject = emailSubject
              .replace(/\{vaga\}/g, job.nomeVaga)
              .replace(/\[Nome da Vaga\]/g, job.nomeVaga);

            // Adicionar link da entrevista se não estiver presente
            if (!emailMessage.includes(interviewLink)) {
              emailMessage += `\n\nPara iniciar sua entrevista, clique no link abaixo:\n${interviewLink}`;
            }
            
            console.log('📧 Tentando enviar email automático para:', candidate.email);
            console.log('📧 Subject:', emailSubject);
            console.log('📧 Message preview:', emailMessage.substring(0, 100) + '...');
            console.log('📧 Interview link:', interviewLink);
            
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
            
            console.log('📧 Resultado do envio automático:', emailResult);
            
            await storage.createMessageLog({
              interviewId: interview.id,
              type: 'email',
              channel: 'email',
              status: emailResult.success ? 'sent' : 'failed'
            });
            
            if (emailResult.success) {
              emailsSent++;
              console.log(`✅ Email enviado para ${candidate.email} - Message ID: ${emailResult.messageId}`);
            } else {
              console.error(`❌ Falha ao enviar email para ${candidate.email}: ${emailResult.error}`);
            }
          }
          
          // Atualizar status da seleção para 'enviado'
          if (emailsSent > 0) {
            await storage.updateSelection(selection.id, { status: 'enviado' });
            console.log(`✅ Seleção criada e ${emailsSent} emails enviados automaticamente`);
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

  app.post("/api/selections/:id/send", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
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
      
      // For now, get all candidates for this client since we don't have candidateListId
      const candidates = await storage.getCandidatesByClientId(selection.clientId);
      console.log('👥 Candidatos encontrados:', candidates.length, 'candidatos');
      
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

        // Log WhatsApp messages (for future integration)
        if (shouldSendWhatsApp) {
          await storage.createMessageLog({
            interviewId: interview.id,
            type: 'whatsapp',
            channel: 'whatsapp',
            status: 'logged' // WhatsApp integration pending
          });
          console.log(`📱 WhatsApp message logged for ${candidate.phone}: ${whatsappMessage}`);
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

      // Usar diretamente a chave da variável de ambiente para garantir funcionamento
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (!openaiApiKey) {
        console.log('❌ OPENAI_API_KEY não encontrada nas variáveis de ambiente');
        return res.status(500).json({ message: 'OpenAI API key not configured' });
      }
      
      console.log('✅ OPENAI_API_KEY encontrada, configurando TTS...');

      console.log('🎙️ Fazendo requisição TTS para:', text.substring(0, 50) + '...');
      
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'nova',
          input: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ OpenAI TTS Error:', response.status, errorText);
        throw new Error(`OpenAI TTS request failed: ${response.status} - ${errorText}`);
      }
      
      console.log('✅ TTS request successful');

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
      console.log('🎤 API: Buscando entrevista com token:', token);
      const interview = await storage.getInterviewByToken(token);
      
      if (!interview) {
        console.log('❌ API: Entrevista não encontrada com token:', token);
        return res.status(404).json({ message: 'Interview not found' });
      }
      
      console.log('✅ API: Entrevista encontrada:', interview.id, 'status:', interview.status);

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
      let job = null;
      
      if (selection) {
        // Implementar busca robusta de job como nas outras rotas
        console.log('🔍 Buscando job no Firebase com ID:', selection.jobId);
        job = await storage.getJobById(selection.jobId);
        
        if (!job) {
          console.log('❌ Job não encontrado no Firebase com ID:', selection.jobId);
          // Buscar por ID parcial se não encontrou exato
          const allJobs = await storage.getJobsByClientId(selection.clientId);
          console.log('📋 Jobs existentes no Firebase:');
          allJobs.forEach(j => console.log('  - ID:', j.id, 'Data:', j.nomeVaga));
          
          job = allJobs.find(j => j.id.toString().includes(selection.jobId.toString()) || selection.jobId.toString().includes(j.id.toString()));
          if (job) {
            console.log('✅ Job encontrado por busca parcial:', job.id, job.nomeVaga);
          } else {
            console.log('❌ Job não encontrado nem por busca parcial');
          }
        } else {
          console.log('✅ Job encontrado diretamente:', job.id);
        }
      }
      
      const candidate = await storage.getCandidateById(interview.candidateId);
      
      // Debug: verificar se job tem perguntas internas
      console.log('🎯 Job encontrado:', job?.id, 'tem perguntas internas:', job?.perguntas?.length || 0);
      if (job?.perguntas) {
        console.log('📋 Perguntas no job:', JSON.stringify(job.perguntas, null, 2));
      }
      
      let questions = [];
      if (job) {
        // Primeiro tenta buscar perguntas do storage
        questions = await storage.getQuestionsByJobId(job.id);
        console.log('📝 Perguntas do storage:', questions.length);
        
        // Se não encontrou no storage, usa as perguntas que estão no job
        if (questions.length === 0 && job.perguntas && job.perguntas.length > 0) {
          console.log('🔄 Usando perguntas do job interno, mapeando', job.perguntas.length, 'perguntas');
          questions = job.perguntas.map((p: any, index: number) => {
            const mappedQuestion = {
              id: index + 1,
              perguntaCandidato: p.pergunta,
              numeroPergunta: p.numero,
              vagaId: job.id,
              respostaPerfeita: p.respostaPerfeita
            };
            console.log('🔄 Pergunta mapeada:', mappedQuestion);
            return mappedQuestion;
          });
          console.log('✅ Total de perguntas mapeadas:', questions.length);
        }
      }
      
      console.log('📊 Questions array final:', questions.length, 'perguntas');

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

  // Endpoint para salvar sessão completa de áudio e transcrições
  app.post("/api/interview/:token/save-session", upload.single('sessionAudio'), async (req, res) => {
    try {
      const { token } = req.params;
      const { conversationHistory, duration } = req.body;
      const audioFile = req.file;

      const interview = await storage.getInterviewByToken(token);
      if (!interview) {
        return res.status(404).json({ error: "Entrevista não encontrada" });
      }

      // Salvar log da sessão completa para análises futuras
      await storage.createMessageLog({
        interviewId: interview.id,
        type: 'session_complete',
        content: JSON.stringify({
          audioFile: audioFile?.filename,
          audioPath: audioFile?.path,
          transcript: conversationHistory,
          duration: parseInt(duration) || 0,
          totalMessages: JSON.parse(conversationHistory || '[]').length,
          savedAt: new Date().toISOString()
        }),
        timestamp: new Date()
      });

      console.log('💾 Sessão completa salva:', {
        audioFile: audioFile?.filename,
        transcriptLength: conversationHistory?.length || 0,
        duration: parseInt(duration) || 0,
        interviewId: interview.id
      });

      res.json({ success: true, message: "Sessão salva com sucesso" });
    } catch (error) {
      console.error('❌ Erro ao salvar sessão:', error);
      res.status(500).json({ error: "Erro interno do servidor" });
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
      
      console.log('🧪 Testando OpenAI API key...');
      
      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'Chave da API é obrigatória' });
      }

      if (!apiKey.startsWith('sk-')) {
        return res.status(400).json({ 
          success: false, 
          error: 'Formato de chave inválido. A chave deve começar com "sk-"' 
        });
      }

      // Test the API key with a simple request
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000 // 10 second timeout
      });

      console.log('📊 Resposta da OpenAI:', response.status, response.statusText);

      if (response.ok) {
        const models = await response.json();
        console.log('✅ OpenAI API key válida, modelos disponíveis:', models.data?.length || 0);
        
        res.json({ 
          success: true, 
          message: `Chave OpenAI válida! ${models.data?.length || 0} modelos disponíveis.`
        });
      } else {
        const errorData = await response.text();
        console.log('❌ Erro da OpenAI:', response.status, errorData);
        
        let errorMessage = 'Chave da API OpenAI inválida';
        
        try {
          const parsedError = JSON.parse(errorData);
          if (parsedError.error?.message) {
            if (parsedError.error.code === 'invalid_api_key') {
              errorMessage = 'Chave da API inválida. Verifique se foi copiada corretamente.';
            } else if (parsedError.error.code === 'insufficient_quota') {
              errorMessage = 'Quota excedida. Verifique seu plano e detalhes de faturamento na OpenAI.';
            } else {
              errorMessage = parsedError.error.message;
            }
          }
        } catch (e) {
          // Keep default error message if parsing fails
        }
        
        res.status(400).json({ 
          success: false, 
          error: errorMessage,
          details: response.status === 401 ? 'Unauthorized - verifique a chave' : `HTTP ${response.status}`
        });
      }
    } catch (error) {
      console.error('❌ Erro ao testar OpenAI API:', error);
      
      let errorMessage = 'Falha ao conectar com a OpenAI API';
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Timeout ao conectar com a OpenAI. Verifique sua conexão.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Erro de rede ao conectar com a OpenAI.';
        }
      }
      
      res.status(500).json({ 
        success: false, 
        error: errorMessage 
      });
    }
  });

  // TTS Preview endpoint - permite master e client
  app.post("/api/tts-preview", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { apiKey, voice, text } = req.body;
      
      console.log('🎵 Gerando preview TTS:', voice, 'para usuário:', req.user?.role);
      
      if (!voice || !text) {
        return res.status(400).json({ message: "Voice and text are required" });
      }

      // Para clientes, usar a chave da API configurada no sistema
      let openaiApiKey = apiKey;
      if (req.user?.role === 'client') {
        const config = await storage.getApiConfig();
        if (!config?.openaiApiKey) {
          return res.status(400).json({ 
            message: "OpenAI API not configured. Contact system administrator.",
            status: "error" 
          });
        }
        openaiApiKey = config.openaiApiKey;
      } else if (!apiKey) {
        return res.status(400).json({ message: "API key is required for master users" });
      }

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: voice,
          response_format: "mp3"
        }),
      });

      if (response.ok) {
        console.log('✅ Preview TTS gerado com sucesso');
        const audioBuffer = await response.arrayBuffer();
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
        });
        res.send(Buffer.from(audioBuffer));
      } else {
        const errorData = await response.json();
        console.log('❌ Erro TTS:', errorData);
        res.status(400).json({ 
          message: errorData.error?.message || "Failed to generate voice preview",
          status: "error" 
        });
      }
    } catch (error) {
      console.error("❌ Erro gerando preview TTS:", error);
      res.status(500).json({ 
        message: "Failed to generate voice preview",
        status: "error" 
      });
    }
  });

  // Natural TTS endpoint for interview
  app.post("/api/natural-tts", async (req, res) => {
    try {
      const { text, interviewToken } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }

      console.log('🎵 Natural TTS para entrevista:', interviewToken);
      
      const config = await storage.getApiConfig();
      if (!config?.openaiApiKey) {
        return res.status(400).json({ 
          message: "OpenAI API not configured",
          status: "error" 
        });
      }

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: config.voiceSettings?.voice || "nova",
          response_format: "mp3"
        }),
      });

      if (response.ok) {
        console.log('✅ Natural TTS gerado com sucesso');
        const audioBuffer = await response.arrayBuffer();
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
        });
        res.send(Buffer.from(audioBuffer));
      } else {
        const errorData = await response.json();
        console.log('❌ Erro Natural TTS:', errorData);
        res.status(400).json({ 
          message: errorData.error?.message || "Failed to generate speech",
          status: "error" 
        });
      }
    } catch (error) {
      console.error("❌ Erro gerando Natural TTS:", error);
      res.status(500).json({ 
        message: "Failed to generate speech",
        status: "error" 
      });
    }
  });

  // Natural conversation endpoint
  app.post("/api/natural-conversation", async (req, res) => {
    try {
      const { interviewToken, candidateResponse, currentQuestionIndex, conversationHistory, hasStarted } = req.body;
      
      console.log('🤖 Processando conversa natural:', { 
        interviewToken, 
        currentQuestionIndex,
        hasStarted,
        responseLength: candidateResponse ? candidateResponse.length : 0
      });
      
      // Buscar entrevista
      const interview = await storage.getInterviewByToken(interviewToken);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      const config = await storage.getApiConfig();
      if (!config?.openaiApiKey) {
        return res.status(400).json({ message: "OpenAI API not configured" });
      }

      // Buscar entrevista completa com dados relacionados
      const selection = await storage.getSelectionById(interview.selectionId);
      let job = null;
      let questions = [];
      
      if (selection) {
        // Buscar job com sistema robusto
        job = await storage.getJobById(selection.jobId);
        
        if (!job) {
          // Buscar por ID parcial se não encontrou exato
          const allJobs = await storage.getJobsByClientId(selection.clientId);
          job = allJobs.find(j => j.id.toString().includes(selection.jobId.toString()) || selection.jobId.toString().includes(j.id.toString()));
        }
        
        if (job) {
          // Primeiro tenta buscar perguntas do storage
          questions = await storage.getQuestionsByJobId(job.id);
          
          // Se não encontrou no storage, usa as perguntas que estão no job
          if (questions.length === 0 && job.perguntas && job.perguntas.length > 0) {
            questions = job.perguntas.map((p: any, index: number) => ({
              id: index + 1,
              perguntaCandidato: p.pergunta,
              numeroPergunta: p.numero,
              vagaId: job.id,
              respostaPerfeita: p.respostaPerfeita
            }));
          }
        }
      }
      
      // Buscar candidato
      console.log(`🔍 Buscando candidato com ID: ${interview.candidateId}`);
      const candidate = await storage.getCandidateById(interview.candidateId);
      console.log('👤 Candidato encontrado:', candidate ? { id: candidate.id, name: candidate.name } : 'Não encontrado');
      
      console.log('📋 Conversa natural - Dados:', {
        job: job?.nomeVaga,
        candidate: candidate?.name,
        questionsCount: questions.length,
        currentQuestionIndex,
        interviewCandidateId: interview.candidateId
      });
      
      // Determinar o contexto da resposta e ação apropriada
      let nextQuestionIndex = currentQuestionIndex;
      let interviewCompleted = false;
      let shouldAskNextQuestion = false;
      let isOffTopicResponse = false;

      // Se o candidato respondeu algo
      if (candidateResponse && candidateResponse.trim().length > 0) {
        console.log(`📝 Candidato disse: "${candidateResponse}"`);
        
        // Verificar se é uma resposta relacionada à pergunta atual ou conversa social
        const currentQuestion = questions[currentQuestionIndex];
        const lowerResponse = candidateResponse.toLowerCase();
        
        // Detectar apenas perguntas de volta à entrevistadora ou cumprimentos puros
        const isQuestionBack = lowerResponse.includes('e você') || 
                               lowerResponse.includes('como está') ||
                               lowerResponse.includes('como vai') ||
                               lowerResponse.includes('você está bem');
        
        // Lista restrita de respostas puramente sociais (sem informação substantiva)
        const pureSocialPhrases = ['oi', 'olá', 'tudo bem', 'boa tarde', 'bom dia', 'boa noite'];
        
        // Só considerar social se for uma frase social exata OU pergunta de volta
        const isPureSocialResponse = pureSocialPhrases.some(phrase => 
          lowerResponse.trim() === phrase
        ) || isQuestionBack;
        
        // Tratar como social apenas se for puramente social
        if (isPureSocialResponse) {
          isOffTopicResponse = true;
          console.log(`🔄 Resposta social detectada, mantendo pergunta ${currentQuestionIndex + 1}: "${currentQuestion.perguntaCandidato}"`);
        } else {
          // Resposta substancial, avançar para próxima pergunta
          nextQuestionIndex = currentQuestionIndex + 1;
          shouldAskNextQuestion = true;
          console.log(`📈 Avançando para pergunta ${nextQuestionIndex + 1}/${questions.length}`);
          
          // Se passou do total de perguntas, finalizar entrevista
          if (nextQuestionIndex >= questions.length) {
            interviewCompleted = true;
            shouldAskNextQuestion = false;
            console.log('🏁 Entrevista completa - todas as perguntas respondidas');
          } else {
            console.log(`📈 Avançando para pergunta ${nextQuestionIndex + 1}/${questions.length}`);
          }
        }
      }

      // Construir contexto da conversa
      let systemPrompt;
      
      if (interviewCompleted) {
        systemPrompt = `Responda EXATAMENTE no formato solicitado para finalizar a entrevista de ${job?.nomeVaga || 'emprego'}:

"Perfeito! Obrigada por participar da nossa entrevista para a vaga de ${job?.nomeVaga || 'emprego'}. Em breve nosso RH entrará em contato com o resultado. Tenha um ótimo dia!"

REGRAS ABSOLUTAS:
- Use EXATAMENTE essa frase
- NÃO faça perguntas adicionais
- NÃO prolongue a conversa
- A entrevista termina aqui`;
      } else if (shouldAskNextQuestion) {
        const nextQuestion = questions[nextQuestionIndex];
        systemPrompt = `Você é uma entrevistadora de RH conduzindo uma entrevista para a vaga de ${job?.nomeVaga || 'emprego'}.

INSTRUÇÕES:
- O candidato ${candidate?.name || 'Candidato'} acabou de responder: "${candidateResponse}"
- Faça um comentário positivo confirmando que entendeu (ex: "Perfeito!", "Entendi!", "Que bom!")
- Imediatamente após, faça a próxima pergunta: "${nextQuestion.perguntaCandidato}"
- Seja natural e conversacional

PRÓXIMA PERGUNTA OBRIGATÓRIA: ${nextQuestion.perguntaCandidato}

Confirme a resposta anterior e faça a próxima pergunta.`;
      } else if (isOffTopicResponse) {
        // Resposta social/cortesia - retornar ao roteiro
        const currentQuestion = questions[currentQuestionIndex];
        systemPrompt = `Você é uma entrevistadora de RH conduzindo uma entrevista para a vaga de ${job?.nomeVaga || 'emprego'}.

SITUAÇÃO:
- O candidato ${candidate?.name || 'Candidato'} fez uma resposta social: "${candidateResponse}"
- Você deve responder educadamente e retornar ao roteiro da entrevista
- A pergunta atual que precisa ser respondida é: "${currentQuestion.perguntaCandidato}"

INSTRUÇÕES:
- Responda brevemente à cortesia (ex: "Estou bem, obrigada!")
- Imediatamente retorne ao foco da entrevista
- Faça a pergunta atual: "${currentQuestion.perguntaCandidato}"

PERGUNTA ATUAL: ${currentQuestion.perguntaCandidato}

Responda à cortesia e faça a pergunta atual.`;
      } else {
        // Primeira pergunta ou pergunta inicial - verificar contexto
        const currentQuestion = questions[currentQuestionIndex];
        const isFirstCall = !hasStarted && (!candidateResponse || candidateResponse.trim().length === 0);
        
        if (isFirstCall) {
          // Verdadeiramente primeira interação - pode cumprimentar e fazer primeira pergunta
          systemPrompt = `Você é uma entrevistadora de RH conduzindo uma entrevista para a vaga de ${job?.nomeVaga || 'emprego'}.

INSTRUÇÕES:
- Seja natural, empática e profissional
- Cumprimente o candidato ${candidate?.name || 'Candidato'} pelo nome
- Faça a primeira pergunta: "${currentQuestion.perguntaCandidato}"

PRIMEIRA PERGUNTA: ${currentQuestion.perguntaCandidato}

Cumprimente pelo nome e faça a primeira pergunta.`;
        } else {
          // Entrevista já iniciada - aguardar resposta sem repetir
          systemPrompt = `Você é uma entrevistadora de RH conduzindo uma entrevista para a vaga de ${job?.nomeVaga || 'emprego'}.

SITUAÇÃO ATUAL:
- A entrevista já foi iniciada com ${candidate?.name || 'Candidato'}
- Uma pergunta já foi feita e está aguardando resposta
- O candidato disse: "${candidateResponse || 'não respondeu ainda'}"

REGRAS OBRIGATÓRIAS:
- JAMAIS repita perguntas já feitas
- Se o candidato não respondeu ainda, aguarde silenciosamente
- Se a resposta foi vaga, peça esclarecimento educadamente
- Seja paciente e natural na conversa
- Só repita uma pergunta se o candidato disser "não entendi" ou "pode repetir?"

Responda de forma natural aguardando a resposta do candidato.`;
        }
      }

      // Construir mensagens para OpenAI
      const messages = [
        { role: "system", content: systemPrompt }
      ];

      // Adicionar histórico se houver
      if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach((msg: any) => {
          messages.push({
            role: msg.type === 'ai' ? 'assistant' : 'user',
            content: msg.message
          });
        });
      }

      // Adicionar resposta do candidato se houver
      if (candidateResponse && candidateResponse.trim().length > 0) {
        messages.push({ role: "user", content: candidateResponse });
      }

      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.gptModel || "gpt-4o", // GPT-4o é muito melhor para seguir instruções contextuais
          messages,
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      const aiData = await openaiResponse.json();
      const aiResponse = aiData.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('No AI response generated');
      }

      console.log('✅ Resposta da IA gerada:', aiResponse.substring(0, 100) + '...');

      res.json({
        aiResponse,
        nextQuestionIndex,
        interviewCompleted,
        currentQuestion: questions[nextQuestionIndex]?.perguntaCandidato
      });

    } catch (error) {
      console.error("❌ Erro na conversa natural:", error);
      res.status(500).json({ 
        message: "Failed to process conversation",
        status: "error" 
      });
    }
  });

  // Save natural response
  app.post("/api/interview/:token/natural-response", async (req, res) => {
    try {
      const { token } = req.params;
      const { questionIndex, response, timestamp } = req.body;
      
      console.log('💾 Salvando resposta natural:', { token, questionIndex });
      
      const interview = await storage.getInterviewByToken(token);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      // Salvar resposta no formato natural
      const savedResponse = await storage.createResponse({
        interviewId: interview.id,
        questionId: questionIndex + 1, // Simular ID baseado no índice
        audioPath: '', // Não há arquivo de áudio na conversa natural
        transcription: response,
        score: 0, // Será calculado depois
        feedback: '',
        createdAt: new Date(timestamp),
      });

      console.log('✅ Resposta natural salva:', savedResponse.id);
      
      res.status(201).json({ id: savedResponse.id, message: "Response saved" });
      
    } catch (error) {
      console.error("❌ Erro salvando resposta natural:", error);
      res.status(500).json({ message: "Failed to save response" });
    }
  });

  // Complete natural interview
  app.post("/api/interview/:token/complete", async (req, res) => {
    try {
      const { token } = req.params;
      const { conversationHistory, completedAt } = req.body;
      
      console.log('🏁 Finalizando entrevista natural:', token);
      
      const interview = await storage.getInterviewByToken(token);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      // Atualizar status da entrevista
      await storage.updateInterview(interview.id, {
        status: 'completed',
        updatedAt: new Date(completedAt)
      });

      // Salvar log da conversa completa
      await storage.createMessageLog({
        interviewId: interview.id,
        messageType: 'conversation_history',
        content: JSON.stringify(conversationHistory),
        timestamp: new Date(completedAt)
      });

      console.log('✅ Entrevista natural finalizada');
      
      res.json({ message: "Interview completed successfully" });
      
    } catch (error) {
      console.error("❌ Erro finalizando entrevista:", error);
      res.status(500).json({ message: "Failed to complete interview" });
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

  // WhatsApp Webhook Routes
  app.get("/webhook/whatsapp", (req, res) => {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      console.log('🔍 Verificação webhook WhatsApp:', { mode, token });
      
      const verificationChallenge = whatsappService.verifyWebhook(
        mode as string,
        token as string,
        challenge as string
      );
      
      if (verificationChallenge) {
        res.status(200).send(verificationChallenge);
      } else {
        res.status(403).send('Forbidden');
      }
    } catch (error) {
      console.error('❌ Erro na verificação do webhook:', error);
      res.status(500).send('Error');
    }
  });

  app.post("/webhook/whatsapp", async (req, res) => {
    try {
      console.log('📱 Webhook WhatsApp recebido');
      await whatsappService.handleWebhook(req.body);
      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Erro no webhook WhatsApp:', error);
      res.status(500).send('Error');
    }
  });

  // WhatsApp Manual Send Route - para teste e envio manual de campanhas
  app.post("/api/whatsapp/send-campaign", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const { selectionId } = req.body;
      
      if (!selectionId) {
        return res.status(400).json({ error: "Selection ID é obrigatório" });
      }

      console.log(`📤 Iniciando envio WhatsApp para seleção ${selectionId}`);

      // Buscar seleção
      const selection = await storage.getSelectionById(selectionId);
      if (!selection) {
        return res.status(404).json({ error: "Seleção não encontrada" });
      }

      // Buscar job
      const job = await storage.getJobById(selection.jobId);
      if (!job) {
        return res.status(404).json({ error: "Vaga não encontrada" });
      }

      // Buscar candidatos da lista
      const candidates = await storage.getCandidatesByListId(selection.candidateListId);
      if (!candidates || candidates.length === 0) {
        return res.status(400).json({ error: "Nenhum candidato encontrado na lista" });
      }

      let sentCount = 0;
      let errorCount = 0;
      const results = [];

      // Enviar para cada candidato
      for (const candidate of candidates) {
        try {
          if (!candidate.phone) {
            console.log(`⚠️ Candidato ${candidate.name} sem telefone`);
            errorCount++;
            continue;
          }

          // Formatar telefone (garantir formato internacional)
          let phone = candidate.phone.replace(/\D/g, '');
          if (!phone.startsWith('55')) {
            phone = '55' + phone;
          }

          console.log(`📞 Enviando para ${candidate.name} (${phone})`);

          const success = await whatsappService.sendInterviewInvitation(
            candidate.name,
            phone,
            job.nomeVaga,
            selection.whatsappTemplate,
            selection.id
          );

          if (success) {
            sentCount++;
            results.push({
              candidateId: candidate.id,
              candidateName: candidate.name,
              phone: phone,
              status: 'sent'
            });
          } else {
            errorCount++;
            results.push({
              candidateId: candidate.id,
              candidateName: candidate.name,
              phone: phone,
              status: 'failed'
            });
          }

          // Aguardar um pouco entre envios para evitar rate limit
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`❌ Erro enviando para ${candidate.name}:`, error);
          errorCount++;
          results.push({
            candidateId: candidate.id,
            candidateName: candidate.name,
            phone: candidate.phone,
            status: 'error',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }

      // Atualizar status da seleção
      await storage.updateSelection(selection.id, {
        status: 'enviado',
        updatedAt: new Date()
      });

      console.log(`✅ Campanha WhatsApp finalizada: ${sentCount} enviados, ${errorCount} erros`);

      res.json({
        success: true,
        sentCount,
        errorCount,
        totalCandidates: candidates.length,
        results,
        message: `${sentCount} mensagens enviadas com sucesso. ${errorCount} erros.`
      });

    } catch (error) {
      console.error('❌ Erro no envio da campanha WhatsApp:', error);
      res.status(500).json({ 
        error: "Erro interno no envio da campanha",
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // WhatsApp Configuration Test Route
  app.post("/api/whatsapp/test", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: "Telefone e mensagem são obrigatórios" });
      }

      // Formatar telefone
      let phone = phoneNumber.replace(/\D/g, '');
      if (!phone.startsWith('55')) {
        phone = '55' + phone;
      }

      console.log(`🧪 Teste WhatsApp para ${phone}: ${message}`);

      const success = await whatsappService.sendTextMessage(phone, message);

      if (success) {
        res.json({ 
          success: true, 
          message: "Mensagem de teste enviada com sucesso!" 
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: "Falha ao enviar mensagem de teste" 
        });
      }

    } catch (error) {
      console.error('❌ Erro no teste WhatsApp:', error);
      res.status(500).json({ 
        error: "Erro interno no teste",
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // WhatsApp QR Code Routes
  app.get("/api/whatsapp-qr/status", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      const status = whatsappQRService.getConnectionStatus();
      res.json(status);
    } catch (error) {
      console.error('❌ Erro ao obter status WhatsApp QR:', error);
      res.status(500).json({ error: "Erro ao obter status da conexão" });
    }
  });

  app.post("/api/whatsapp-qr/disconnect", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      await whatsappQRService.disconnect();
      res.json({ success: true, message: "WhatsApp desconectado com sucesso" });
    } catch (error) {
      console.error('❌ Erro ao desconectar WhatsApp QR:', error);
      res.status(500).json({ error: "Erro ao desconectar" });
    }
  });

  app.post("/api/whatsapp-qr/reconnect", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      await whatsappQRService.reconnect();
      res.json({ success: true, message: "Reconnectando WhatsApp..." });
    } catch (error) {
      console.error('❌ Erro ao reconectar WhatsApp QR:', error);
      res.status(500).json({ error: "Erro ao reconectar" });
    }
  });

  app.post("/api/whatsapp-qr/test", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: "Telefone e mensagem são obrigatórios" });
      }

      let phone = phoneNumber.replace(/\D/g, '');
      if (!phone.startsWith('55')) {
        phone = '55' + phone;
      }

      console.log(`🧪 Teste WhatsApp QR para ${phone}: ${message}`);

      const success = await whatsappQRService.sendTextMessage(phone, message);

      if (success) {
        res.json({ 
          success: true, 
          message: "Mensagem de teste enviada com sucesso via QR" 
        });
      } else {
        res.status(500).json({ 
          error: "Falha ao enviar mensagem de teste",
          details: "Verifique se o WhatsApp está conectado via QR Code"
        });
      }

    } catch (error) {
      console.error('❌ Erro no teste WhatsApp QR:', error);
      res.status(500).json({ 
        error: "Erro interno no teste",
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Buscar entrevistas realizadas no Firebase para relatórios
  app.get("/api/interview-responses", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      console.log('🔍 Buscando entrevistas do Firebase para relatórios...');
      
      const db = firebaseDb;
      const interviewsSnapshot = await db.collection('interviews').get();
      
      console.log(`📊 Total de entrevistas encontradas: ${interviewsSnapshot.docs.length}`);
      
      const allInterviews: any[] = [];
      
      for (const interviewDoc of interviewsSnapshot.docs) {
        const interviewData = interviewDoc.data();
        
        console.log(`📝 Processando entrevista ${interviewDoc.id}:`, {
          status: interviewData.status,
          candidateName: interviewData.candidateName,
          jobName: interviewData.jobName
        });
        
        // Buscar respostas desta entrevista
        const responsesSnapshot = await db
          .collection('interview_responses')
          .where('interviewId', '==', interviewDoc.id)
          .get();
        
        const responses = responsesSnapshot.docs.map(doc => {
          const responseData = doc.data();
          return {
            questionText: responseData.questionText || '',
            responseText: responseData.responseText || '',
            audioFile: responseData.audioFile || '',
            timestamp: responseData.timestamp || new Date().toISOString()
          };
        });

        console.log(`📋 Respostas encontradas para ${interviewDoc.id}: ${responses.length}`);

        // Buscar seleção correspondente - conectar com dados reais
        let selectionData = null;
        if (interviewData.selectionId) {
          try {
            const selectionsSnapshot = await storage.getSelectionsByClientId(1749849987543); // Grupo Maximus
            selectionData = selectionsSnapshot.find(s => s.id.toString() === interviewData.selectionId.toString());
          } catch (err) {
            console.log('Erro ao buscar seleção:', err);
          }
        }

        allInterviews.push({
          id: interviewDoc.id,
          selectionId: interviewData.selectionId || null,
          selectionName: selectionData?.jobName || interviewData.jobName || 'Faxina',
          candidateId: interviewData.candidateId || null,
          candidateName: interviewData.candidateName || 'Candidato Desconhecido',
          candidatePhone: interviewData.phone || 'N/A',
          jobName: interviewData.jobName || selectionData?.jobName || 'Faxineira GM',
          status: interviewData.status || 'completed',
          startTime: interviewData.startTime,
          endTime: interviewData.endTime,
          responses,
          totalQuestions: interviewData.totalQuestions || responses.length,
          answeredQuestions: responses.length
        });
      }
      
      console.log(`✅ Retornando ${allInterviews.length} entrevistas para relatórios`);
      res.json(allInterviews);
      
    } catch (error) {
      console.error('❌ Erro ao buscar entrevistas:', error);
      res.status(500).json({ error: 'Erro ao buscar entrevistas' });
    }
  });

  app.post("/api/whatsapp-qr/send-campaign", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const { selectionId } = req.body;
      
      if (!selectionId) {
        return res.status(400).json({ error: "ID da seleção é obrigatório" });
      }

      const status = whatsappQRService.getConnectionStatus();
      if (!status.isConnected) {
        return res.status(400).json({ 
          error: "WhatsApp não está conectado",
          details: "Conecte o WhatsApp via QR Code primeiro"
        });
      }

      const selection = await storage.getSelectionById(selectionId);
      if (!selection) {
        return res.status(404).json({ error: "Seleção não encontrada" });
      }

      if (req.user?.role === 'client' && selection.clientId !== req.user.clientId) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const candidates = await storage.getCandidatesByListId(selection.candidateListId);
      
      console.log(`🔍 Buscando job no Firebase com ID: ${selection.jobId}`);
      let job = await storage.getJobById(selection.jobId);

      // Se não encontrou, buscar por ID parcial (Firebase pode ter sufixos)
      if (!job) {
        console.log(`❌ Job não encontrado com ID exato, buscando por ID parcial...`);
        const allJobs = await storage.getJobsByClientId(selection.clientId);
        job = allJobs.find(j => j.id.toString().startsWith(selection.jobId.toString()));
        
        if (job) {
          console.log(`✅ Job encontrado com ID parcial: ${job.id} -> ${job.nomeVaga}`);
        } else {
          console.log(`❌ Job não encontrado mesmo com busca parcial. Jobs disponíveis:`, 
            allJobs.map(j => `ID: ${j.id} | Nome: ${j.nomeVaga}`));
        }
      } else {
        console.log(`✅ Job encontrado: ${job.nomeVaga}`);
      }

      if (!job) {
        return res.status(404).json({ error: "Vaga não encontrada" });
      }

      let sentCount = 0;
      let errorCount = 0;
      const results = [];

      console.log(`📱 [DEBUG] Iniciando campanha WhatsApp QR para ${candidates.length} candidatos`);
      console.log(`📋 [DEBUG] Job encontrado: ${job.nomeVaga}`);
      console.log(`📞 [DEBUG] Lista de candidatos:`, candidates.map(c => ({ id: c.id, name: c.name, phone: c.phone })));

      for (const candidate of candidates) {
        try {
          console.log(`\n🚀 [DEBUG] Processando candidato: ${candidate.name} (${candidate.phone})`);
          
          if (!candidate.phone) {
            console.log(`⚠️ [DEBUG] Candidato ${candidate.name} sem telefone, pulando...`);
            errorCount++;
            results.push({
              candidateId: candidate.id,
              candidateName: candidate.name,
              phone: 'N/A',
              status: 'error',
              error: 'Telefone não informado'
            });
            continue;
          }

          // Formatar telefone
          let phone = candidate.phone.replace(/\D/g, '');
          if (!phone.startsWith('55')) {
            phone = '55' + phone;
          }
          console.log(`📞 [DEBUG] Telefone formatado: ${candidate.phone} → ${phone}`);

          console.log(`📨 [DEBUG] Enviando convite para ${candidate.name}...`);
          const success = await whatsappQRService.sendInterviewInvitation(
            phone,
            candidate.name,
            job.nomeVaga,
            selection.whatsappTemplate || selection.mensagemWhatsApp,
            selection.id
          );

          console.log(`📤 [DEBUG] Resultado do envio para ${candidate.name}: ${success ? 'SUCESSO' : 'FALHA'}`);

          if (success) {
            sentCount++;
            results.push({
              candidateId: candidate.id,
              candidateName: candidate.name,
              phone: phone,
              status: 'sent'
            });
          } else {
            errorCount++;
            results.push({
              candidateId: candidate.id,
              candidateName: candidate.name,
              phone: phone,
              status: 'error',
              error: 'Falha no envio'
            });
          }

          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          errorCount++;
          results.push({
            candidateId: candidate.id,
            candidateName: candidate.name,
            phone: candidate.phone,
            status: 'error',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }

      await storage.updateSelection(selection.id, {
        status: 'enviado',
        updatedAt: new Date()
      });

      console.log(`✅ Campanha WhatsApp QR finalizada: ${sentCount} enviados, ${errorCount} erros`);

      res.json({
        success: true,
        sentCount,
        errorCount,
        totalCandidates: candidates.length,
        results,
        message: `${sentCount} mensagens enviadas com sucesso via WhatsApp QR. ${errorCount} erros.`
      });

    } catch (error) {
      console.error('❌ Erro no envio da campanha WhatsApp QR:', error);
      res.status(500).json({ 
        error: "Erro interno no envio da campanha",
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
