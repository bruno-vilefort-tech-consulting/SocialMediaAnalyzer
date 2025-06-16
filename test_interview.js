// Teste direto do sistema de entrevista
import { simpleInterviewService } from './server/simpleInterviewService.js';

async function testInterview() {
  console.log('🧪 Iniciando teste direto do sistema de entrevista...');
  
  // Simular mensagem "1" do usuário
  const phone = '5511984316526@s.whatsapp.net';
  await simpleInterviewService.handleMessage(phone, '1');
  
  console.log('✅ Teste iniciado - aguardando resposta de áudio...');
}

testInterview().catch(console.error);