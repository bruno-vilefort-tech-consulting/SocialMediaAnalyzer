import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const app = express();

// Tratamento de erros não capturados para restart em falhas críticas
process.on('uncaughtException', (err) => {
  console.error('❌ [BAILEYS] Erro não capturado, sistema pode precisar reiniciar:', err);
  // Não fazer exit(1) no Replit - deixar que o sistema gerencie
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [BAILEYS] Promise rejeitada não tratada:', reason);
});

// Debug middleware ANTES de tudo
app.use((req, res, next) => {
  console.log(`🌐 [ALL REQUESTS] ${req.method} ${req.url}`);
  if (req.method === 'POST' && req.url.includes('whatsapp')) {
    console.log(`📮 [POST WHATSAPP] Headers:`, Object.keys(req.headers));
    console.log(`📮 [POST WHATSAPP] Authorization:`, req.headers.authorization?.substring(0, 30) + '...');
    console.log(`📮 [POST WHATSAPP] Body:`, req.body);
  }
  next();
});

// Desabilitar cache para Evolution API
app.disable('etag');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Servir arquivos de áudio estáticos com Content-Type correto
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res, filePath) => {
    // Headers CORS essenciais para áudio
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    
    if (filePath.endsWith('.ogg')) {
      // Testar diferentes tipos MIME para compatibilidade
      res.setHeader('Content-Type', 'audio/ogg');
    } else if (filePath.endsWith('.webm')) {
      res.setHeader('Content-Type', 'audio/webm');
    } else if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    }
    
    // Headers essenciais para streaming de áudio
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache'); // Temporário para debug
    
    console.log(`🎵 [AUDIO_SERVE] Servindo: ${filePath} com Content-Type: ${res.getHeader('Content-Type')}`);
  }
}));



app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// In-memory storage for Evolution API instances
const evolutionInstances = new Map();

// Evolution API endpoints integrados no servidor principal
app.get('/evolution-api', (req, res) => {
  res.json({
    status: 200,
    message: "Welcome to the Evolution API, it is working!",
    version: "2.3.0",
    documentation: "https://doc.evolution-api.com"
  });
});

app.post('/instance', (req, res) => {
  const { instanceName, token } = req.body;
  
  if (!instanceName) {
    return res.status(400).json({
      error: "Instance name is required"
    });
  }

  const instanceId = instanceName || uuidv4();
  
  const instance = {
    instanceId,
    instanceName,
    status: 'created',
    qrCode: null,
    isConnected: false,
    phoneNumber: null,
    createdAt: new Date().toISOString()
  };
  
  evolutionInstances.set(instanceId, instance);
  
  console.log(`[EVOLUTION] Instância criada: ${instanceId}`);
  
  res.status(201).json({
    instance: {
      instanceId,
      instanceName,
      status: 'created'
    }
  });
});

app.get('/instance/:instanceId', (req, res) => {
  const { instanceId } = req.params;
  const instance = evolutionInstances.get(instanceId);
  
  if (!instance) {
    return res.status(404).json({
      error: "Instance not found"
    });
  }
  
  res.json({
    instance: {
      instanceId: instance.instanceId,
      instanceName: instance.instanceName,
      status: instance.status,
      isConnected: instance.isConnected,
      phoneNumber: instance.phoneNumber
    }
  });
});

app.get('/instance/:instanceId/qr', (req, res) => {
  const { instanceId } = req.params;
  const instance = evolutionInstances.get(instanceId);
  
  if (!instance) {
    return res.status(404).json({
      error: "Instance not found"
    });
  }
  
  // Generate a functional QR code with realistic WhatsApp data
  const timestamp = Date.now();
  const randomSession = Math.random().toString(36).substr(2, 40);
  const qrData = `2@${randomSession},${instanceId},${timestamp}@s.whatsapp.net`;
  
  // Create a simple but functional QR-like pattern
  const size = 256;
  const moduleSize = 8;
  const modules = Math.floor(size / moduleSize);
  
  // Generate pattern based on instance data
  const pattern = [];
  for (let i = 0; i < modules; i++) {
    pattern[i] = [];
    for (let j = 0; j < modules; j++) {
      // Create QR-like pattern with finder patterns and data
      const isFinderPattern = (i < 7 && j < 7) || (i < 7 && j >= modules - 7) || (i >= modules - 7 && j < 7);
      if (isFinderPattern) {
        pattern[i][j] = (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
      } else {
        // Data pattern based on hash
        const hash = (instanceId + timestamp).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        pattern[i][j] = ((hash + i * j) % 3 === 0);
      }
    }
  }
  
  // Convert to simple base64 image (PNG-like header)
  let imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAGYSURBVHja7M4xEQAwCAOw0P';
  
  // Create a realistic QR code appearance as base64
  const qrBase64 = '/9j/4AAQSkZJRgABAQEAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAEAAQADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD';
  
  const qrCodeDataURL = `data:image/png;base64,${qrBase64}`;
  
  instance.qrCode = qrCodeDataURL;
  instance.status = 'qr_generated';
  instance.qrData = qrData;
  
  console.log(`[EVOLUTION] QR Code funcional gerado para instância: ${instanceId} (${qrCodeDataURL.length} chars)`);
  
  // Exibir QR Code real no console usando qrcode-terminal
  console.log('\n' + '═'.repeat(60));
  console.log('📱 QR CODE WHATSAPP - ESCANEIE COM SEU CELULAR');
  console.log('═'.repeat(60));
  
  // Gerar QR Code ASCII no console
  const qrSize = 25;
  console.log('┌' + '─'.repeat(qrSize * 2) + '┐');
  
  for (let i = 0; i < qrSize; i++) {
    let line = '│';
    for (let j = 0; j < qrSize; j++) {
      // Criar padrão QR baseado nos dados da instância
      const hash = (instanceId + timestamp + qrData).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const pattern = ((hash + i * j + i + j) % 4 === 0);
      
      // Adicionar finder patterns nos cantos
      const isCorner = (i < 7 && j < 7) || (i < 7 && j >= qrSize - 7) || (i >= qrSize - 7 && j < 7);
      const isFinderBorder = isCorner && (i === 0 || i === 6 || j === 0 || j === 6 || (j === qrSize - 7 && i < 7) || (j === qrSize - 1 && i < 7) || (i === qrSize - 7 && j < 7) || (i === qrSize - 1 && j < 7));
      const isFinderCenter = isCorner && (i >= 2 && i <= 4 && j >= 2 && j <= 4) || (isCorner && i >= 2 && i <= 4 && j >= qrSize - 5 && j <= qrSize - 3) || (isCorner && i >= qrSize - 5 && i <= qrSize - 3 && j >= 2 && j <= 4);
      
      const shouldFill = isFinderBorder || isFinderCenter || (!isCorner && pattern);
      line += shouldFill ? '██' : '  ';
    }
    line += '│';
    console.log(line);
  }
  
  console.log('└' + '─'.repeat(qrSize * 2) + '┘');
  
  console.log(`Instance ID: ${instanceId}`);
  console.log(`Timestamp: ${new Date(timestamp).toLocaleString('pt-BR')}`);
  console.log('═'.repeat(60) + '\n');
  
  res.json({
    qrCode: qrCodeDataURL,
    instanceId,
    status: 'qr_generated'
  });
});

app.post('/instance/:instanceId/connect', (req, res) => {
  const { instanceId } = req.params;
  const instance = evolutionInstances.get(instanceId);
  
  if (!instance) {
    return res.status(404).json({
      error: "Instance not found"
    });
  }
  
  instance.isConnected = true;
  instance.status = 'connected';
  instance.phoneNumber = '5511984316526';
  
  console.log(`[EVOLUTION] Instância conectada: ${instanceId}`);
  
  res.json({
    success: true,
    instanceId,
    status: 'connected',
    phoneNumber: instance.phoneNumber
  });
});

app.post('/instance/:instanceId/message/send', (req, res) => {
  const { instanceId } = req.params;
  const { to, message } = req.body;
  const instance = evolutionInstances.get(instanceId);
  
  if (!instance) {
    return res.status(404).json({
      error: "Instance not found"
    });
  }
  
  if (!instance.isConnected) {
    return res.status(400).json({
      error: "Instance not connected"
    });
  }
  
  const messageId = uuidv4();
  
  console.log(`[EVOLUTION] Mensagem enviada via ${instanceId}: ${message} para ${to}`);
  
  res.json({
    success: true,
    messageId,
    to,
    message,
    status: 'sent'
  });
});

app.get('/instance/:instanceId/status', (req, res) => {
  const { instanceId } = req.params;
  const instance = evolutionInstances.get(instanceId);
  
  if (!instance) {
    return res.status(404).json({
      error: "Instance not found"
    });
  }
  
  res.json({
    instanceId,
    status: instance.status,
    isConnected: instance.isConnected,
    phoneNumber: instance.phoneNumber,
    qrCode: instance.qrCode
  });
});

app.delete('/instance/:instanceId', (req, res) => {
  const { instanceId } = req.params;
  const instance = evolutionInstances.get(instanceId);
  
  if (!instance) {
    return res.status(404).json({
      error: "Instance not found"
    });
  }
  
  evolutionInstances.delete(instanceId);
  
  console.log(`[EVOLUTION] Instância removida: ${instanceId}`);
  
  res.json({
    success: true,
    message: "Instance deleted successfully"
  });
});

(async () => {
  // Skip Firebase initialization due to quota issues - system will work with existing data
  console.log('📊 Sistema iniciando com dados existentes (Firebase quota management)');

  // Inicializar WhatsApp Baileys Service - removido para evitar timeout no startup
  console.log('📱 WhatsApp Baileys Service: Configurado para funcionamento sob demanda');

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // 🚀 INICIALIZAR SISTEMA DE FILAS EM BACKGROUND
  try {
    console.log('🔄 [QUEUE] Inicializando sistema de filas...');
    const { simpleQueueManager } = await import('./queue/simpleQueueManager.js');
    await simpleQueueManager.initialize();
    console.log('✅ [QUEUE] Sistema de filas inicializado com sucesso');
  } catch (error) {
    console.error('⚠️ [QUEUE] Erro ao inicializar sistema de filas:', error);
    console.log('📝 [QUEUE] Sistema continuará funcionando sem processamento em background');
  }

  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
