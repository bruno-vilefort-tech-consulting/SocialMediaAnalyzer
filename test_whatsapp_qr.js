// Script de teste para QR Code WhatsApp
import jwt from 'jsonwebtoken';

// Gerar token JWT válido para teste
const payload = {
  id: '1750131049173',
  email: 'danielmoreirabraga@gmail.com',
  role: 'client',
  clientId: 1749849987543,
  iat: Math.floor(Date.now() / 1000)
};

const secret = process.env.JWT_SECRET || 'maximus-interview-system-secret-key-2024';
const token = jwt.sign(payload, secret);

console.log('Token JWT válido:');
console.log(token);

// Teste do endpoint de status
const testStatus = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/client/whatsapp/status', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    console.log('\nStatus WhatsApp:', data);
  } catch (error) {
    console.error('Erro no teste de status:', error.message);
  }
};

// Teste do endpoint de conexão
const testConnect = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/client/whatsapp/connect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    console.log('\nConexão WhatsApp:', data);
    if (data.qrCode) {
      console.log('QR Code recebido com tamanho:', data.qrCode.length);
    }
  } catch (error) {
    console.error('Erro no teste de conexão:', error.message);
  }
};

// Executar testes
testStatus().then(() => testConnect());