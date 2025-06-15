import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rota de áudio deve vir ANTES do middleware Vite
import path from "path";
import fs from "fs";

app.get('/audio/:filename', (req, res) => {
  const filename = req.params.filename;
  const audioPath = path.join(process.cwd(), 'uploads', filename);
  
  console.log(`🎵 Servindo áudio: ${filename} de ${audioPath}`);
  
  if (!fs.existsSync(audioPath)) {
    console.log(`❌ Arquivo não encontrado: ${audioPath}`);
    return res.status(404).json({ error: 'Arquivo de áudio não encontrado' });
  }
  
  // Headers específicos para áudio .ogg
  res.setHeader('Content-Type', 'audio/ogg; codecs=opus');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const stat = fs.statSync(audioPath);
  res.setHeader('Content-Length', stat.size);
  
  console.log(`✅ Enviando áudio: ${filename} (${stat.size} bytes)`);
  
  const readStream = fs.createReadStream(audioPath);
  readStream.pipe(res);
});

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
  // Initialize Firebase data
  const { initializeFirebaseData } = await import("./initializeFirebaseData");
  await initializeFirebaseData();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
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
