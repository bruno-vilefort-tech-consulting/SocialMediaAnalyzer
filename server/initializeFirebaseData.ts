import { storage } from './storage';
import bcrypt from 'bcrypt';

export async function initializeFirebaseData() {
  try {
    // Verificar se o usuário master já existe
    const existingMaster = await storage.getUserByEmail("daniel@grupomaximuns.com.br");
    if (!existingMaster) {
      // Criar usuário master
      const hashedPassword = await bcrypt.hash("daniel580190", 10);
      await storage.createUser({
        id: "1749848502212",
        email: "daniel@grupomaximuns.com.br",
        password: hashedPassword,
        role: "master",
        name: "Daniel - Grupo Maximus"
      });
    }

    // Verificar se o cliente Grupo Maximus já existe (por CNPJ)
    const allClients = await storage.getClients();
    const existingClient = allClients.find(client => client.cnpj === "05763950000191"); // Modified CNPJ to the correct one
    if (!existingClient) {
      // Criar cliente Grupo Maximus
      await storage.createClient({
        additionalLimit: 0,
        contractStart: new Date()
      });
    }

    // Corrigir senha do Daniel Braga
    const danielBraga = await storage.getUserByEmail("danielmoreirabraga@gmail.com");
    if (danielBraga) {
      const correctHash = await bcrypt.hash("daniel580190", 10);
      await storage.updateUser(parseInt(danielBraga.id.toString()), { password: correctHash });
    }
    const danielUser = await storage.getUserByEmail("danielmoreirabraga@gmail.com");
    if (danielUser && danielUser.password === "580190580190") {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { firebaseDb } = await import('./db');
      
      const hashedPassword = await bcrypt.hash("580190", 10);
      await updateDoc(doc(firebaseDb, 'users', danielUser.id.toString()), {
        password: hashedPassword,
        updatedAt: new Date()
      });
    }

    // Criar vaga de exemplo se não existir
    const jobs = await storage.getJobs();
    if (jobs.length === 0) {
      const client = existingClient || allClients.find(c => c.cnpj === "05763950000191"); //Modified CNPJ to the correct one
      if (client) {
        const job = await storage.createJob({
          clientId: client.id,
          nomeVaga: "Assistente Administrativo",
          descricaoVaga: "Vaga para assistente administrativo com experiência em atendimento ao cliente",
          status: "ativo"
        });

        // Adicionar perguntas à vaga
        const questions = [
          {
            vagaId: job.id,
            perguntaCandidato: "Fale um pouco sobre sua experiência profissional",
            respostaPerfeita: "Candidato deve demonstrar experiência relevante e capacidade de comunicação",
            numeroPergunta: 1
          },
          {
            vagaId: job.id,
            perguntaCandidato: "Por que você tem interesse nesta vaga?",
            respostaPerfeita: "Candidato deve mostrar motivação e alinhamento com a empresa",
            numeroPergunta: 2
          },
          {
            vagaId: job.id,
            perguntaCandidato: "Como você lidaria com um cliente insatisfeito?",
            respostaPerfeita: "Candidato deve demonstrar habilidades de resolução de conflitos e empatia",
            numeroPergunta: 3
          }
        ];

        for (const question of questions) {
          await storage.createQuestion(question);
        }
      }
    }

    // Criar candidato de teste se não existir
    const candidates = await storage.getAllCandidates();
    const testCandidate = candidates.find(c => c.whatsapp === "5511984316526");
    if (!testCandidate) {
      const client = existingClient || allClients.find(c => c.cnpj === "05763950000191"); //Modified CNPJ to the correct one
      if (client) {
        await storage.createCandidate({
          clientId: client.id,
          email: "daniel.moreira@email.com",
          whatsapp: "5511984316526",
          listId: null
        });
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}