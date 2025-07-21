// Teste manual para verificar se o loop infinito foi definitivamente corrigido
console.log('🧪 TESTE MANUAL DO LOOP INFINITO - VERSÃO 2');
console.log('==========================================');

// Simular mensagem "1" via curl
const testPhone = '553182956616';
const testClientId = '1749849987543';

console.log(`📱 Enviando mensagem "1" para ${testPhone}...`);

// Este script será chamado manualmente para testar
console.log(`
COMANDOS PARA TESTE MANUAL:

1. Enviar mensagem "1":
curl -X POST http://localhost:5000/api/process-message \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "${testPhone}", "message": "1", "clientId": "${testClientId}"}'

2. Simular primeira resposta de áudio:
curl -X POST http://localhost:5000/api/process-message \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "${testPhone}", "message": "Primeira resposta", "clientId": "${testClientId}"}'

3. Simular segunda resposta de áudio:
curl -X POST http://localhost:5000/api/process-message \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "${testPhone}", "message": "Segunda resposta", "clientId": "${testClientId}"}'

4. Verificar logs do servidor para ver se avança corretamente.
`);

console.log('\n🔍 PONTOS A VERIFICAR NOS LOGS:');
console.log('- [UNIFIED] Entrevista única criada');
console.log('- [START-QUESTION] Enviando primeira pergunta');
console.log('- [INTERVIEW-ADVANCE] Avançando de pergunta');
console.log('- [NEXT-QUESTION] Enviando pergunta 2');
console.log('- [INTERVIEW-FINISH] Todas as perguntas respondidas');
console.log('- [FINISH] Entrevista finalizada e removida');