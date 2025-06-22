// Evolution API integrada diretamente
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const API_KEY = 'evolution_maximus_secure_key_2025';

// Simulação de instâncias (para desenvolvimento)
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', instances: instances.size });
});

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
    
    // Gerar QR Code usando qrcode
    const QRCode = require('qrcode');
    const qrData = `https://wa.me/qr/${name}_${Date.now()}`;
    const qrCode = await QRCode.toDataURL(qrData, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    });
    
    const instance = {
      id: name,
      qrCode: () => qrCode,
      isConnected: () => false,
      createdAt: new Date().toISOString(),
      status: () => 'qr'
    };

    instances.set(name, instance);
    
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
  
  instances.delete(instanceName);
  console.log(`Instância ${instanceName} removida`);
  res.json({ message: 'Instância removida com sucesso' });
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
    
    res.json({
      message: 'Mensagem enviada com sucesso',
      messageId: `msg_${Date.now()}`,
      status: 'sent'
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Evolution API simplificada rodando na porta ${PORT}`);
  console.log(`🔑 API Key: ${API_KEY}`);
  console.log(`📡 Endpoint: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

// Limpeza ao fechar
process.on('SIGINT', () => {
  console.log('Fechando Evolution API...');
  process.exit(0);
});