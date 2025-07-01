import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";

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

// Desabilitar cache
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

(async () => {
  try {
    registerRoutes(app);
    const server = await setupVite(app, serveStatic);

    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour12: true,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      console.log(`✅ Server running on port ${PORT} at ${formattedTime}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
})();

// Middleware de tratamento de erros
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`❌ [ERROR] ${err.message}`);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});