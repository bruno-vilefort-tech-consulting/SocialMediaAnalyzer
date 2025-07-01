import express from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Inicializar servidor
async function startServer() {
  try {
    console.log("🚀 Iniciando servidor...");
    
    // Registrar rotas da API primeiro
    await registerRoutes(app);
    
    // Configurar Vite para servir o frontend
    await setupVite(app, server);
    
    // Iniciar servidor
    server.listen(PORT, () => {
      console.log(`✅ Servidor rodando na porta ${PORT}`);
    });
    
  } catch (error) {
    console.error("❌ Erro ao iniciar servidor:", error);
    process.exit(1);
  }
}

startServer();