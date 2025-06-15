import { simpleInterviewService } from './server/simpleInterviewService.ts';

async function testarBuscaJacqueline() {
  console.log('🧪 Testando busca da candidata Jacqueline...');
  
  // Simular o método findCandidate
  const phone = '5511994640330';
  
  try {
    // O mesmo teste que o SimpleInterviewService faria
    const { storage } = await import('./server/storage.ts');
    const candidates = await storage.getAllCandidates();
    
    console.log(`📋 Total de candidatos: ${candidates.length}`);
    
    candidates.forEach(c => {
      const candidateWhatsApp = c.whatsapp;
      const candidatePhone = c.phone;
      console.log(`📱 Candidato: ${c.name} - WhatsApp: ${candidateWhatsApp} - Phone: ${candidatePhone}`);
    });
    
    const candidate = candidates.find(c => {
      const candidateWhatsApp = c.whatsapp;
      const candidatePhone = c.phone;
      
      if (!candidateWhatsApp && !candidatePhone) return false;
      
      const searchPhone = phone.replace(/\D/g, '');
      
      if (candidateWhatsApp) {
        const normalizedWhatsApp = candidateWhatsApp.replace(/\D/g, '');
        console.log(`🔍 Comparando WhatsApp: ${normalizedWhatsApp} com ${searchPhone}`);
        if (normalizedWhatsApp === searchPhone) return true;
      }
      
      if (candidatePhone) {
        const normalizedPhone = candidatePhone.replace(/\D/g, '');
        console.log(`🔍 Comparando Phone: ${normalizedPhone} com ${searchPhone}`);
        if (normalizedPhone === searchPhone) return true;
      }
      
      return false;
    });
    
    if (candidate) {
      console.log(`✅ SUCESSO: Candidato encontrado - ${candidate.name}`);
    } else {
      console.log(`❌ FALHOU: Nenhum candidato encontrado para ${phone}`);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testarBuscaJacqueline();