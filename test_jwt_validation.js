// Teste detalhado de validação JWT
import jwt from 'jsonwebtoken';

// Configurações exatas do sistema
const JWT_SECRET = process.env.JWT_SECRET || 'maximus-interview-system-secret-key-2024';

console.log('=== TESTE DE JWT ===');
console.log('JWT_SECRET:', JWT_SECRET);
console.log('JWT_SECRET length:', JWT_SECRET.length);

// Payload exato do usuário
const payload = {
  id: '1750131049173',
  email: 'danielmoreirabraga@gmail.com',
  role: 'client',
  clientId: 1749849987543,
  iat: Math.floor(Date.now() / 1000)
};

console.log('\nPayload:', payload);

// Gerar token
const token = jwt.sign(payload, JWT_SECRET);
console.log('\nToken gerado:', token);

// Validar token
try {
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('\nToken validado com sucesso!');
  console.log('Decoded:', decoded);
} catch (error) {
  console.log('\nErro na validação:', error.message);
}

// Testar endpoint
console.log('\n=== TESTE DO ENDPOINT ===');
const testEndpoint = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/client/whatsapp/status', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Status response:', response.status);
    console.log('Data:', data);
    
    if (response.ok) {
      // Testar conexão WhatsApp
      console.log('\n=== TESTE CONEXÃO WHATSAPP ===');
      const connectResponse = await fetch('http://localhost:5000/api/client/whatsapp/connect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const connectData = await connectResponse.json();
      console.log('Connect response:', connectResponse.status);
      console.log('Connect data:', connectData);
      
      if (connectData.qrCode) {
        console.log('QR Code recebido! Tamanho:', connectData.qrCode.length);
        console.log('Mensagem:', connectData.message);
      }
    }
  } catch (error) {
    console.error('Erro no teste:', error.message);
  }
};

testEndpoint();