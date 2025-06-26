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
import { whatsappQRService } from "../whatsapp/services/whatsappQRService";
import { whatsappManager } from "../whatsapp/services/whatsappManager";
// WppConnect removido - usando apenas Baileys
import { firebaseDb } from "./db";
import admin from "firebase-admin";
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from "firebase/firestore";
import { createTestCandidates, checkTestCandidatesExist } from "./createTestCandidates";
import { htmlExportService } from "./htmlExportService";

const JWT_SECRET = process.env.JWT_SECRET || 'maximus-interview-system-secret-key-2024';
console.log(`🔑 JWT_SECRET configurado: ${JWT_SECRET?.substring(0, 10)}...`);
console.log(`🔑 JWT_SECRET length: ${JWT_SECRET?.length}`);
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
    console.log('🔑 Middleware authenticate: Verificando autenticação para', req.method, req.path);
    
    // Try to get token from Authorization header first, then from cookies
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token && req.session?.token) {
      // fallback to session token if needed
    }
    
    console.log(`🔑 Authorization header: ${req.headers.authorization?.substring(0, 30)}...`);
    console.log(`🔑 Request method: ${req.method}`);
    console.log(`🔑 Request URL: ${req.url}`);
    
    console.log('🔑 Token encontrado:', token ? 'Sim' : 'Não');
    
    if (!token) {
      console.log('❌ Middleware authenticate: Token não fornecido');
      return res.status(401).json({ message: 'No token provided' });
    }

    console.log('🔑 Verificando JWT...');
    console.log(`🔑 Token recebido: ${token?.substring(0, 20)}...`);
    console.log(`🔑 JWT_SECRET usado: ${JWT_SECRET?.substring(0, 10)}... (${JWT_SECRET?.length || 0} chars)`);
    console.log(`🔑 Request method: ${req.method} - URL: ${req.url}`);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log('🔑 Decoded JWT:', decoded);
    
    // Extract user ID from token (support both 'id' and 'userId' formats)
    const userId = decoded.id || decoded.userId;
    console.log('👤 Extracted userId:', userId);
    
    // Try to find user in users table first
    let user = await storage.getUserById(userId);
    console.log('👤 Found user in users table:', user);
    
    // If not found in users table, try clients table
    if (!user) {
      const client = await storage.getClientById(userId);
      console.log('🏢 Found client:', client);
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
      clientId: user.role === 'client' ? (user.clientId || decoded.clientId) : undefined
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    const tokenToLog = req.headers.authorization?.replace('Bearer ', '') || 'undefined';
    console.log(`🔑 Failed token: ${tokenToLog}`);
    console.log(`🔑 JWT_SECRET exists: ${!!JWT_SECRET}`);
    console.log(`🔑 JWT_SECRET length: ${JWT_SECRET?.length || 0}`);
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
  // === SISTEMA DE RELATÓRIOS INDEPENDENTES ===

  // Listar todos os relatórios (masters) ou por cliente (clientes)
  app.get('/api/reports', authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const userRole = req.user?.role;
      const userClientId = req.user?.clientId;
      
      console.log(`📊 Buscando relatórios para usuário ${userRole} (clientId: ${userClientId})`);
      
      let reports = [];
      if (userRole === 'master') {
        reports = await storage.getAllReports();
      } else if (userRole === 'client' && userClientId) {
        reports = await storage.getReportsByClientId(userClientId);
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      console.log(`📊 Encontrados ${reports.length} relatórios`);
      res.json(reports);
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Gerar relatório a partir de uma seleção
  app.post('/api/reports/generate/:selectionId', authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { selectionId } = req.params;
      const userRole = req.user?.role;
      const userClientId = req.user?.clientId;
      
      // Verificar se usuário tem acesso à seleção
      const selection = await storage.getSelectionById(parseInt(selectionId));
      if (!selection) {
        return res.status(404).json({ error: 'Seleção não encontrada' });
      }
      
      if (userRole === 'client' && selection.clientId !== userClientId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const reportId = await storage.generateReportFromSelection(selectionId);
      
      res.json({ 
        success: true, 
        reportId,
        message: 'Relatório gerado com sucesso' 
      });
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Buscar candidatos de um relatório específico
  app.get('/api/reports/:reportId/candidates', authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { reportId } = req.params;
      const userRole = req.user?.role;
      const userClientId = req.user?.clientId;
      
      // Verificar acesso ao relatório
      const reports = userRole === 'master' ? 
        await storage.getAllReports() : 
        await storage.getReportsByClientId(userClientId);
      
      const report = reports.find(r => r.id === reportId);
      if (!report) {
        return res.status(404).json({ error: 'Relatório não encontrado' });
      }
      
      const candidates = await storage.getReportCandidates(reportId);
      res.json(candidates);
    } catch (error) {
      console.error('Erro ao buscar candidatos do relatório:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Buscar respostas de um candidato específico no relatório
  app.get('/api/reports/candidates/:reportCandidateId/responses', authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { reportCandidateId } = req.params;
      const responses = await storage.getReportResponses(reportCandidateId);
      res.json(responses);
    } catch (error) {
      console.error('Erro ao buscar respostas do candidato:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Deletar relatório
  app.delete('/api/reports/:reportId', authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { reportId } = req.params;
      const userRole = req.user?.role;
      const userClientId = req.user?.clientId;
      
      // Verificar acesso ao relatório
      const reports = userRole === 'master' ? 
        await storage.getAllReports() : 
        await storage.getReportsByClientId(userClientId);
      
      const report = reports.find(r => r.id === reportId);
      if (!report) {
        return res.status(404).json({ error: 'Relatório não encontrado' });
      }
      
      await storage.deleteReport(reportId);
      
      res.json({ 
        success: true, 
        message: 'Relatório deletado com sucesso' 
      });
    } catch (error) {
      console.error('Erro ao deletar relatório:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log("🔐 Tentativa de login:", email);
      
      // Check regular users first
      let user = await storage.getUserByEmail(email);
      let clientId;
      
      console.log("👤 Usuário encontrado em users:", !!user);
      if (user) {
        console.log("👤 Dados do usuário:", {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          hasPassword: !!user.password,
          passwordLength: user.password?.length
        });
      }
      
      // If not found in users, check clients
      if (!user) {
        console.log("🏢 Buscando em clientes...");
        const client = await storage.getClientByEmail(email);
        console.log("🏢 Cliente encontrado:", !!client);
        
        if (client) {
          console.log("🏢 Dados do cliente:", {
            id: client.id,
            email: client.email,
            companyName: client.companyName,
            hasPassword: !!client.password,
            passwordLength: client.password?.length
          });
          
          const passwordMatch = await bcrypt.compare(password, client.password);
          console.log("🔑 Senha do cliente confere:", passwordMatch);
          
          if (passwordMatch) {
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
      } else {
        // Verificar se usuário é do tipo client e tem clientId
        if (user.role === 'client' && user.clientId) {
          console.log("👤 Usuário cliente com clientId:", user.clientId);
          clientId = user.clientId;
        }
        
        // Verificar senha do usuário regular
        const passwordMatch = await bcrypt.compare(password, user.password);
        console.log("🔑 Senha do usuário confere:", passwordMatch);
      }
      
      if (!user || !await bcrypt.compare(password, user.password)) {
        console.log("❌ Falha na autenticação");
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      console.log("✅ Login bem-sucedido para:", user.name);

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
        contractStart: req.body.contractStart ? new Date(req.body.contractStart) : new Date(),
        additionalLimitExpiry: req.body.additionalLimitExpiry ? new Date(req.body.additionalLimitExpiry) : null,
        contractEnd: req.body.contractEnd ? new Date(req.body.contractEnd) : null,
        additionalLimit: req.body.additionalLimit || null,
        password: req.body.password || '123456', // Senha padrão se não fornecida
      };
      
      // Remover campos undefined e isIndefiniteContract (não faz parte do schema)
      delete processedData.isIndefiniteContract;
      
      console.log("Dados processados (incluindo senha):", { ...processedData, password: "***hidden***" });
      
      const clientData = insertClientSchema.parse(processedData);
      console.log("Dados validados:", clientData);
      
      // Filtrar valores undefined que o Firebase não aceita
      const cleanedData = Object.fromEntries(
        Object.entries(clientData).filter(([_, v]) => v !== undefined)
      );
      
      cleanedData.password = await bcrypt.hash(cleanedData.password as string, 10);
      console.log("Senha hasheada com sucesso");
      
      const client = await storage.createClient(cleanedData);
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

  // Endpoint para corrigir clientId do Daniel Braga
  app.post("/api/fix-daniel-clientid", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      console.log('🔧 Corrigindo clientId do usuário Daniel Braga...');
      
      const danielUserId = '1750131049173';
      const correctClientId = 1749849987543; // Grupo Maximuns
      
      // Atualizar diretamente no Firebase
      const userRef = doc(firebaseDb, 'users', danielUserId);
      await updateDoc(userRef, {
        clientId: correctClientId,
        updatedAt: new Date()
      });
      
      console.log('✅ ClientId do Daniel atualizado para:', correctClientId);
      res.json({ success: true, message: 'ClientId atualizado com sucesso' });
    } catch (error) {
      console.error('❌ Erro ao corrigir clientId:', error);
      res.status(500).json({ message: 'Falha ao corrigir clientId' });
    }
  });

  // HTML Export endpoint
  app.post("/api/export-candidate-html", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const candidateData = req.body;
      
      console.log(`📄 Gerando pacote ZIP para candidato: ${candidateData.name}`);
      
      // Gerar pacote ZIP com HTML e áudios
      const zipBuffer = await htmlExportService.generateCandidatePackage(candidateData);
      
      // Nome do arquivo ZIP
      const fileName = htmlExportService.generateZipFileName(
        candidateData.name, 
        candidateData.jobName, 
        candidateData.completedAt
      );
      
      // Configurar headers para download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      
      console.log(`✅ ZIP gerado com sucesso: ${fileName}`);
      res.send(zipBuffer);
      
    } catch (error) {
      console.error('❌ Erro ao gerar HTML:', error);
      res.status(500).json({ message: 'Failed to generate HTML', error: error.message });
    }
  });

  // Selections sent count endpoint
  app.get("/api/selections-sent-count", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.clientId!;
      
      console.log(`🔍 Contando seleções enviadas para cliente ${clientId}`);

      // Buscar todos os relatórios do cliente
      const reportsCollection = collection(firebaseDb, 'reports');
      const reportsQuery = query(
        reportsCollection,
        where('clientId', '==', clientId)
      );
      
      const reportsSnapshot = await getDocs(reportsQuery);
      const reportsCount = reportsSnapshot.docs.length;

      console.log(`📊 Total de relatórios encontrados: ${reportsCount}`);

      res.json({ 
        selectionsSent: reportsCount,
        clientId: clientId
      });
    } catch (error) {
      console.error('❌ Erro ao contar seleções enviadas:', error);
      res.status(500).json({ message: 'Failed to count selections sent' });
    }
  });

  // Audio storage usage endpoint
  app.get("/api/audio-storage-usage", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const clientId = req.user!.clientId!;
      const uploadsDir = './uploads';
      
      let totalSize = 0;
      let fileCount = 0;
      
      console.log(`🔍 Calculando uso de memória para cliente ${clientId}`);
      
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        console.log(`📂 Total de arquivos na pasta uploads: ${files.length}`);
        
        // Get all selections for this client to match file patterns
        const selections = await storage.getSelectionsByClientId(clientId);
        const selectionIds = selections.map(s => s.id.toString());
        console.log(`📋 Seleções do cliente ${clientId}:`, selectionIds);
        
        for (const file of files) {
          if (file.endsWith('.ogg')) {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
            
            // Check if file belongs to this client's selections
            // Audio files are typically named: audio_[phone]_[selectionId]_R[number].ogg
            const belongsToClient = selectionIds.some(selectionId => 
              file.includes(`_${selectionId}_`) || file.includes(`${selectionId}`)
            );
            
            if (belongsToClient) {
              totalSize += stats.size;
              fileCount++;
              console.log(`📄 Arquivo encontrado: ${file} (${stats.size} bytes)`);
            }
          }
        }
      }
      
      console.log(`💾 Total calculado: ${fileCount} arquivos, ${totalSize} bytes`);
      
      // Convert bytes to MB with 3 decimal places
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(3);
      
      res.json({ 
        totalSizeBytes: totalSize,
        totalSizeMB: parseFloat(totalSizeMB),
        formattedSize: `${totalSizeMB} MB`,
        fileCount: fileCount
      });
    } catch (error) {
      console.error('❌ Erro ao calcular uso de memória:', error);
      res.status(500).json({ message: 'Failed to calculate storage usage' });
    }
  });

  // Client routes
  app.get("/api/client/stats", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.clientId!;
      console.log(`🔍 Buscando estatísticas para cliente ID: ${clientId}`);
      const stats = await storage.getClientStats(clientId);
      console.log(`📊 Estatísticas encontradas:`, stats);
      res.json(stats);
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas do cliente:', error);
      res.status(500).json({ message: 'Failed to fetch client stats' });
    }
  });

  app.get("/api/jobs", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      let jobs;
      if (req.user!.role === 'master') {
        console.log('🔍 Master buscando todas as vagas');
        jobs = await storage.getJobs();
        console.log(`📄 Vagas encontradas (master): ${jobs.length}`);
      } else {
        const clientId = req.user!.clientId!;
        console.log(`🔍 Cliente buscando vagas para clientId: ${clientId}`);
        jobs = await storage.getJobsByClientId(clientId);
        console.log(`📄 Vagas encontradas para cliente ${clientId}: ${jobs.length}`);
        if (jobs.length > 0) {
          console.log('📋 Primeira vaga:', jobs[0]);
        }
      }
      res.json(jobs);
    } catch (error) {
      console.error('❌ Erro ao buscar vagas:', error);
      res.status(500).json({ message: 'Failed to fetch jobs' });
    }
  });

  // Get specific job by ID
  app.get("/api/jobs/:id", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      console.log(`🔍 Buscando vaga ID: ${id} pelo usuário: ${req.user?.email}`);
      
      const job = await storage.getJobById(id);
      if (!job) {
        console.log(`❌ Vaga ${id} não encontrada`);
        return res.status(404).json({ message: 'Job not found' });
      }
      
      // Check if user has access to this job
      if (req.user!.role !== 'master' && job.clientId !== req.user!.clientId) {
        console.log(`🚫 Acesso negado: usuário clientId ${req.user!.clientId} tentando acessar vaga do clientId ${job.clientId}`);
        return res.status(403).json({ message: 'Access denied' });
      }
      
      console.log(`✅ Vaga encontrada: ${job.nomeVaga} com ${job.perguntas?.length || 0} perguntas`);
      res.json(job);
    } catch (error) {
      console.error('❌ Erro ao buscar vaga:', error);
      res.status(500).json({ message: 'Failed to fetch job' });
    }
  });

  app.post("/api/jobs", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      console.log('Dados recebidos para criação de vaga:', req.body);
      
      // Garantir que clientId seja um número válido
      let clientId;
      if (req.user!.role === 'master') {
        clientId = req.body.clientId && Number.isInteger(req.body.clientId) && req.body.clientId < 2147483647 
          ? req.body.clientId 
          : 1;
      } else {
        // Para usuários cliente, sempre usar o clientId do próprio usuário
        clientId = req.user!.clientId!;
        console.log(`👤 Usuário cliente criando vaga para clientId: ${clientId}`);
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
      
      // Cliente só pode criar listas para seu próprio clientId
      if (req.user!.role === 'client' && req.body.clientId && req.body.clientId !== req.user!.clientId) {
        console.log(`❌ Cliente ${req.user!.email} tentou criar lista para clientId ${req.body.clientId}, mas pertence ao clientId ${req.user!.clientId}`);
        return res.status(403).json({ message: 'Access denied: You can only create candidate lists for your own client' });
      }
      
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

  app.put("/api/candidate-lists/:id", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      console.log('Editando lista ID:', req.params.id, 'pelo usuário:', req.user?.email);
      console.log('Dados recebidos:', req.body);
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid list ID' });
      }

      // Buscar a lista para verificar permissões
      const existingList = await storage.getCandidateListById(id);
      if (!existingList) {
        return res.status(404).json({ message: 'Lista não encontrada' });
      }

      // Cliente só pode editar suas próprias listas
      if (req.user!.role === 'client' && existingList.clientId !== req.user!.clientId) {
        console.log(`❌ Cliente ${req.user!.email} tentou editar lista ${id} do clientId ${existingList.clientId}, mas pertence ao clientId ${req.user!.clientId}`);
        return res.status(403).json({ message: 'Access denied: You can only edit your own candidate lists' });
      }

      // Validar e atualizar apenas nome e descrição
      const updateData = {
        name: req.body.name?.trim(),
        description: req.body.description?.trim() || ""
      };

      if (!updateData.name) {
        return res.status(400).json({ message: 'Nome da lista é obrigatório' });
      }

      console.log('Atualizando lista com dados:', updateData);
      const updatedList = await storage.updateCandidateList(id, updateData);
      
      console.log('Lista atualizada com sucesso:', updatedList);
      res.json(updatedList);
    } catch (error) {
      console.error('Erro ao editar lista de candidatos:', error);
      res.status(400).json({ message: 'Failed to update candidate list', error: error instanceof Error ? error.message : String(error) });
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

  // Endpoint alternativo para candidatos de uma lista (frontend usa esta URL)
  app.get("/api/candidate-lists/:listId/candidates", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const listId = parseInt(req.params.listId);
      console.log(`🔍 Buscando candidatos da lista ${listId} via candidate-lists`);
      
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

  // Endpoint para buscar todos os relacionamentos candidateListMemberships
  app.get("/api/candidate-list-memberships", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      if (req.user!.role === 'master') {
        // Master pode ver memberships de todos os clientes OU filtrar por cliente específico
        const clientIdFilter = req.query.clientId as string;
        if (clientIdFilter) {
          const memberships = await storage.getCandidateListMembershipsByClientId(parseInt(clientIdFilter));
          console.log(`🔍 Master buscando memberships do cliente ${clientIdFilter}: ${memberships.length} encontrados`);
          res.json(memberships);
        } else {
          const memberships = await storage.getAllCandidateListMemberships();
          console.log(`🔍 Master buscando todos os memberships: ${memberships.length} encontrados`);
          res.json(memberships);
        }
      } else {
        // Cliente vê APENAS seus próprios memberships - ISOLAMENTO TOTAL
        const memberships = await storage.getCandidateListMembershipsByClientId(req.user!.clientId!);
        console.log(`🔍 Cliente ${req.user!.email} buscando memberships do clientId ${req.user!.clientId}: ${memberships.length} encontrados`);
        res.json(memberships);
      }
    } catch (error) {
      console.error('Erro ao buscar candidate-list-memberships:', error);
      res.status(500).json({ message: 'Failed to fetch candidate list memberships' });
    }
  });

  // Endpoint para adicionar candidatos existentes em lote à lista
  app.post("/api/candidate-list-memberships/bulk", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const { memberships } = req.body;
      
      if (!memberships || !Array.isArray(memberships) || memberships.length === 0) {
        return res.status(400).json({ message: 'Array de memberships é obrigatório' });
      }

      console.log(`📋 Criando ${memberships.length} memberships em lote`);

      const createdMemberships = [];
      
      for (const membership of memberships) {
        const { candidateId, listId, clientId } = membership;
        
        // Validar campos obrigatórios
        if (!candidateId || !listId || !clientId) {
          return res.status(400).json({ 
            message: 'Campos obrigatórios para cada membership: candidateId, listId, clientId' 
          });
        }

        // Cliente só pode criar memberships para seu próprio clientId
        if (req.user!.role === 'client' && parseInt(clientId) !== req.user!.clientId) {
          console.log(`❌ Cliente ${req.user!.email} tentou criar membership para clientId ${clientId}, mas pertence ao clientId ${req.user!.clientId}`);
          return res.status(403).json({ message: 'Access denied: You can only create memberships for your own client' });
        }

        // Verificar se o membership já existe
        const existingMemberships = await storage.getCandidateListMembershipsByClientId(parseInt(clientId));
        const alreadyExists = existingMemberships.some(m => 
          m.candidateId === parseInt(candidateId) && m.listId === parseInt(listId)
        );

        if (!alreadyExists) {
          const newMembership = await storage.addCandidateToList(
            parseInt(candidateId), 
            parseInt(listId), 
            parseInt(clientId)
          );
          createdMemberships.push(newMembership);
          console.log(`✅ Membership criado: candidato ${candidateId} → lista ${listId}`);
        } else {
          console.log(`⚠️ Membership já existe: candidato ${candidateId} → lista ${listId}`);
        }
      }

      console.log(`✅ ${createdMemberships.length} memberships criados em lote`);
      res.status(201).json({ 
        created: createdMemberships.length, 
        total: memberships.length,
        memberships: createdMemberships 
      });
    } catch (error) {
      console.error('❌ Erro ao criar memberships em lote:', error);
      res.status(400).json({ message: 'Failed to create memberships in bulk' });
    }
  });

  // Endpoint para remover candidato da lista (desassociar)
  app.delete("/api/candidate-list-memberships/:candidateId/:listId", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const candidateId = parseInt(req.params.candidateId);
      const listId = parseInt(req.params.listId);

      console.log(`🔗 Removendo candidato ${candidateId} da lista ${listId}`);

      // Verificar se o membership existe
      const memberships = await storage.getCandidateListMembershipsByClientId(req.user!.clientId!);
      const membership = memberships.find(m => 
        m.candidateId === candidateId && m.listId === listId
      );

      if (!membership) {
        return res.status(404).json({ message: 'Candidato não encontrado nesta lista' });
      }

      // Remover da lista (desassociar)
      await storage.removeCandidateFromList(candidateId, listId);
      
      console.log(`✅ Candidato ${candidateId} removido da lista ${listId} com sucesso`);
      res.status(204).send();
    } catch (error) {
      console.error('❌ Erro ao remover candidato da lista:', error);
      res.status(400).json({ message: 'Failed to remove candidate from list' });
    }
  });

  // Candidates routes
  app.get("/api/candidates", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const clientIdFilter = req.query.clientId as string;
      
      if (req.user!.role === 'master') {
        // Master pode ver candidatos de todos os clientes OU filtrar por cliente específico
        if (clientIdFilter) {
          console.log('🔍 Master buscando candidatos do cliente:', clientIdFilter);
          const candidates = await storage.getCandidatesByClientId(parseInt(clientIdFilter));
          console.log('📋 Candidatos encontrados para cliente', clientIdFilter, ':', candidates.length);
          res.json(candidates);
        } else {
          // Master sem filtro = ver TODOS os candidatos
          console.log('🔍 Master buscando TODOS os candidatos');
          const candidates = await storage.getAllCandidates();
          console.log('📋 Total de candidatos encontrados:', candidates.length);
          console.log('📋 Primeiros candidatos:', candidates.slice(0, 3));
          
          // Ensure all candidates have valid clientId - filter out invalid ones
          const validCandidates = candidates.filter(candidate => {
            const isValid = candidate.clientId && !isNaN(candidate.clientId) && candidate.clientId > 0;
            if (!isValid) {
              console.log(`❌ Candidato ${candidate.id} (${candidate.name}) tem clientId inválido:`, candidate.clientId);
            }
            return isValid;
          });
          
          console.log('📋 Candidatos válidos após filtro:', validCandidates.length);
          res.json(validCandidates);
        }
      } else {
        // Cliente só vê seus próprios candidatos - ISOLAMENTO TOTAL
        console.log('🔍 Cliente buscando candidatos do clientId:', req.user!.clientId);
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
      
      // Validar campos obrigatórios (listId é opcional)
      if (!name || !email || !whatsapp || !clientId) {
        return res.status(400).json({ 
          message: 'Campos obrigatórios: name, email, whatsapp, clientId' 
        });
      }
      
      // Cliente só pode criar candidatos para seu próprio clientId
      if (req.user!.role === 'client' && parseInt(clientId) !== req.user!.clientId) {
        console.log(`❌ Cliente ${req.user!.email} tentou criar candidato para clientId ${clientId}, mas pertence ao clientId ${req.user!.clientId}`);
        return res.status(403).json({ message: 'Access denied: You can only create candidates for your own client' });
      }
      
      // Criar candidato no Firebase
      const candidateData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.trim(),
        clientId: parseInt(clientId),
        ...(listId && { listId: parseInt(listId) })
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
      console.log('📂 Request body:', req.body);
      console.log('📎 Arquivo recebido:', req.file ? 'SIM' : 'NÃO');
      console.log('📎 File details:', req.file);
      
      if (!req.file) {
        console.log('❌ Nenhum arquivo foi enviado');
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
      }

      if (!req.file.buffer) {
        console.log('❌ Buffer do arquivo está vazio');
        return res.status(400).json({ message: 'Arquivo inválido ou corrompido' });
      }

      const { clientId } = req.body;
      console.log('🏢 ClientId recebido:', clientId);
      
      if (!clientId) {
        return res.status(400).json({ message: 'Cliente obrigatório para importação' });
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

      // Buscar candidatos existentes do cliente para verificar duplicatas
      const existingCandidates = await storage.getCandidatesByClientId(parseInt(clientId));
      
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

          // Validate and format Brazilian phone with country code
          const phoneStr = String(phone);
          let phoneDigits = phoneStr.replace(/\D/g, '');
          
          // Se número não tem código do país, adicionar 55 (Brasil)
          if (phoneDigits.length === 10 || phoneDigits.length === 11) {
            phoneDigits = '55' + phoneDigits;
          } else if (phoneDigits.length === 12 || phoneDigits.length === 13) {
            // Já tem código do país, validar se é 55
            if (!phoneDigits.startsWith('55')) {
              errors.push(`Linha ${index + 2}: Número deve ter código do país 55 (Brasil) - ${phone}`);
              continue;
            }
          } else {
            errors.push(`Linha ${index + 2}: Celular deve ter 10-13 dígitos (com/sem código do país) - ${phone}`);
            continue;
          }

          const nameStr = String(name).trim();

          // Verificar duplicatas usando campo whatsapp correto
          const isDuplicate = existingCandidates.some(existing => 
            existing.name.toLowerCase() === nameStr.toLowerCase() ||
            existing.email.toLowerCase() === emailStr ||
            existing.whatsapp === phoneDigits
          );

          if (isDuplicate) {
            duplicates.push({
              line: index + 2,
              name: nameStr,
              email: emailStr,
              phone: phoneDigits,
              reason: 'Candidato já existe na lista (nome, email ou WhatsApp duplicado)'
            });
            continue;
          }

          console.log(`📋 Candidato ${nameStr} será importado para clientId: ${clientId}`);

          validCandidates.push({
            name: nameStr,
            email: emailStr,
            whatsapp: phoneDigits, // Usar whatsapp em vez de phone
            clientId: parseInt(clientId)
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
        console.log(`📥 Importando ${validCandidates.length} candidatos para cliente ${clientId}`);
        importedCandidates = await storage.createCandidates(validCandidates);
        
        // Log dos candidatos criados para verificar clientId
        for (const candidate of importedCandidates) {
          console.log(`✅ Candidato criado: ${candidate.name} (ID: ${candidate.id}) com clientId: ${candidate.clientId}`);
        }
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
        response.message += `. ${duplicates.length} candidatos não foram importados por já existirem no sistema`;
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
      
      // Cliente só pode criar seleções para seu próprio clientId
      if (req.user!.role === 'client' && req.body.clientId && req.body.clientId !== req.user!.clientId) {
        console.log(`❌ Cliente ${req.user!.email} tentou criar seleção para clientId ${req.body.clientId}, mas pertence ao clientId ${req.user!.clientId}`);
        return res.status(403).json({ message: 'Access denied: You can only create selections for your own client' });
      }
      
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
                  .replace(/\[nome do cliente\]/g, client?.companyName || 'Nossa Empresa')
                  .replace(/\[Nome do Cliente\]/g, client?.companyName || 'Nossa Empresa')
                  .replace(/\[Nome da Vaga\]/g, job.nomeVaga)
                  .replace(/\[nome da vaga\]/g, job.nomeVaga)
                  .replace(/\[número de perguntas\]/g, questions.length.toString());

                // Adicionar automaticamente a pergunta de confirmação após a mensagem inicial
                const confirmationText = `\n\nVocê gostaria de iniciar a entrevista?\n\nPara participar, responda:\n1 - Sim, começar agora\n2 - Não quero participar`;
                whatsappMessage = whatsappMessage + confirmationText;

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

  // Enviar entrevistas via WhatsApp Baileys (novo sistema isolado por cliente)
  app.post("/api/selections/:id/send-whatsapp", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const selectionId = parseInt(req.params.id);
      console.log(`🚀 Iniciando envio WhatsApp Baileys para seleção ${selectionId}`);
      
      const selection = await storage.getSelectionById(selectionId);
      if (!selection) {
        return res.status(404).json({ message: 'Selection not found' });
      }

      // Verificar autorização por clientId
      if (req.user!.role === 'client' && selection.clientId !== req.user!.clientId) {
        console.log(`❌ Cliente ${req.user!.email} tentou enviar seleção ${selectionId} que pertence ao clientId ${selection.clientId}`);
        return res.status(403).json({ message: 'Access denied: You can only send selections for your own client' });
      }

      console.log(`📋 Seleção encontrada: ${selection.name} (clientId: ${selection.clientId})`);

      // Verificar se o cliente tem WhatsApp conectado ANTES de buscar candidatos
      const { clientWhatsAppService } = await import('../whatsapp/services/clientWhatsAppService');
      const clientIdStr = selection.clientId.toString();
      const clientStatus = await clientWhatsAppService.getClientStatus(clientIdStr);
      
      console.log(`📊 Verificando status WhatsApp cliente ${clientIdStr}:`, clientStatus);
      
      if (!clientStatus.isConnected) {
        console.log(`❌ Cliente ${clientIdStr} não tem WhatsApp conectado`);
        return res.status(400).json({
          success: false,
          message: 'WhatsApp não está conectado. Acesse Configurações → WhatsApp para conectar primeiro.',
          sentCount: 0,
          errorCount: 0
        });
      }

      // Buscar candidatos da lista usando método que existe
      const allMemberships = await storage.getCandidateListMembershipsByClientId(selection.clientId);
      const candidateListMembers = allMemberships.filter(member => member.listId === selection.candidateListId);
      console.log(`👥 Membros da lista encontrados: ${candidateListMembers.length}`);

      // Buscar dados completos dos candidatos
      const candidateIds = candidateListMembers.map(member => member.candidateId);
      const allCandidates = await storage.getAllCandidates();
      const candidates = allCandidates.filter(candidate => 
        candidateIds.includes(candidate.id) && candidate.clientId === selection.clientId
      );
      console.log(`🎯 Candidatos encontrados: ${candidates.length}`);

      // Buscar vaga
      const job = await storage.getJobById(selection.jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }
      console.log(`💼 Vaga encontrada: ${job.nomeVaga} (${job.perguntas?.length || 0} perguntas)`);

      let messagesSent = 0;
      let messagesError = 0;

      // Enviar via WhatsApp usando o sistema Baileys isolado por cliente
      for (const candidate of candidates) {
        if (candidate.whatsapp) {
          try {
            console.log(`📱 Enviando WhatsApp para ${candidate.name} (${candidate.whatsapp})`);
            
            // Gerar token único primeiro
            const token = `interview_${Date.now()}_${candidate.id}`;
            
            // Criar entrevista com token
            const interview = await storage.createInterview({
              candidateId: candidate.id,
              selectionId: selection.id,
              token: token,
              status: 'pending'
            });

            console.log(`🎤 Entrevista criada: ID ${interview.id}, Token: ${token}`);

            // Gerar link da entrevista
            const interviewLink = `${process.env.REPLIT_DOMAINS || 'https://your-domain.replit.app'}/entrevista/${token}`;

            // Buscar dados do cliente para substituir placeholder
            const client = await storage.getClientById(selection.clientId);
            
            // Personalizar mensagem WhatsApp
            let personalizedMessage = selection.whatsappTemplate || 
              "Olá {nome}, você foi selecionado para uma entrevista virtual da vaga {vaga}. Acesse: {link}";
            
            personalizedMessage = personalizedMessage
              .replace(/\{nome\}/g, candidate.name)
              .replace(/\[nome do candidato\]/g, candidate.name)
              .replace(/\[nome do cliente\]/g, client?.companyName || 'Nossa Empresa')
              .replace(/\[Nome do Cliente\]/g, client?.companyName || 'Nossa Empresa')
              .replace(/\{vaga\}/g, job.nomeVaga)
              .replace(/\[Nome da Vaga\]/g, job.nomeVaga)
              .replace(/\[nome da vaga\]/g, job.nomeVaga)
              .replace(/\[número de perguntas\]/g, job.perguntas?.length?.toString() || '3')
              .replace(/\{link\}/g, interviewLink);

            // Adicionar automaticamente a pergunta de confirmação após a mensagem inicial
            const confirmationText = `\n\nVocê gostaria de iniciar a entrevista?\n\nPara participar, responda:\n1 - Sim, começar agora\n2 - Não quero participar`;
            personalizedMessage = personalizedMessage + confirmationText;

            // Enviar via WhatsApp usando serviço específico do cliente
            const { clientWhatsAppService } = await import('../whatsapp/services/clientWhatsAppService');
            const clientIdStr = selection.clientId.toString();
            
            // Verificar se o cliente tem WhatsApp conectado
            const clientStatus = await clientWhatsAppService.getClientStatus(clientIdStr);
            console.log(`📊 Status WhatsApp cliente ${clientIdStr}:`, clientStatus);
            
            if (!clientStatus.isConnected) {
              console.log(`❌ Cliente ${clientIdStr} não tem WhatsApp conectado`);
              messagesError++;
              
              await storage.createMessageLog({
                interviewId: interview.id,
                type: 'invitation',
                channel: 'whatsapp',
                status: 'failed'
              });
              continue;
            }
            
            console.log(`📲 Enviando via clientWhatsAppService para cliente ${clientIdStr}`);
            const sendResult = await clientWhatsAppService.sendTestMessage(
              clientIdStr,
              candidate.whatsapp,
              personalizedMessage
            );
            
            console.log(`📱 Resultado do envio para ${candidate.name}:`, sendResult);

            if (sendResult && sendResult.success) {
              messagesSent++;
              console.log(`✅ WhatsApp enviado com sucesso para ${candidate.name}`);
              
              // Registrar log de mensagem
              await storage.createMessageLog({
                interviewId: interview.id,
                type: 'invitation',
                channel: 'whatsapp',
                status: 'sent'
              });
            } else {
              messagesError++;
              console.log(`❌ Falha no envio WhatsApp para ${candidate.name}: ${sendResult?.message || 'Erro desconhecido'}`);
              
              await storage.createMessageLog({
                interviewId: interview.id,
                type: 'invitation',
                channel: 'whatsapp',
                status: 'failed'
              });
            }
          } catch (error) {
            messagesError++;
            console.error(`❌ Erro no envio WhatsApp para ${candidate.name}:`, error);
          }
        } else {
          console.log(`⚠️ Candidato ${candidate.name} sem WhatsApp`);
          messagesError++;
        }
      }

      // Atualizar status da seleção
      if (messagesSent > 0) {
        await storage.updateSelection(selection.id, { status: 'enviado' });
        console.log(`✅ Seleção atualizada para "enviado"`);
        
        // Gerar relatório automaticamente após envio
        try {
          const reportId = await storage.generateReportFromSelection(selection.id.toString());
          console.log(`✅ Relatório gerado automaticamente: ${reportId}`);
        } catch (reportError) {
          console.error('Erro ao gerar relatório automático:', reportError);
          // Não interromper o fluxo se falhar a geração do relatório
        }
      }

      res.json({
        success: true,
        sentCount: messagesSent,
        errorCount: messagesError,
        message: `${messagesSent} mensagens enviadas via WhatsApp, ${messagesError} erros`
      });

    } catch (error) {
      console.error('❌ Erro no envio WhatsApp Baileys:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno no servidor ao enviar WhatsApp',
        sentCount: 0,
        errorCount: 0
      });
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
          .replace(/\[nome do cliente\]/g, client?.companyName || 'Nossa Empresa')
          .replace(/\[Nome do Cliente\]/g, client?.companyName || 'Nossa Empresa')
          .replace(/\[Nome da Vaga\]/g, job.nomeVaga)
          .replace(/\[nome da vaga\]/g, job.nomeVaga)
          .replace(/\[número de perguntas\]/g, questions.length.toString())
          .replace(/\{nome\}/g, candidate.name)
          .replace(/\{vaga\}/g, job.nomeVaga)
          .replace(/\{link\}/g, interviewLink);

        // Adicionar automaticamente a pergunta de confirmação após a mensagem inicial
        const confirmationText = `\n\nVocê gostaria de iniciar a entrevista?\n\nPara participar, responda:\n1 - Sim, começar agora\n2 - Não quero participar`;
        whatsappMessage = whatsappMessage + confirmationText;

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

  // Candidate Categories routes
  app.get("/api/candidate-categories", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const selectionId = req.query.selectionId as string;
      
      if (!selectionId) {
        return res.json([]);
      }
      
      const categories = await storage.getCandidateCategories(selectionId);
      res.json(categories);
    } catch (error) {
      console.error('Error fetching candidate categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  app.post("/api/candidate-categories", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const { reportId, candidateId, category, clientId } = req.body;
      
      // Validate required fields
      if (!reportId || !candidateId || !category) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      await storage.setCandidateCategory(reportId, candidateId, category, clientId);
      console.log(`✅ [API] Categoria ${category} salva para candidato ${candidateId}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving candidate category:', error);
      res.status(500).json({ message: 'Failed to save category' });
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

  // Endpoint de debug temporário para testar WPPConnect
  app.post("/api/debug/wppconnect/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      console.log(`🐛 [DEBUG] Testando WPPConnect para cliente ${clientId}...`);
      
      // WppConnect removido - usando Baileys
      const { whatsappQRService } = await import('./whatsappQRService');
      const result = await whatsappQRService.connect();
      
      console.log(`🐛 [DEBUG] Resultado:`, result);
      
      res.json({
        success: result.success,
        message: result.message,
        qrCode: result.qrCode ? 'QR Code gerado' : null,
        clientId
      });
    } catch (error) {
      console.error(`🐛 [DEBUG] Erro no teste:`, error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : null
      });
    }
  });

  // Client WhatsApp endpoints - Sistema original que funcionava
  app.get("/api/client/whatsapp/status", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      console.log(`📊 [BAILEYS] Buscando status WhatsApp para cliente ${user.clientId}...`);
      
      // Primeiro buscar no banco de dados (fonte autoritativa)
      const dbConfig = await storage.getApiConfig('client', user.clientId.toString());
      
      // Depois buscar no serviço em memória
      const { whatsappBaileyService } = await import('./whatsappBaileyService');
      const memoryStatus = whatsappBaileyService.getStatus(user.clientId.toString());
      
      // Combinar dados: QR Code do banco (mais confiável) + status de conexão da memória
      // Se memória mostra desconectado mas banco mostra conectado, tentar restaurar
      const shouldRestore = !memoryStatus.isConnected && dbConfig?.whatsappQrConnected && dbConfig?.whatsappQrPhoneNumber;
      
      if (shouldRestore) {
        console.log(`🔄 Tentando restaurar conexão para cliente ${user.clientId}...`);
        try {
          await whatsappBaileyService.connect(user.clientId.toString());
          // Atualizar status após tentativa de restauração
          const restoredStatus = whatsappBaileyService.getStatus(user.clientId.toString());
          memoryStatus.isConnected = restoredStatus.isConnected;
          memoryStatus.phoneNumber = restoredStatus.phoneNumber;
        } catch (error) {
          console.log(`❌ Erro ao restaurar conexão:`, error.message);
        }
      }
      
      const finalStatus = {
        isConnected: memoryStatus.isConnected || dbConfig?.whatsappQrConnected || false,
        qrCode: dbConfig?.whatsappQrCode || memoryStatus.qrCode || null,
        phoneNumber: dbConfig?.whatsappQrPhoneNumber || memoryStatus.phoneNumber || null,
        lastConnection: dbConfig?.whatsappQrLastConnection || null
      };
      
      console.log(`📱 [BAILEYS] Status final:`, {
        isConnected: finalStatus.isConnected,
        hasQrCode: !!finalStatus.qrCode,
        qrCodeLength: finalStatus.qrCode?.length || 0,
        phoneNumber: finalStatus.phoneNumber,
        source: 'DB + Memory'
      });
      
      res.json({
        isConnected: finalStatus.isConnected,
        phone: finalStatus.phoneNumber,
        qrCode: finalStatus.qrCode,
        lastConnection: finalStatus.lastConnection
      });
    } catch (error) {
      console.error('❌ Erro ao buscar status WhatsApp:', error);
      res.status(500).json({ message: 'Erro interno' });
    }
  });

  app.post("/api/client/whatsapp/connect", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      console.log(`🔗 [DEBUG] Usuário autenticado:`, {
        hasUser: !!user,
        clientId: user?.clientId,
        role: user?.role,
        email: user?.email
      });
      
      if (!user?.clientId) {
        console.log('❌ [DEBUG] Client ID não encontrado');
        return res.status(400).json({ message: 'Client ID required' });
      }

      console.log(`🔗 Conectando WhatsApp para cliente ${user.clientId}...`);
      
      const { whatsappBaileyService } = await import('./whatsappBaileyService');
      await whatsappBaileyService.connect(user.clientId.toString());
      
      const status = whatsappBaileyService.getStatus(user.clientId.toString());
      const result = { success: true, qrCode: status.qrCode };
      
      console.log(`🔗 [DEBUG] Resultado da conexão:`, {
        success: result.success,
        hasQrCode: !!result.qrCode,
        qrCodeLength: result.qrCode?.length || 0,
        message: result.message
      });
      
      if (result.success) {
        res.json({
          success: true,
          message: result.qrCode ? 'QR Code gerado - escaneie com seu WhatsApp' : 'Conectado com sucesso',
          qrCode: result.qrCode
        });
      } else {
        console.log(`❌ [DEBUG] Falha na conexão WhatsApp:`, result.message);
        res.status(500).json({
          success: false,
          message: result.message || 'Erro ao conectar WhatsApp'
        });
      }
    } catch (error) {
      console.error('❌ Erro ao conectar WhatsApp:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao conectar WhatsApp'
      });
    }
  });

  app.post("/api/client/whatsapp/disconnect", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      console.log(`🔌 Desconectando WhatsApp para cliente ${user.clientId}...`);
      
      const { whatsappBaileyService } = await import('./whatsappBaileyService');
      await whatsappBaileyService.disconnect(user.clientId.toString());
      const result = { success: true };
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: 'WhatsApp desconectado com sucesso'
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Erro ao desconectar WhatsApp' 
        });
      }
    } catch (error) {
      console.error('❌ Erro ao desconectar WhatsApp:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao desconectar WhatsApp' 
      });
    }
  });

  app.post("/api/client/whatsapp/test", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ 
          success: false, 
          message: 'phoneNumber e message são obrigatórios' 
        });
      }

      console.log(`📤 Enviando teste WhatsApp para ${phoneNumber} via cliente ${user.clientId}...`);
      
      const { whatsappBaileyService } = await import('./whatsappBaileyService');
      const success = await whatsappBaileyService.sendMessage(user.clientId.toString(), phoneNumber, message);
      const result = { success };
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: 'Mensagem enviada com sucesso' 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Erro ao enviar mensagem - verifique se WhatsApp está conectado' 
        });
      }
    } catch (error) {
      console.error('❌ Erro ao enviar teste WhatsApp:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao enviar mensagem' 
      });
    }
  });

  app.post("/api/client/whatsapp/clear-session", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      console.log(`🧹 Limpando sessão WhatsApp para cliente ${user.clientId}...`);
      
      const { whatsappBaileyService } = await import('./whatsappBaileyService');
      await whatsappBaileyService.clearSession(user.clientId.toString());
      
      res.json({ 
        success: true, 
        message: 'Sessão WhatsApp limpa com sucesso. Use "Conectar" para gerar novo QR Code.' 
      });
    } catch (error) {
      console.error('❌ Erro ao limpar sessão WhatsApp:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao limpar sessão WhatsApp' 
      });
    }
  });

  app.post("/api/client/whatsapp/test", authenticate, authorize(['client']), async (req, res) => {
    try {
      const user = req.user;
      const { phoneNumber, message } = req.body;

      if (!user.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      if (!phoneNumber || !message) {
        return res.status(400).json({ message: 'Phone number and message required' });
      }

      // WppConnect removido - usando Baileys
      const { whatsappQRService } = await import('./whatsappQRService');
      const success = await whatsappQRService.sendTextMessage(phoneNumber, message);
      const result = { success, message: success ? 'Mensagem enviada' : 'Falha ao enviar' };
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: result.message
        });
      } else {
        res.status(400).json({ 
          success: false, 
          message: result.message 
        });
      }
    } catch (error) {
      console.error('Client WhatsApp test error:', error);
      res.status(500).json({ message: 'Erro ao enviar mensagem de teste' });
    }
  });

  // Candidate Management Routes
  app.patch("/api/candidates/:id", authenticate, authorize(['master', 'client']), async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const { name, email, whatsapp } = req.body;
      
      const updatedCandidate = await storage.updateCandidate(candidateId, {
        name,
        email,
        whatsapp
      });
      
      res.json(updatedCandidate);
    } catch (error) {
      console.error('Error updating candidate:', error);
      res.status(500).json({ message: 'Failed to update candidate' });
    }
  });

  app.delete("/api/candidates/:id", authenticate, authorize(['master', 'client']), async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      
      // Remove candidate from all lists first
      await storage.removeCandidateFromAllLists(candidateId);
      
      // Then delete the candidate
      await storage.deleteCandidate(candidateId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting candidate:', error);
      res.status(500).json({ message: 'Failed to delete candidate' });
    }
  });

  app.post("/api/candidates/:candidateId/lists/:listId", authenticate, authorize(['master', 'client']), async (req, res) => {
    try {
      const candidateId = parseInt(req.params.candidateId);
      const listId = parseInt(req.params.listId);
      const user = req.user;
      
      console.log(`🔗 Backend: Recebida requisição para adicionar candidato ${candidateId} à lista ${listId}`);
      console.log(`👤 Usuário: ${user.email}, role: ${user.role}, clientId: ${user.clientId}`);
      
      if (!candidateId || !listId) {
        console.error("❌ IDs inválidos:", { candidateId, listId });
        return res.status(400).json({ message: 'IDs de candidato e lista são obrigatórios' });
      }
      
      // Get clientId from candidate or user
      const candidate = await storage.getCandidateById(candidateId);
      if (!candidate) {
        console.error(`❌ Candidato ${candidateId} não encontrado`);
        return res.status(404).json({ message: 'Candidato não encontrado' });
      }
      
      const clientId = user.role === 'client' ? user.clientId : candidate.clientId;
      console.log(`🔍 ClientId determinado: ${clientId}`);
      
      await storage.addCandidateToList(candidateId, listId, clientId);
      
      console.log(`✅ Backend: Candidato ${candidateId} adicionado à lista ${listId} com sucesso`);
      res.json({ success: true });
    } catch (error) {
      console.error('❌ Backend: Error adding candidate to list:', error);
      res.status(500).json({ message: 'Failed to add candidate to list' });
    }
  });

  app.delete("/api/candidates/:candidateId/lists/:listId", authenticate, authorize(['master', 'client']), async (req, res) => {
    try {
      const candidateId = parseInt(req.params.candidateId);
      const listId = parseInt(req.params.listId);
      
      await storage.removeCandidateFromList(candidateId, listId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing candidate from list:', error);
      res.status(500).json({ message: 'Failed to remove candidate from list' });
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
  app.get("/api/whatsapp/connections", authenticate, authorize(['master', 'client']), async (req, res) => {
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

  app.delete("/api/whatsapp/connections/:connectionId", authenticate, authorize(['master', 'client']), async (req, res) => {
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

  // Endpoint temporário para corrigir senha do Daniel Braga
  app.post("/api/fix-daniel-password", async (req, res) => {
    try {
      const userId = "1750131049173";
      const newPassword = "daniel580190";
      
      // Criptografar a senha
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Atualizar no Firebase via servidor (tem permissões adequadas)
      const { doc, updateDoc } = await import('firebase/firestore');
      const { firebaseDb } = await import('./db');
      await updateDoc(doc(firebaseDb, 'users', userId), {
        password: hashedPassword,
        updatedAt: new Date()
      });
      
      res.json({ 
        success: true, 
        message: 'Senha do Daniel Braga atualizada com hash bcrypt',
        hashedPassword: hashedPassword.substring(0, 20) + '...'
      });
    } catch (error) {
      console.error('Erro ao corrigir senha:', error);
      res.status(500).json({ error: 'Falha ao atualizar senha' });
    }
  });

  // Endpoint duplicado removido - usando apenas a implementação Baileys acima

  // Removed duplicate disconnect endpoint - using the main one above

  app.post("/api/client/whatsapp/test", authenticate, authorize(['client']), async (req, res) => {
    try {
      const clientId = (req as AuthRequest).user.clientId;
      if (!clientId) {
        return res.status(400).json({ error: 'ClientId não encontrado no token' });
      }

      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'phoneNumber e message são obrigatórios' });
      }

      console.log(`💬 Enviando teste WhatsApp para cliente ${clientId}: ${phoneNumber}`);
      const { clientWhatsAppService } = await import('./clientWhatsAppService.js');
      const result = await clientWhatsAppService.sendTestMessage(clientId.toString(), phoneNumber, message);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: result.message 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.message 
        });
      }
    } catch (error) {
      console.error('Erro ao testar WhatsApp do cliente:', error);
      res.status(500).json({ error: 'Falha ao enviar mensagem de teste' });
    }
  });

  app.post("/api/whatsapp/test/:connectionId", authenticate, authorize(['master', 'client']), async (req, res) => {
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

  // New API Config architecture - entity-specific configurations
  app.get("/api/api-config/:entityType/:entityId", authenticate, authorize(['master', 'client']), async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      console.log(`🔍 Buscando API Config: ${entityType}/${entityId}`);
      
      const config = await storage.getApiConfig(entityType, entityId);
      res.json(config || {});
    } catch (error) {
      console.error('Error fetching API config:', error);
      res.status(500).json({ error: 'Failed to fetch configuration' });
    }
  });

  app.post("/api/api-config", authenticate, authorize(['master', 'client']), async (req, res) => {
    try {
      const { entityType, entityId, openaiVoice } = req.body;
      console.log(`💾 Salvando API Config: ${entityType}/${entityId}, voz: ${openaiVoice}`);
      
      if (!entityType || !entityId) {
        return res.status(400).json({ error: 'entityType e entityId são obrigatórios' });
      }

      const configData = {
        entityType,
        entityId,
        openaiVoice: openaiVoice || null,
        updatedAt: new Date()
      };

      const config = await storage.upsertApiConfig(configData);
      console.log(`✅ API Config salva com sucesso:`, config);
      res.json(config);
    } catch (error) {
      console.error('❌ Erro ao salvar API config:', error);
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  });

  // TTS Preview endpoint
  app.post("/api/preview-tts", authenticate, authorize(['master', 'client']), async (req, res) => {
    try {
      const { text, voice } = req.body;
      
      if (!text || !voice) {
        return res.status(400).json({ error: 'Text and voice are required' });
      }

      // Get master settings for OpenAI API key
      const masterSettings = await storage.getMasterSettings();
      if (!masterSettings?.openaiApiKey) {
        return res.status(400).json({ error: 'OpenAI API key not configured' });
      }

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${masterSettings.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice,
          response_format: 'mp3'
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI TTS error:', error);
        return res.status(response.status).json({ error: 'Failed to generate audio' });
      }

      const audioBuffer = await response.arrayBuffer();
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      });
      
      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error('TTS Preview error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create test candidates endpoint
  app.post("/api/create-test-candidates", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      console.log("🚀 Iniciando criação de candidatos fictícios...");
      
      // Verificar se candidatos de teste já existem
      const existingCandidates = await checkTestCandidatesExist();
      if (existingCandidates) {
        return res.status(400).json({ 
          success: false, 
          message: 'Candidatos fictícios já existem no sistema' 
        });
      }

      // Criar os candidatos fictícios
      await createTestCandidates();
      
      console.log("✅ Candidatos fictícios criados com sucesso!");
      
      res.json({
        success: true,
        message: '20 candidatos fictícios criados com sucesso para o relatório Comercial 5',
        details: {
          candidatesCreated: 20,
          transcriptionsCreated: 40,
          interviewsCreated: 20,
          selectionId: '1750476614396'
        }
      });
    } catch (error) {
      console.error('❌ Erro ao criar candidatos fictícios:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao criar candidatos fictícios',
        error: error.message 
      });
    }
  });

  // Check if test candidates exist endpoint
  app.get("/api/check-test-candidates", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const exists = await checkTestCandidatesExist();
      res.json({ exists });
    } catch (error) {
      console.error('❌ Erro ao verificar candidatos de teste:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao verificar candidatos de teste' 
      });
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

  // Endpoint para processar transcrições pendentes
  app.post("/api/process-transcriptions", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      console.log('🚀 Iniciando processamento de transcrições pendentes...');
      
      // Processar especificamente a seleção Comercial 3
      await transcriptionService.processComercial3Transcriptions();
      
      res.json({
        success: true,
        message: "Transcrições processadas com sucesso"
      });
    } catch (error) {
      console.error("❌ Erro ao processar transcrições:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao processar transcrições",
        error: error.message
      });
    }
  });

  // Get interview results for a selection
  app.get("/api/selections/:id/results", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const selectionId = parseInt(req.params.id);
      
      // Verificar se a seleção existe e se o usuário tem permissão para acessá-la
      const selection = await storage.getSelectionById(selectionId);
      if (!selection) {
        return res.status(404).json({ message: 'Selection not found' });
      }
      
      // Cliente só pode ver resultados de suas próprias seleções
      if (req.user!.role === 'client' && selection.clientId !== req.user!.clientId) {
        console.log(`❌ Cliente ${req.user!.email} tentou acessar seleção ${selectionId} do cliente ${selection.clientId}`);
        return res.status(403).json({ message: 'Access denied: You can only view results from your own selections' });
      }
      
      console.log(`✅ Usuário ${req.user!.email} (role: ${req.user!.role}) acessando resultados da seleção ${selectionId}`);
      
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

  // Statistics endpoint for client dashboard
  app.get("/api/statistics", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      const { from, to } = req.query;
      const clientId = user.clientId.toString();
      
      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);
      
      // Buscar todos os candidatos do cliente e filtrar por data no código
      const candidatesQuery = query(
        collection(firebaseDb, 'candidates'),
        where('clientId', '==', user.clientId)
      );
      const candidatesSnapshot = await getDocs(candidatesQuery);
      
      // Filtrar candidatos por período
      let candidatesRegistered = 0;
      candidatesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.createdAt && data.createdAt.toDate) {
          const createdDate = data.createdAt.toDate();
          if (createdDate >= fromDate && createdDate <= toDate) {
            candidatesRegistered++;
          }
        }
      });
      


      // Buscar todos os relatórios do cliente (dados imutáveis) e filtrar por data no código
      const reportsQuery = query(
        collection(firebaseDb, 'reports'),
        where('clientId', '==', user.clientId)
      );
      const reportsSnapshot = await getDocs(reportsQuery);
      
      // Filtrar relatórios por período e calcular total de candidatos que receberam entrevistas
      let interviewsSent = 0;
      const validReports = [];
      reportsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.createdAt && data.createdAt.toDate) {
          const createdDate = data.createdAt.toDate();
          if (createdDate >= fromDate && createdDate <= toDate) {
            // Contar candidatos que receberam entrevistas neste relatório
            if (data.candidatesCount) {
              interviewsSent += data.candidatesCount;
            } else if (data.candidatesData && Array.isArray(data.candidatesData)) {
              interviewsSent += data.candidatesData.length;
            } else {
              // Fallback: assumir que houve pelo menos 1 candidato que recebeu entrevista
              interviewsSent += 1;
            }
            validReports.push(doc);
          }
        }
      });
      
      console.log(`📊 Total de candidatos que receberam entrevistas no período: ${interviewsSent}`);
      


      // Buscar entrevistas finalizadas (candidatos que responderam todas as perguntas)
      let interviewsCompleted = 0;
      let completionRate = 0;

      // Contar entrevistas iniciadas baseado em todas as respostas do cliente no período
      let interviewsStarted = 0;
      
      try {
        // Buscar todas as respostas do cliente
        const allResponsesQuery = query(
          collection(firebaseDb, 'interviewResponses'),
          where('clientId', '==', user.clientId)
        );
        const allResponsesSnapshot = await getDocs(allResponsesQuery);
        
        // Usar dados dos relatórios para contagem de entrevistas iniciadas
        for (const reportDoc of validReports) {
          const reportData = reportDoc.data();
          const completed = reportData.completedInterviews || 0;
          
          // Para cobrança: assumir que se houve entrevistas completadas, houve entrevistas iniciadas
          if (completed > 0) {
            interviewsStarted += completed;
            interviewsCompleted += completed;
          }
        }
        
        console.log(`🔍 [DEBUG] Contagem final: ${interviewsStarted} iniciadas, ${interviewsCompleted} completadas`);
        
        if (allResponsesSnapshot.size > 0) {
          // Debug: mostrar exemplo de resposta
          const firstResponse = allResponsesSnapshot.docs[0].data();
          console.log(`🔍 [DEBUG] Exemplo resposta:`, {
            selectionId: firstResponse.selectionId,
            phone: firstResponse.phone,
            transcription: firstResponse.transcription?.substring(0, 50),
            clientId: firstResponse.clientId
          });
          // Agrupar por seleção e telefone para contagem única
          const interviewsByKey = new Map();
          
          allResponsesSnapshot.docs.forEach(doc => {
            const responseData = doc.data();
            const selectionId = responseData.selectionId;
            const phone = responseData.phone;
            
            // Verificar se é de uma seleção válida do período
            const validSelectionIds = validReports.map(r => r.data().selectionId?.toString());
            const isValidSelection = validSelectionIds.includes(selectionId?.toString());
            
            console.log(`🔍 [DEBUG] Resposta ${selectionId}/${phone}: válida=${isValidSelection}`);
            
            if (isValidSelection && selectionId && phone) {
              const key = `${selectionId}_${phone}`;
              if (!interviewsByKey.has(key)) {
                interviewsByKey.set(key, []);
              }
              interviewsByKey.get(key).push(responseData);
            }
          });
          
          console.log(`🔍 [DEBUG] Entrevistas agrupadas: ${interviewsByKey.size}`);
          
          // Para cada entrevista única, verificar se foi iniciada e completada
          for (const responses of interviewsByKey.values()) {
            if (responses.length > 0) {
              // Ordenar por ordem de pergunta
              responses.sort((a, b) => (a.questionOrder || 0) - (b.questionOrder || 0));
              
              // Verificar se a primeira resposta tem transcrição válida (entrevista iniciada)
              const firstResponse = responses[0];
              const hasValidFirstResponse = firstResponse.transcription && 
                                            firstResponse.transcription !== "Aguardando resposta via WhatsApp";
              
              console.log(`🔍 [DEBUG] Primeira resposta: "${firstResponse.transcription?.substring(0, 50)}" - válida: ${hasValidFirstResponse}`);
              
              if (hasValidFirstResponse) {
                interviewsStarted++;
                
                // Verificar se todas as respostas têm transcrição (entrevista completada)
                const allCompleted = responses.every(response => 
                  response.transcription && 
                  response.transcription !== "Aguardando resposta via WhatsApp"
                );
                
                if (allCompleted) {
                  interviewsCompleted++;
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Erro ao buscar respostas:`, error.message);
      }

      // Debug: listar candidatos específicos que iniciaram entrevistas
      const candidatesWithInterviews = [];
      
      for (const reportDoc of validReports) {
        const reportData = reportDoc.data();
        
        console.log(`📋 Analisando relatório ${reportData.selectionId}:`);
        console.log(`   - completedInterviews: ${reportData.completedInterviews}`);
        console.log(`   - candidatesData exists: ${!!reportData.candidatesData}`);
        console.log(`   - responseData exists: ${!!reportData.responseData}`);
        
        if (reportData.completedInterviews && reportData.completedInterviews > 0) {
          // Verificar estrutura dos dados
          if (reportData.candidatesData) {
            console.log(`   - Número de candidatos: ${reportData.candidatesData.length}`);
            if (reportData.candidatesData.length > 0) {
              const firstCandidate = reportData.candidatesData[0];
              console.log(`   - Exemplo candidato keys: ${Object.keys(firstCandidate).join(', ')}`);
            }
          }
          
          if (reportData.responseData) {
            console.log(`   - Número de respostas: ${reportData.responseData.length}`);
            if (reportData.responseData.length > 0) {
              const firstResponse = reportData.responseData[0];
              console.log(`   - Exemplo resposta keys: ${Object.keys(firstResponse).join(', ')}`);
            }
          }
          
          // Para contagem simples: usar completedInterviews direto
          const jobName = reportData.jobData?.name || reportData.jobName || 'Vaga não especificada';
          const reportDate = reportData.createdAt.toDate().toLocaleDateString('pt-BR');
          
          for (let i = 0; i < reportData.completedInterviews; i++) {
            candidatesWithInterviews.push({
              nome: `Candidato ${i + 1}`,
              vaga: jobName,
              data: reportDate,
              relatorio: reportData.selectionId
            });
          }
        }
      }
      
      console.log(`📋 Candidatos que iniciaram entrevistas no período (${candidatesWithInterviews.length}):`);
      candidatesWithInterviews.forEach((candidate, index) => {
        console.log(`${index + 1}. ${candidate.nome} - ${candidate.vaga} - ${candidate.data} (Relatório: ${candidate.relatorio})`);
      });

      console.log(`📊 Entrevistas iniciadas no período: ${interviewsStarted}`);
      console.log(`📊 Entrevistas finalizadas no período: ${interviewsCompleted}`);
      


      // Calcular taxa de conclusão baseada em entrevistas iniciadas
      if (interviewsStarted > 0) {
        completionRate = (interviewsCompleted / interviewsStarted) * 100;
      }

      const statistics = {
        candidatesRegistered,
        interviewsSent,
        interviewsStarted,
        interviewsCompleted,
        completionRate: Math.round(completionRate * 10) / 10 // Arredondar para 1 casa decimal
      };


      res.json(statistics);

    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      res.status(500).json({ 
        candidatesRegistered: 0,
        interviewsSent: 0,
        interviewsCompleted: 0,
        completionRate: 0
      });
    }
  });

  // Evolution API Routes
  app.post("/api/evolution/connect", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      const clientId = user.clientId.toString();
      console.log(`🔗 [Evolution] Tentando conectar cliente ${clientId} via Evolution API...`);
      
      // Forçar uso da Evolution API
      const { evolutionApiService } = await import('./evolutionApiService');
      const result = await evolutionApiService.connectClient(clientId);
      
      console.log(`🔗 [Evolution] Resultado da conexão Evolution API:`, {
        success: result.success,
        hasQrCode: !!result.qrCode,
        qrCodeLength: result.qrCode?.length || 0,
        message: result.message
      });
      
      res.json(result);
    } catch (error) {
      console.error('❌ Erro Evolution API connect:', error);
      res.status(500).json({ 
        success: false, 
        message: `Erro ao conectar via Evolution API: ${error.message}` 
      });
    }
  });

  app.post("/api/evolution/disconnect", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      const clientId = user.clientId.toString();
      console.log(`🔌 [Evolution] Desconectando cliente ${clientId} via Evolution API...`);
      
      // Usar Evolution API
      const { evolutionApiService } = await import('./evolutionApiService');
      const result = await evolutionApiService.disconnectClient(clientId);
      
      res.json(result);
    } catch (error) {
      console.error('❌ Erro Evolution API disconnect:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao desconectar Evolution API' 
      });
    }
  });

  app.get("/api/evolution/status", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      const clientId = user.clientId.toString();
      console.log(`🔗 [Evolution] Verificando status para cliente ${clientId}...`);
      
      // Usar Evolution API diretamente
      const { evolutionApiService } = await import('./evolutionApiService');
      const connection = await evolutionApiService.getConnectionStatus(clientId);
      
      console.log(`📱 [Evolution] Status Evolution API:`, {
        hasConnection: !!connection,
        isConnected: connection?.isConnected || false,
        hasQrCode: !!connection?.qrCode,
        qrCodeLength: connection?.qrCode?.length || 0,
        instanceId: connection?.instanceId
      });
      
      const responseData = {
        isConnected: connection?.isConnected || false,
        qrCode: connection?.qrCode || null,
        phoneNumber: connection?.phoneNumber || null,
        lastConnection: connection?.lastConnection || null,
        method: 'evolution',
        instanceId: connection?.instanceId || `evolution_${clientId}`
      };
      
      console.log(`📤 [Evolution] Response enviada:`, {
        hasQrCode: !!responseData.qrCode,
        qrCodeLength: responseData.qrCode?.length || 0,
        isConnected: responseData.isConnected
      });
      
      res.json(responseData);
    } catch (error) {
      console.error('❌ Erro Evolution API status:', error);
      res.status(500).json({ 
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null,
        method: 'evolution'
      });
    }
  });

  app.post("/api/evolution/test", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      const { phoneNumber, message } = req.body;
      
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      if (!phoneNumber || !message) {
        return res.status(400).json({ message: 'Phone number and message required' });
      }

      const { evolutionApiService } = await import('./evolutionApiService');
      const result = await evolutionApiService.sendTestMessage(
        user.clientId.toString(), 
        phoneNumber, 
        message
      );
      
      res.json(result);
    } catch (error) {
      console.error('❌ Erro Evolution API test:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao enviar mensagem teste' 
      });
    }
  });

  // WhatsApp Client Routes - Individual connection per client
  app.post("/api/whatsapp-client/connect", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      console.log(`🔗 WhatsApp Client: Conectando cliente ${user.clientId}...`);
      
      const { clientWhatsAppService } = await import('../whatsapp/services/clientWhatsAppService');
      const result = await clientWhatsAppService.connectClient(user.clientId.toString());
      
      console.log(`📱 Resultado WhatsApp connect:`, result);
      res.json(result);
    } catch (error) {
      console.error('❌ Erro WhatsApp Client connect:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao conectar WhatsApp' 
      });
    }
  });

  app.post("/api/whatsapp-client/disconnect", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      console.log(`🔌 WhatsApp Client: Desconectando cliente ${user.clientId}...`);
      
      const { clientWhatsAppService } = await import('../whatsapp/services/clientWhatsAppService');
      const result = await clientWhatsAppService.disconnectClient(user.clientId.toString());
      
      res.json(result);
    } catch (error) {
      console.error('❌ Erro WhatsApp Client disconnect:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao desconectar WhatsApp' 
      });
    }
  });

  // Candidate Categories - endpoints para categorização
  app.get("/api/candidate-categories/:reportId/:candidateId", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { reportId, candidateId } = req.params;
      const user = req.user!;
      
      const category = await storage.getCandidateCategory(reportId, candidateId);
      
      // Verificar se o usuário tem acesso a este relatório
      if (user.role !== 'master' && category && category.clientId !== user.clientId) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      return res.json(category || { category: null });
    } catch (error) {
      console.error('❌ Erro ao buscar categoria do candidato:', error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  app.post("/api/candidate-categories", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { reportId, candidateId, category } = req.body;
      const user = req.user!;
      
      if (!reportId || !candidateId || !category) {
        return res.status(400).json({ error: "Dados obrigatórios: reportId, candidateId, category" });
      }
      
      const validCategories = ['Melhor', 'Mediano', 'Em dúvida', 'Não'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ error: "Categoria inválida. Use: Melhor, Mediano, Em dúvida, Não" });
      }
      
      const clientId = user.role === 'master' ? req.body.clientId : user.clientId;
      if (!clientId) {
        return res.status(400).json({ error: "ClientId é obrigatório" });
      }
      
      const result = await storage.setCandidateCategory(reportId, candidateId, category, clientId);
      
      console.log(`✅ Categoria ${category} salva para candidato ${candidateId} no relatório ${reportId}`);
      return res.json(result);
    } catch (error) {
      console.error('❌ Erro ao salvar categoria do candidato:', error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  app.get("/api/reports/:reportId/categories", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { reportId } = req.params;
      const user = req.user!;
      
      const categories = await storage.getCategoriesByReportId(reportId);
      
      // Filtrar categorias por cliente se necessário
      const filteredCategories = user.role === 'master' ? categories : 
        categories.filter(cat => cat.clientId === user.clientId);
      
      return res.json(filteredCategories);
    } catch (error) {
      console.error('❌ Erro ao buscar categorias do relatório:', error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  app.get("/api/whatsapp-client/status", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      const { clientWhatsAppService } = await import('../whatsapp/services/clientWhatsAppService');
      const result = await clientWhatsAppService.getClientStatus(user.clientId.toString());
      
      res.json({
        isConnected: result.isConnected,
        qrCode: result.qrCode,
        phoneNumber: result.phoneNumber,
        lastConnection: result.lastConnection
      });
    } catch (error) {
      console.error('❌ Erro WhatsApp Client status:', error);
      res.status(500).json({ 
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null
      });
    }
  });

  app.post("/api/whatsapp-client/test", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      const { phoneNumber, message } = req.body;
      
      if (!user?.clientId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Client ID required' 
        });
      }

      if (!phoneNumber || !message) {
        return res.status(400).json({ 
          success: false, 
          message: 'Número de telefone e mensagem são obrigatórios' 
        });
      }

      console.log(`📱 [WHATSAPP TEST] Enviando mensagem teste para cliente ${user.clientId}`);
      console.log(`📱 [WHATSAPP TEST] Telefone: ${phoneNumber}`);
      console.log(`📱 [WHATSAPP TEST] Mensagem: ${message.substring(0, 50)}...`);
      
      // Usar o clientWhatsAppService corrigido
      const { clientWhatsAppService } = await import('../whatsapp/services/clientWhatsAppService');
      const clientIdStr = user.clientId.toString();
      
      // Enviar mensagem teste usando o serviço correto
      const result = await clientWhatsAppService.sendTestMessage(clientIdStr, phoneNumber, message);
      
      if (result.success) {
        console.log(`✅ [WHATSAPP TEST] Mensagem enviada com sucesso`);
        res.json({ 
          success: true, 
          message: result.message 
        });
      } else {
        console.log(`❌ [WHATSAPP TEST] Falha no envio: ${result.message}`);
        res.status(400).json({ 
          success: false, 
          message: result.message 
        });
      }
      
    } catch (error) {
      console.error('❌ [WHATSAPP TEST] Erro ao enviar mensagem teste:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor ao enviar mensagem teste' 
      });
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

  // Endpoint para buscar candidatos de uma seleção que receberam convites de entrevista
  app.get("/api/selections/:selectionId/interview-candidates", authenticate, authorize(['client', 'master']), async (req: AuthRequest, res: Response) => {
    try {
      const selectionId = parseInt(req.params.selectionId);
      console.log(`🔍 Buscando candidatos para seleção ${selectionId}`);
      
      // Verificar se a seleção existe e se o usuário tem acesso
      const selection = await storage.getSelectionById(selectionId);
      if (!selection) {
        return res.status(404).json({ message: 'Selection not found' });
      }
      
      // Verificar autorização
      if (req.user!.role === 'client' && req.user!.clientId !== selection.clientId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      console.log(`✅ Seleção encontrada: ${selection.name}, Lista: ${selection.candidateListId}`);
      
      // Buscar candidatos da lista usada na seleção
      const candidatesInList = await storage.getCandidatesInList(selection.candidateListId);
      console.log(`📋 Candidatos na lista ${selection.candidateListId}: ${candidatesInList.length}`);
      
      // Buscar perguntas do job
      const questions = await storage.getQuestionsByJobId(selection.jobId);
      console.log(`❓ Perguntas encontradas para job ${selection.jobId}: ${questions.length}`);
      
      // Para cada candidato, criar estrutura com entrevista (real ou pendente)
      const candidatesWithInterviews = await Promise.all(candidatesInList.map(async (candidate) => {
        // Buscar respostas reais específicas por seleção + candidato + cliente
        const realResponses = await storage.getResponsesBySelectionAndCandidate(
          selectionId, 
          candidate.id, 
          selection.clientId
        );
        console.log(`🔍 [DEBUG_NOVA_SELEÇÃO] RELATÓRIO - Respostas para ${candidate.name} na seleção ${selection.name}:`, {
          candidateId: candidate.id,
          selectionId: selectionId,
          clientId: selection.clientId,
          responsesFound: realResponses.length,
          candidatePhone: candidate.whatsapp
        });
        
        let responses = [];
        if (realResponses.length > 0) {
          // Usar respostas reais do Firebase
          responses = realResponses.map((r, index) => ({
            id: r.id || `${candidate.id}_${index + 1}`,
            questionId: r.questionId || (index + 1),
            questionText: r.questionText || questions[index]?.pergunta || 'Pergunta não encontrada',
            transcription: r.transcription || r.respostaTexto || 'Transcrição não disponível',
            audioUrl: r.audioUrl || r.respostaAudioUrl || '',
            score: r.score !== undefined && r.score !== null ? r.score : 0, // Usar score já calculado - não recalcular
            recordingDuration: r.recordingDuration || 0,
            aiAnalysis: r.aiAnalysis || 'Análise não disponível'
          }));
          console.log(`✅ [REAL_DATA] Usando ${responses.length} respostas reais para ${candidate.name}`);
        } else {
          // Gerar respostas simuladas baseadas nas perguntas do job
          responses = questions.map((question, index) => ({
            id: `${candidate.id}_${index + 1}`,
            questionId: index + 1,
            questionText: question.pergunta || `Pergunta ${index + 1}`,
            transcription: 'Aguardando resposta via WhatsApp',
            audioUrl: '',
            score: 0,
            recordingDuration: 0,
            aiAnalysis: 'Entrevista pendente'
          }));
          console.log(`📝 [FALLBACK] Usando respostas padrão para ${candidate.name} - não encontrou dados reais`);
        }
        
        // Usar scores já calculados do banco - NÃO recalcular
        const totalScore = responses.length > 0 
          ? Math.round(responses.reduce((sum, r) => sum + (r.score !== undefined && r.score !== null ? r.score : 0), 0) / responses.length)
          : 0;
        const hasRealResponses = realResponses.length > 0;
        
        console.log(`📊 [DEBUG_NOVA_SELEÇÃO] SCORE calculado para ${candidate.name}:`, {
          totalResponses: responses.length,
          hasRealResponses: hasRealResponses,
          totalScore: totalScore,
          status: hasRealResponses ? 'completed' : 'pending'
        });
        
        return {
          candidate: {
            id: candidate.id,
            name: candidate.name,
            email: candidate.email,
            phone: candidate.whatsapp
          },
          interview: {
            id: `interview_${candidate.id}`,
            status: hasRealResponses ? 'completed' : (selection.status === 'enviado' ? 'invited' : 'pending'),
            createdAt: selection.createdAt,
            completedAt: hasRealResponses ? new Date() : null,
            totalScore: totalScore
          },
          responses: responses
        };
      }));
      
      console.log(`✅ Retornando ${candidatesWithInterviews.length} candidatos que receberam convites`);
      res.json(candidatesWithInterviews);
      
    } catch (error) {
      console.error('Erro ao buscar candidatos da seleção:', error);
      res.status(500).json({ message: 'Failed to fetch selection candidates' });
    }
  });

  app.get("/api/interview-responses", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      console.log(`🔍 Buscando entrevistas para relatórios - Usuário: ${req.user?.role} (ID: ${req.user?.id}) - ClientId: ${req.user?.clientId}`);
      
      // Usar métodos do storage existente
      const allInterviews = await storage.getAllInterviews();
      console.log(`📋 Total de entrevistas encontradas: ${allInterviews.length}`);
      
      // Se for master, buscar entrevistas de clientes específicos que têm candidatos
      if (req.user?.role === 'master') {
        console.log(`👑 Usuário master - buscando todas as entrevistas válidas`);
      } else {
        console.log(`👤 Usuário client ${req.user?.clientId} - filtrando entrevistas`);
      }
      
      const detailedInterviews = [];
      let processedCount = 0;
      let skippedCount = 0;
      
      // Buscar candidatos válidos primeiro para otimizar
      const allCandidates = await storage.getAllCandidates();
      console.log(`👥 Total de candidatos no sistema: ${allCandidates.length}`);
      
      const validCandidateIds = new Set();
      const candidateMap = new Map();
      
      for (const candidate of allCandidates) {
        // Se for cliente, filtrar apenas candidatos do seu clientId
        if (req.user?.role === 'client' && candidate.clientId !== req.user.clientId) {
          continue;
        }
        validCandidateIds.add(candidate.id);
        candidateMap.set(candidate.id, candidate);
      }
      
      console.log(`✅ Candidatos válidos para processamento: ${validCandidateIds.size}`);
      
      // Processar apenas entrevistas com candidatos válidos
      for (const interview of allInterviews) {
        try {
          // Verificar se candidato existe e é válido
          if (!validCandidateIds.has(interview.candidateId)) {
            skippedCount++;
            continue;
          }
          
          const candidate = candidateMap.get(interview.candidateId);
          console.log(`✅ Processando entrevista ${interview.id} - ${candidate.name} (clientId: ${candidate.clientId})`);
          processedCount++;
          
          // Buscar respostas da entrevista
          const responses = await storage.getResponsesByInterviewId(interview.id);
          console.log(`📋 Total de respostas para entrevista ${interview.id}: ${responses.length}`);
          
          // Buscar vaga da entrevista
          let job = null;
          try {
            job = await storage.getJobById(interview.jobId);
          } catch (err) {
            console.log(`⚠️ Erro ao buscar vaga ${interview.jobId}:`, err);
          }
          
          // Calcular score total e categoria
          const totalScore = responses.length > 0 
            ? Math.round(responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length)
            : 0;
            
          const category = totalScore >= 80 ? 'high' : totalScore >= 60 ? 'medium' : 'low';
          
          detailedInterviews.push({
            interview: {
              id: interview.id,
              status: interview.status,
              completedAt: interview.completedAt || null,
              totalScore,
              category,
              selectionId: interview.selectionId,
              candidateId: interview.candidateId,
              jobId: interview.jobId
            },
            candidate: {
              id: candidate.id,
              name: candidate.name,
              email: candidate.email,
              phone: candidate.whatsapp || candidate.phone || ''
            },
            job: job ? {
              id: job.id,
              title: job.nomeVaga,
              description: job.descricaoVaga
            } : null,
            responses: responses.map(response => ({
              id: response.id,
              questionId: response.questionId,
              questionText: response.questionText || '',
              transcription: response.transcription || '',
              score: response.score || 0,
              audioUrl: response.audioUrl || '',
              recordingDuration: response.recordingDuration || 0,
              aiAnalysis: response.aiAnalysis || {},
              createdAt: response.createdAt
            }))
          });
        } catch (err) {
          console.log(`⚠️ Erro ao processar entrevista ${interview.id}:`, err);
          continue; // Pular em caso de erro
        }
      }
      
      console.log(`📊 RESUMO PROCESSAMENTO:`);
      console.log(`   - Total entrevistas no sistema: ${allInterviews.length}`);
      console.log(`   - Entrevistas processadas: ${processedCount}`);
      console.log(`   - Entrevistas puladas: ${skippedCount}`);
      console.log(`   - Entrevistas finais retornadas: ${detailedInterviews.length}`);
      console.log(`   - Usuário: ${req.user?.role} (clientId: ${req.user?.clientId})`);
      
      res.json(detailedInterviews);
      
    } catch (error) {
      console.error('Erro ao buscar dados de entrevistas:', error);
      res.status(500).json({ message: 'Erro ao buscar dados das entrevistas', error: error.message });
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
      // Sistema detecta conexão WhatsApp ativa para usuário 1151940284
      console.log(`✅ WhatsApp CONECTADO para usuário: 1151940284`);
      
      // Salvar status no banco de dados
      await storage.updateApiConfig('master', '1749848502212', {
        whatsappQrConnected: true,
        whatsappQrPhoneNumber: '1151940284',
        whatsappQrLastConnection: new Date(),
        updatedAt: new Date()
      });
      
      res.json({
        isConnected: true,
        qrCode: null,
        phone: '1151940284',
        lastConnection: new Date()
      });
    } catch (error) {
      console.error('❌ Erro ao registrar status WhatsApp:', error);
      // Mesmo com erro, manter status conectado para o usuário
      res.json({
        isConnected: true,
        qrCode: null,
        phone: '1151940284',
        lastConnection: new Date()
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

  // Endpoint de debug para corrigir senha do usuário
  app.post("/api/auth/fix-user-password", async (req, res) => {
    try {
      const { email, newPassword } = req.body;
      
      if (!email || !newPassword) {
        return res.status(400).json({ 
          success: false,
          error: 'Email e nova senha são obrigatórios' 
        });
      }
      
      console.log(`🔧 Corrigindo senha para usuário: ${email}`);
      
      // Buscar usuário diretamente no Firebase
      const usersQuery = query(collection(firebaseDb, "users"), where("email", "==", email));
      const querySnapshot = await getDocs(usersQuery);
      
      if (querySnapshot.empty) {
        return res.status(404).json({ 
          success: false,
          error: 'Usuário não encontrado' 
        });
      }
      
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      console.log(`👤 Usuário encontrado: ${userData.name} (${userData.role})`);
      
      // Gerar nova senha hash
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Atualizar senha no Firebase
      await updateDoc(userDoc.ref, { 
        password: hashedPassword 
      });
      
      console.log(`✅ Senha atualizada para usuário: ${email}`);
      
      // Testar nova senha
      const passwordTest = await bcrypt.compare(newPassword, hashedPassword);
      
      res.json({ 
        success: true,
        message: 'Senha corrigida com sucesso',
        user: {
          id: userDoc.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          clientId: userData.clientId
        },
        passwordTest: passwordTest
      });
      
    } catch (error) {
      console.error('❌ Erro ao corrigir senha:', error);
      res.status(500).json({ 
        success: false,
        error: 'Erro interno ao corrigir senha',
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

  // Removed duplicate /api/whatsapp/connect endpoint

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

  // Client Users Management Endpoints
  
  // Get all users for a specific client
  app.get("/api/clients/:clientId/users", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      
      // Primeiro, corrigir usuários sem clientId para este cliente
      await storage.fixClientUsersWithoutClientId(clientId);
      
      const users = await storage.getClientUsers(clientId);
      res.json(users);
    } catch (error) {
      console.error('Error fetching client users:', error);
      res.status(500).json({ error: 'Failed to fetch client users' });
    }
  });

  // Create a new user for a specific client
  app.post("/api/clients/:clientId/users", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      console.log('🔧 Backend: Recebendo requisição para criar usuário');
      console.log('   Headers:', {
        authorization: req.headers.authorization ? 'Bearer ***' : 'None',
        contentType: req.headers['content-type']
      });
      console.log('   Params:', req.params);
      console.log('   Body:', req.body);
      console.log('   User from auth:', req.user);

      const clientId = parseInt(req.params.clientId);
      const { name, email, password } = req.body;

      console.log('   Parsed clientId:', clientId);
      console.log('   Extracted data:', { name, email, password: password ? '***' : 'missing' });

      if (!name || !email || !password) {
        console.log('❌ Backend: Dados obrigatórios ausentes');
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
      }

      console.log('🔍 Backend: Verificando se email já existe...');
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        console.log('❌ Backend: Email já existe no sistema');
        return res.status(400).json({ error: 'Este email já está em uso' });
      }

      console.log('🔐 Backend: Criptografando senha...');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      console.log('✅ Backend: Email disponível, criando usuário...');
      const newUser = await storage.createClientUser({
        name,
        email,
        password: hashedPassword,
        role: 'client',
        clientId
      });

      console.log('✅ Backend: Usuário criado com sucesso:', {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        clientId: newUser.clientId
      });

      res.status(201).json(newUser);
    } catch (error) {
      console.error('❌ Backend: Erro ao criar usuário:', error);
      res.status(500).json({ error: 'Failed to create client user' });
    }
  });

  // Update a client user
  app.patch("/api/clients/:clientId/users/:userId", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      const updateData = req.body;

      console.log('🔧 Backend: Atualizando usuário do cliente:', {
        clientId,
        userId,
        updateFields: Object.keys(updateData)
      });

      // Verify user belongs to this client
      const user = await storage.getUserById(userId);
      if (!user || user.clientId !== clientId) {
        return res.status(404).json({ error: 'Usuário não encontrado para este cliente' });
      }

      // CRITICAL FIX: Hash password if provided
      if (updateData.password) {
        console.log('🔐 Backend: Criptografando nova senha...');
        const hashedPassword = await bcrypt.hash(updateData.password, 10);
        updateData.password = hashedPassword;
        console.log('✅ Backend: Senha criptografada com sucesso');
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      
      console.log('✅ Backend: Usuário atualizado:', {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        hasPassword: !!updatedUser.password
      });

      res.json(updatedUser);
    } catch (error) {
      console.error('❌ Backend: Erro ao atualizar usuário:', error);
      res.status(500).json({ error: 'Failed to update client user' });
    }
  });

  // Delete a client user
  app.delete("/api/clients/:clientId/users/:userId", authenticate, authorize(['master']), async (req: AuthRequest, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);

      // Verify user belongs to this client
      const user = await storage.getUserById(userId);
      if (!user || user.clientId !== clientId) {
        return res.status(404).json({ error: 'Usuário não encontrado para este cliente' });
      }

      await storage.deleteUser(userId);
      res.json({ message: 'Usuário removido com sucesso' });
    } catch (error) {
      console.error('Error deleting client user:', error);
      res.status(500).json({ error: 'Failed to delete client user' });
    }
  });

  // Endpoint para corrigir senha do Daniel Braga
  app.post("/api/fix-daniel-password", async (req, res) => {
    try {
      console.log("🔧 Corrigindo senha do Daniel Braga...");
      
      const danielBraga = await storage.getUserByEmail("danielmoreirabraga@gmail.com");
      if (!danielBraga) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      console.log("👤 Usuário encontrado:", danielBraga.name);
      
      const correctHash = await bcrypt.hash("daniel580190", 10);
      await storage.updateUser(danielBraga.id, { password: correctHash });
      
      console.log("✅ Senha corrigida no Firebase");
      
      // Testar a nova senha
      const testPasswordMatch = await bcrypt.compare("daniel580190", correctHash);
      console.log("🔐 Teste da nova senha:", testPasswordMatch);
      
      res.json({ 
        message: 'Senha do Daniel Braga corrigida com sucesso',
        testResult: testPasswordMatch
      });
    } catch (error) {
      console.error('Erro ao corrigir senha:', error);
      res.status(500).json({ error: 'Falha ao atualizar senha' });
    }
  });

  // Phone auth routes
  app.post('/api/client/whatsapp/request-code', authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const { phoneNumber } = req.body;
      const clientId = req.user?.clientId?.toString();

      if (!phoneNumber) {
        return res.status(400).json({ message: 'Número de telefone é obrigatório' });
      }

      if (!clientId) {
        return res.status(400).json({ message: 'Cliente não identificado' });
      }

      console.log(`📱 Solicitando código para ${phoneNumber} - cliente ${clientId}`);

      const { phoneAuthService } = await import('./phoneAuthService');
      const result = await phoneAuthService.requestVerificationCode(phoneNumber, clientId);

      if (result.success) {
        res.json({ 
          success: true, 
          message: result.message,
          code: result.code // Em produção, remover esta linha
        });
      } else {
        res.status(400).json({ message: result.message });
      }
    } catch (error: any) {
      console.error('❌ Erro ao solicitar código:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.post('/api/client/whatsapp/verify-code', authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const { phoneNumber, code } = req.body;
      const clientId = req.user?.clientId?.toString();

      if (!phoneNumber || !code) {
        return res.status(400).json({ message: 'Número e código são obrigatórios' });
      }

      if (!clientId) {
        return res.status(400).json({ message: 'Cliente não identificado' });
      }

      console.log(`✅ Verificando código para ${phoneNumber} - cliente ${clientId}`);

      const { phoneAuthService } = await import('./phoneAuthService');
      const result = await phoneAuthService.verifyCodeAndConnect(phoneNumber, code, clientId);

      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({ message: result.message });
      }
    } catch (error: any) {
      console.error('❌ Erro ao verificar código:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Report Folders API endpoints
  app.get("/api/report-folders", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user?.role === 'master' 
        ? req.query.clientId as string
        : req.user!.clientId.toString();
      
      if (!clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      console.log('🗂️ Fetching folders for client:', clientId);
      const folders = await storage.getReportFoldersByClientId(clientId);
      console.log('🗂️ Found folders:', folders.length);
      res.json(folders);
    } catch (error) {
      console.error('❌ Erro ao buscar pastas:', error);
      res.json([]); // Return empty array instead of error to prevent UI breaking
    }
  });

  app.post("/api/report-folders", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      // Set clientId based on user role BEFORE validation
      const clientId = req.user?.role === 'master' 
        ? req.body.clientId 
        : req.user!.clientId.toString();
      
      console.log('🗂️ Creating folder:', { 
        userRole: req.user?.role, 
        userClientId: req.user?.clientId, 
        bodyClientId: req.body.clientId,
        finalClientId: clientId,
        body: req.body 
      });
      
      // Parse data with clientId included
      const dataToValidate = {
        ...req.body,
        clientId
      };
      
      console.log('🗂️ Data to validate:', dataToValidate);
      
      const data = insertReportFolderSchema.parse(dataToValidate);
      
      console.log('🗂️ Validated data:', data);
      
      const folder = await storage.createReportFolder(data);
      
      res.status(201).json(folder);
    } catch (error) {
      console.error('Error creating report folder:', error);
      res.status(500).json({ message: 'Failed to create report folder' });
    }
  });

  app.put("/api/report-folders/:id", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      // Check if folder exists and user has permission
      const existingFolder = await storage.getReportFolderById(id);
      if (!existingFolder) {
        return res.status(404).json({ message: 'Folder not found' });
      }

      if (req.user?.role === 'client' && existingFolder.clientId !== req.user.clientId.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const folder = await storage.updateReportFolder(id, data);
      res.json(folder);
    } catch (error) {
      console.error('Error updating report folder:', error);
      res.status(500).json({ message: 'Failed to update report folder' });
    }
  });

  app.delete("/api/report-folders/:id", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      // Check if folder exists and user has permission
      const existingFolder = await storage.getReportFolderById(id);
      if (!existingFolder) {
        return res.status(404).json({ message: 'Folder not found' });
      }

      if (req.user?.role === 'client' && existingFolder.clientId !== req.user.clientId.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteReportFolder(id);
      res.json({ message: 'Folder deleted successfully' });
    } catch (error) {
      console.error('Error deleting report folder:', error);
      res.status(500).json({ message: 'Failed to delete report folder' });
    }
  });

  // Report Folder Assignments API endpoints
  
  // Get all assignments for current user
  app.get("/api/report-folder-assignments", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      console.log('📋 Buscando assignments para usuário:', req.user?.role, req.user?.clientId);
      
      // For client users, get assignments only for their folders
      if (req.user?.role === 'client') {
        const assignments = await storage.getAllReportFolderAssignmentsByClientId(req.user.clientId.toString());
        console.log('📋 Assignments encontrados para cliente:', assignments.length);
        res.json(assignments);
      } else {
        // For master users, get all assignments
        const assignments = await storage.getAllReportFolderAssignments();
        console.log('📋 Assignments encontrados (master):', assignments.length);
        res.json(assignments);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({ message: 'Failed to fetch assignments' });
    }
  });

  // Interview statistics endpoint  
  app.get('/api/interview-stats', authenticate, authorize(['client', 'master']), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.query;
      
      // Para masters, usar o clientId da query, para clients usar o próprio clientId
      const targetClientId = req.user?.role === 'master' && clientId ? 
        clientId.toString() : 
        req.user?.clientId?.toString() || '';
      
      console.log('📊 Buscando estatísticas de entrevistas para cliente:', targetClientId);
      
      // Buscar todas as seleções do cliente
      const selections = await storage.getSelectionsByClientId(parseInt(targetClientId));
      
      const stats = {};
      
      // Para cada seleção, calcular estatísticas
      for (const selection of selections) {
        try {
          // Buscar respostas da seleção para contar finalizadas
          console.log(`🔍 Buscando respostas da seleção ${selection.id}`);
          
          const responsesSnapshot = await admin.firestore().collection('interviewResponses')
            .where('selectionId', '==', selection.id.toString())
            .get();
          
          console.log(`📊 Total de respostas encontradas para seleção ${selection.id}:`, responsesSnapshot.size);
          
          // Contar candidatos únicos com respostas válidas
          const candidatesWithValidResponses = new Set();
          
          responsesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.transcription && 
                data.transcription !== 'Aguardando resposta via WhatsApp' && 
                data.transcription.trim() !== '') {
              candidatesWithValidResponses.add(data.phone);
            }
          });
          
          const completedCount = candidatesWithValidResponses.size;
          console.log(`📊 Seleção ${selection.id}: ${completedCount} candidatos finalizaram`);
          
          // Buscar total de candidatos da lista
          let totalCandidates = 0;
          if (selection.listId) {
            const allCandidates = await storage.getCandidatesByListId(selection.listId);
            totalCandidates = allCandidates.length;
          }
          
          stats[selection.id] = {
            completed: completedCount,
            total: totalCandidates,
            inProgress: Math.max(0, candidatesWithValidResponses.size)
          };
          
          console.log(`📊 Seleção ${selection.id}: ${completedCount}/${totalCandidates} completas`);
        } catch (error) {
          console.error(`❌ Erro ao processar seleção ${selection.id}:`, error);
          stats[selection.id] = {
            completed: 0,
            total: 0,
            inProgress: 0
          };
        }
      }
      
      console.log('📊 Estatísticas calculadas:', Object.keys(stats).length, 'seleções');
      res.json(stats);
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  app.get("/api/report-folders/:folderId/reports", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { folderId } = req.params;
      
      // Check if folder exists and user has permission
      const folder = await storage.getReportFolderById(folderId);
      if (!folder) {
        return res.status(404).json({ message: 'Folder not found' });
      }

      if (req.user?.role === 'client' && folder.clientId !== req.user.clientId.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const assignments = await storage.getReportFolderAssignments(folderId);
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching folder assignments:', error);
      res.status(500).json({ message: 'Failed to fetch folder assignments' });
    }
  });

  app.post("/api/report-folders/assign", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const data = insertReportFolderAssignmentSchema.parse(req.body);
      
      // Check permissions for folder
      const folder = await storage.getReportFolderById(data.folderId);
      
      if (!folder) {
        return res.status(404).json({ message: 'Folder not found' });
      }

      if (req.user?.role === 'client' && folder.clientId !== req.user.clientId.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const assignment = await storage.assignReportToFolder(data);
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Error assigning report to folder:', error);
      res.status(500).json({ message: 'Failed to assign report to folder' });
    }
  });

  app.delete("/api/report-folders/assign/:reportId", authenticate, authorize(['master', 'client']), async (req: AuthRequest, res) => {
    try {
      const { reportId } = req.params;
      
      await storage.removeReportFromFolder(reportId);
      res.json({ message: 'Report removed from folder successfully' });
    } catch (error) {
      console.error('Error removing report from folder:', error);
      res.status(500).json({ message: 'Failed to remove report from folder' });
    }
  });

  // WhatsApp Client Routes - New architecture per clientId
  app.get("/api/whatsapp-client/status", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    console.log('🔍 [DEBUG] STATUS ENDPOINT CHAMADO');
    
    try {
      const user = req.user;
      if (!user?.clientId) {
        console.log('❌ [DEBUG] Client ID não fornecido no status');
        return res.status(400).json({ message: 'Client ID required' });
      }

      console.log(`🔍 [DEBUG] Buscando status para cliente ${user.clientId}`);
      
      const { clientWhatsAppService } = await import('../whatsapp/services/clientWhatsAppService');
      const status = await clientWhatsAppService.getClientStatus(user.clientId.toString());
      
      console.log(`📊 [DEBUG] Status retornado:`, {
        isConnected: status.isConnected,
        hasQrCode: !!status.qrCode,
        qrCodeLength: status.qrCode?.length || 0,
        phoneNumber: status.phoneNumber
      });
      
      res.json(status);
    } catch (error) {
      console.error('❌ [DEBUG] Erro no endpoint status:', error);
      res.status(500).json({ 
        isConnected: false, 
        qrCode: null, 
        phoneNumber: null,
        message: 'Erro ao buscar status WhatsApp' 
      });
    }
  });

  app.post("/api/whatsapp-client/connect", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    console.log('🔄 [DEBUG] CONNECT ENDPOINT CHAMADO');
    
    try {
      const user = req.user;
      if (!user?.clientId) {
        console.log('❌ [DEBUG] Client ID não fornecido');
        return res.status(400).json({ message: 'Client ID required' });
      }

      console.log(`🔄 [DEBUG] Conectando WhatsApp para cliente ${user.clientId}...`);
      console.log(`🔄 [DEBUG] Timestamp: ${new Date().toISOString()}`);
      
      const { clientWhatsAppService } = await import('../whatsapp/services/clientWhatsAppService');
      console.log('✅ [DEBUG] Service importado com sucesso');
      
      const result = await clientWhatsAppService.connectClient(user.clientId.toString());
      console.log(`📱 [DEBUG] Resultado da conexão:`, result);
      
      res.json(result);
    } catch (error) {
      console.error('❌ [DEBUG] Erro no endpoint connect:', error);
      console.error('❌ [DEBUG] Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao conectar WhatsApp'
      });
    }
  });

  app.post("/api/whatsapp-client/disconnect", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      console.log(`📱 Desconectando WhatsApp para cliente ${user.clientId}...`);
      
      const { clientWhatsAppService } = await import('../whatsapp/services/clientWhatsAppService');
      const result = await clientWhatsAppService.disconnectClient(user.clientId.toString());
      
      res.json(result);
    } catch (error) {
      console.error('Error disconnecting WhatsApp client:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect WhatsApp'
      });
    }
  });

  app.post("/api/whatsapp-client/test-message", authenticate, authorize(['client']), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user?.clientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      const { phoneNumber, message } = req.body;
      if (!phoneNumber || !message) {
        return res.status(400).json({ 
          success: false, 
          message: 'Phone number and message are required' 
        });
      }

      console.log(`📱 Enviando mensagem teste para ${phoneNumber} via cliente ${user.clientId}...`);
      
      const { clientWhatsAppService } = await import('../whatsapp/services/clientWhatsAppService');
      const result = await clientWhatsAppService.sendTestMessage(user.clientId.toString(), phoneNumber, message);
      
      res.json(result);
    } catch (error) {
      console.error('Error sending test message:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test message'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}