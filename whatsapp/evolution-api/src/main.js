const express = require('express');
const cors = require('cors');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.EVOLUTION_PORT || 3001;
const API_KEY = process.env.EVOLUTION_API_KEY || 'evolution_maximus_secure_key_2025';

// Armazenamento de instâncias
const instances = new Map();

// Middleware de autenticação
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autorização necessário' });
  }
  
  const token = authHeader.slice(7);
  if (token !== API_KEY) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  
  next();
};

// Função para criar sessão WhatsApp
async function createWhatsAppSession(instanceName) {
  try {
    const sessionPath = path.join(__dirname, '..', 'sessions', instanceName);
    
    // Criar diretório se não existir
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: { level: 'silent' },
      browser: ['Evolution API', 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: true,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      emitOwnEvents: true,
      markOnlineOnConnect: true,
    });

    let qrCode = null;
    let isConnected = false;

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      console.log(`[${instanceName}] Connection update:`, { connection, hasQr: !!qr });
      
      if (qr) {
        try {
          qrCode = await QRCode.toDataURL(qr);
          console.log(`[${instanceName}] QR Code gerado, tamanho: ${qrCode.length}`);
        } catch (error) {
          console.error(`[${instanceName}] Erro ao gerar QR Code:`, error);
        }
      }
      
      if (connection === 'open') {
        isConnected = true;
        console.log(`[${instanceName}] WhatsApp conectado com sucesso`);
      }
      
      if (connection === 'close') {
        isConnected = false;
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(`[${instanceName}] Conexão fechada, reconectar:`, shouldReconnect);
        
        if (shouldReconnect) {
          console.log(`[${instanceName}] Tentando reconectar...`);
          setTimeout(() => createWhatsAppSession(instanceName), 3000);
        }
      }
    });

    socket.ev.on('creds.update', saveCreds);

    // Armazenar instância
    const instance = {
      id: instanceName,
      socket,
      qrCode: () => qrCode,
      isConnected: () => isConnected,
      createdAt: new Date().toISOString(),
      status: () => isConnected ? 'open' : (qrCode ? 'qr' : 'connecting')
    };

    instances.set(instanceName, instance);
    console.log(`[${instanceName}] Instância criada e armazenada`);
    
    return instance;
  } catch (error) {
    console.error(`[${instanceName}] Erro ao criar sessão WhatsApp:`, error);
    throw error;
  }
}

// Rotas da Evolution API

// POST /instance - Criar instância
app.post('/instance', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome da instância é obrigatório' });
    }

    if (instances.has(name)) {
      return res.status(409).json({ error: 'Instância já existe' });
    }

    console.log(`Criando instância: ${name}`);
    const instance = await createWhatsAppSession(name);
    
    res.json({
      instance: {
        instanceName: name,
        status: instance.status()
      },
      hash: {
        apikey: API_KEY
      }
    });
  } catch (error) {
    console.error('Erro ao criar instância:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /instance/:instanceName/qr - Obter QR Code
app.get('/instance/:instanceName/qr', authenticate, (req, res) => {
  const { instanceName } = req.params;
  const instance = instances.get(instanceName);
  
  if (!instance) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }
  
  const qrCode = instance.qrCode();
  if (!qrCode) {
    return res.status(404).json({ error: 'QR Code não disponível' });
  }
  
  res.json({
    pairingCode: null,
    qrcode: qrCode
  });
});

// GET /instance/:instanceName/status - Status da instância
app.get('/instance/:instanceName/status', authenticate, (req, res) => {
  const { instanceName } = req.params;
  const instance = instances.get(instanceName);
  
  if (!instance) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }
  
  res.json({
    instance: {
      instanceName,
      status: instance.status()
    }
  });
});

// DELETE /instance/:instanceName - Deletar instância
app.delete('/instance/:instanceName', authenticate, async (req, res) => {
  const { instanceName } = req.params;
  const instance = instances.get(instanceName);
  
  if (!instance) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }
  
  try {
    // Fechar socket
    if (instance.socket) {
      await instance.socket.logout();
      instance.socket.end();
    }
    
    // Remover da memória
    instances.delete(instanceName);
    
    // Limpar sessão
    const sessionPath = path.join(__dirname, '..', 'sessions', instanceName);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    
    console.log(`Instância ${instanceName} removida`);
    res.json({ message: 'Instância removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover instância:', error);
    res.status(500).json({ error: 'Erro ao remover instância' });
  }
});

// POST /message - Enviar mensagem
app.post('/message', authenticate, async (req, res) => {
  try {
    const { instance_id, number, message } = req.body;
    
    if (!instance_id || !number || !message) {
      return res.status(400).json({ error: 'instance_id, number e message são obrigatórios' });
    }
    
    const instance = instances.get(instance_id);
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }
    
    if (!instance.isConnected()) {
      return res.status(400).json({ error: 'Instância não está conectada' });
    }
    
    const formattedNumber = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    
    const messageInfo = await instance.socket.sendMessage(formattedNumber, { 
      text: message 
    });
    
    res.json({
      message: 'Mensagem enviada com sucesso',
      messageId: messageInfo.key.id,
      status: 'sent'
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', instances: instances.size });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Evolution API rodando na porta ${PORT}`);
  console.log(`🔑 API Key: ${API_KEY}`);
  console.log(`📡 Endpoint: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

// Limpeza ao fechar
process.on('SIGINT', async () => {
  console.log('Fechando todas as instâncias...');
  for (const [name, instance] of instances) {
    try {
      if (instance.socket) {
        await instance.socket.logout();
        instance.socket.end();
      }
    } catch (error) {
      console.error(`Erro ao fechar instância ${name}:`, error);
    }
  }
  process.exit(0);
});