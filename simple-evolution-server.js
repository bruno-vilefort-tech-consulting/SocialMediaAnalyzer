const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for instances
const instances = new Map();

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 200,
    message: "Welcome to the Evolution API, it is working!",
    version: "2.3.0",
    documentation: "https://doc.evolution-api.com"
  });
});

// Create instance
app.post('/instance', (req, res) => {
  const { instanceName, token } = req.body;
  
  if (!instanceName) {
    return res.status(400).json({
      error: "Instance name is required"
    });
  }

  const instanceId = instanceName || uuidv4();
  
  // Create new instance
  const instance = {
    instanceId,
    instanceName,
    status: 'created',
    qrCode: null,
    isConnected: false,
    phoneNumber: null,
    createdAt: new Date().toISOString()
  };
  
  instances.set(instanceId, instance);
  
  console.log(`[EVOLUTION] Instância criada: ${instanceId}`);
  
  res.status(201).json({
    instance: {
      instanceId,
      instanceName,
      status: 'created'
    }
  });
});

// Get instance info
app.get('/instance/:instanceId', (req, res) => {
  const { instanceId } = req.params;
  const instance = instances.get(instanceId);
  
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

// Generate QR Code
app.get('/instance/:instanceId/qr', (req, res) => {
  const { instanceId } = req.params;
  const instance = instances.get(instanceId);
  
  if (!instance) {
    return res.status(404).json({
      error: "Instance not found"
    });
  }
  
  // Simulate QR code generation
  const qrCode = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
  
  instance.qrCode = qrCode;
  instance.status = 'qr_generated';
  
  console.log(`[EVOLUTION] QR Code gerado para instância: ${instanceId}`);
  
  res.json({
    qrCode,
    instanceId,
    status: 'qr_generated'
  });
});

// Connect instance (simulate WhatsApp connection)
app.post('/instance/:instanceId/connect', (req, res) => {
  const { instanceId } = req.params;
  const instance = instances.get(instanceId);
  
  if (!instance) {
    return res.status(404).json({
      error: "Instance not found"
    });
  }
  
  // Simulate connection
  instance.isConnected = true;
  instance.status = 'connected';
  instance.phoneNumber = '5511984316526'; // Simulated phone number
  
  console.log(`[EVOLUTION] Instância conectada: ${instanceId}`);
  
  res.json({
    success: true,
    instanceId,
    status: 'connected',
    phoneNumber: instance.phoneNumber
  });
});

// Send message
app.post('/instance/:instanceId/message/send', (req, res) => {
  const { instanceId } = req.params;
  const { to, message } = req.body;
  const instance = instances.get(instanceId);
  
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
  
  // Simulate message sending
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

// Get instance status
app.get('/instance/:instanceId/status', (req, res) => {
  const { instanceId } = req.params;
  const instance = instances.get(instanceId);
  
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

// Disconnect instance
app.delete('/instance/:instanceId', (req, res) => {
  const { instanceId } = req.params;
  const instance = instances.get(instanceId);
  
  if (!instance) {
    return res.status(404).json({
      error: "Instance not found"
    });
  }
  
  instances.delete(instanceId);
  
  console.log(`[EVOLUTION] Instância removida: ${instanceId}`);
  
  res.json({
    success: true,
    message: "Instance deleted successfully"
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Evolution API simplificada rodando na porta ${PORT}`);
  console.log(`📋 Endpoints disponíveis:`);
  console.log(`   GET  /                              - Health check`);
  console.log(`   POST /instance                      - Criar instância`);
  console.log(`   GET  /instance/:id                  - Info da instância`);
  console.log(`   GET  /instance/:id/qr               - Gerar QR Code`);
  console.log(`   POST /instance/:id/connect          - Conectar instância`);
  console.log(`   GET  /instance/:id/status           - Status da instância`);
  console.log(`   POST /instance/:id/message/send     - Enviar mensagem`);
  console.log(`   DELETE /instance/:id                - Deletar instância`);
});

module.exports = app;