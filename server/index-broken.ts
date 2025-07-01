import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";

const app = express();

// Tratamento de erros
process.on('uncaughtException', (err) => {
  console.error('❌ [ERROR] Erro não capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [ERROR] Promise rejeitada não tratada:', reason);
});

// Middleware básico
app.use((req, res, next) => {
  console.log(`🌐 [REQUEST] ${req.method} ${req.url}`);
  next();
});

app.disable('etag');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Servir arquivos de áudio
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    
    if (filePath.endsWith('.ogg')) {
      res.setHeader('Content-Type', 'audio/ogg');
    } else if (filePath.endsWith('.webm')) {
      res.setHeader('Content-Type', 'audio/webm');
    } else if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    }
    
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

// Middleware de logging
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

// Registrar rotas
registerRoutes(app);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Middleware de tratamento de erros
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`❌ [ERROR] ${err.message}`);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

(async () => {
  const server = await setupVite(app, serveStatic);
  const PORT = 5000;
  
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
})();