// Script para corrigir o token JWT no localStorage
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'maximus-interview-secret-key';

// Token válido com o ID correto do usuário master
const validToken = jwt.sign({ 
  id: '1749848502212', 
  email: 'daniel@grupomaximuns.com.br', 
  role: 'master'
}, JWT_SECRET);

console.log('=== CORREÇÃO DO TOKEN JWT ===');
console.log('Token válido para copiar e colar no Console do navegador:');
console.log('');
console.log('localStorage.setItem("auth_token", "' + validToken + '");');
console.log('localStorage.setItem("user_data", JSON.stringify({');
console.log('  "id": "1749848502212",');
console.log('  "email": "daniel@grupomaximuns.com.br",');
console.log('  "role": "master",');
console.log('  "name": "Daniel - Grupo Maximus"');
console.log('}));');
console.log('window.location.reload();');
console.log('');
console.log('=== INSTRUÇÕES ===');
console.log('1. Abra o Console do navegador (F12)');
console.log('2. Cole e execute os comandos acima');
console.log('3. A página será recarregada automaticamente');
console.log('4. O botão "Criar Usuário" funcionará corretamente');