import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { cacheBustingService } from "./cacheBustingService";

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

// 🚀 Global Cache Busting para Fresh Deploys
app.disable('etag');
app.use(cacheBustingService.cacheBustingMiddleware());

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
    
    // 🔥 CORREÇÃO: Forçar reinicialização se necessário
    await simpleQueueManager.initialize();
    
    console.log('✅ [QUEUE] Sistema de filas inicializado e processando');
    
    // 🔥 TESTE: Verificar se está funcionando
    const stats = await simpleQueueManager.getQueueStats();
    console.log(`📊 [QUEUE] Status inicial:`, stats);
    
  } catch (error) {
    console.error('⚠️ [QUEUE] Erro ao inicializar sistema de filas:', error);
    console.log('📝 [QUEUE] Sistema continuará funcionando sem processamento em background');
    
    // 🔥 FALLBACK: Tentar novamente após delay
    setTimeout(async () => {
      try {
        console.log('🔄 [QUEUE] Tentativa de reinicialização...');
        const { simpleQueueManager } = await import('./queue/simpleQueueManager.js');
        await simpleQueueManager.initialize();
        console.log('✅ [QUEUE] Sistema de filas inicializado (segunda tentativa)');
      } catch (retryError) {
        console.error('❌ [QUEUE] Falha na reinicialização:', retryError);
      }
    }, 5000);
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
