const { FirebaseStorage } = require('./server/storage');

async function testWhatsAppSend() {
  console.log('🧪 Testando envio WhatsApp - Debug completo');
  
  const storage = new FirebaseStorage();
  
  try {
    // 1. Criar uma seleção de teste
    console.log('📋 Criando seleção de teste...');
    const selectionData = {
      name: "Teste WhatsApp Debug",
      jobId: "1750101952075", // Vaga existente
      candidateListId: 1750273793939, // Lista existente
      whatsappTemplate: "Olá {nome}, teste de envio WhatsApp para vaga {vaga}. Link: {link}",
      sendVia: "whatsapp",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "active",
      clientId: 1749849987543
    };
    
    const selection = await storage.createSelection(selectionData);
    console.log('✅ Seleção criada:', selection.id);
    
    // 2. Buscar candidatos da lista
    console.log('👥 Buscando candidatos da lista...');
    const allMemberships = await storage.getCandidateListMembershipsByClientId(1749849987543);
    const candidateListMembers = allMemberships.filter(member => member.listId === 1750273793939);
    console.log(`📊 Memberships encontrados: ${candidateListMembers.length}`);
    
    // 3. Buscar dados dos candidatos
    const candidateIds = candidateListMembers.map(member => member.candidateId);
    const allCandidates = await storage.getAllCandidates();
    const candidates = allCandidates.filter(candidate => 
      candidateIds.includes(candidate.id) && candidate.clientId === 1749849987543
    );
    console.log(`🎯 Candidatos válidos: ${candidates.length}`);
    
    candidates.forEach(candidate => {
      console.log(`  - ${candidate.name}: ${candidate.whatsapp}`);
    });
    
    // 4. Buscar vaga
    const job = await storage.getJobById("1750101952075");
    console.log(`💼 Vaga: ${job?.nomeVaga} (${job?.perguntas?.length || 0} perguntas)`);
    
    // 5. Simular envio (sem realmente enviar)
    console.log('📱 Simulando envio...');
    for (const candidate of candidates) {
      if (candidate.whatsapp) {
        // Criar entrevista
        const interview = await storage.createInterview({
          candidateId: candidate.id,
          selectionId: selection.id,
          status: 'pending'
        });
        
        const token = `interview_${interview.id}_${Date.now()}`;
        await storage.updateInterview(interview.id, { token });
        
        console.log(`🎤 Entrevista criada para ${candidate.name}: ID ${interview.id}, Token: ${token}`);
      }
    }
    
    console.log('✅ Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testWhatsAppSend();