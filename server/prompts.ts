// Sistema de Prompts para IA - Entrevistas Automatizadas
// Organizado por categoria e situação de uso

export const PROMPTS = {
  // Prompts para Entrevistas Naturais
  INTERVIEW: {
    // Prompt principal para conduzir entrevista natural
    NATURAL_INTERVIEWER: `Você é Ana, entrevistadora do Grupo Maximus, conduzindo uma entrevista por voz. Mantenha conversa natural e fluida:

PERSONALIDADE: Calorosa, profissional, empática

REGRAS CRÍTICAS:
- SEMPRE confirme que ouviu a resposta do candidato antes de continuar
- Use frases curtas de confirmação: "Entendo", "Perfeito", "Ótimo", "Certo"
- Após confirmar, faça transição suave para próxima pergunta
- JAMAIS repita a mesma pergunta já feita
- Mantenha memória de toda a conversa anterior
- Use nome do candidato para criar conexão pessoal
- Respostas concisas (máximo 2 frases)

FLUXO OBRIGATÓRIO:
1. Primeira interação: Cumprimento + primeira pergunta
2. Para cada resposta: Confirmação + feedback + próxima pergunta
3. Última pergunta: Confirmação + fechamento caloroso
4. SEMPRE progresse linearmente pelas perguntas

EXEMPLO DE PROGRESSÃO:
Candidato: "São Paulo"
Você: "Perfeito! E o que você mais espera da nossa empresa?"

NUNCA repita perguntas - sempre avance na sequência.`,

    // Prompt para iniciar entrevista
    GREETING: (candidateName: string, jobTitle: string) => 
      `Olá ${candidateName}! Muito prazer, eu sou a Ana, entrevistadora do Grupo Maximus. Que bom ter você aqui conosco para conversarmos sobre a vaga de ${jobTitle}. Como você está hoje?`,

    // Prompt para finalizar entrevista
    CLOSING: (candidateName: string, companyName: string = 'empresa') => 
      `${candidateName}, foi um verdadeiro prazer conversar com você! Suas respostas foram muito interessantes e mostram seu potencial. Em breve a ${companyName} entrará em contato para comunicar o resultado da sua entrevista. Tenha um excelente dia e muito obrigado pela sua participação!`,

    // Prompts para diferentes tipos de transição
    TRANSITIONS: {
      POSITIVE_FEEDBACK: [
        "Excelente resposta! Isso mostra muito sobre sua experiência.",
        "Muito interessante! Gosto da sua perspectiva sobre isso.",
        "Perfeito! Essa é exatamente o tipo de atitude que procuramos.",
        "Ótima colocação! Suas experiências são muito relevantes.",
        "Muito bem! Sua resposta demonstra grande maturidade profissional."
      ],
      NEXT_QUESTION: [
        "Agora gostaria de saber sobre...",
        "Vamos para a próxima pergunta:",
        "Outra questão importante é:",
        "Também é importante entender:",
        "Gostaria de conhecer sua opinião sobre:"
      ],
      CLARIFICATION: [
        "Entendi perfeitamente. Poderia me falar mais sobre...",
        "Interessante! E em relação a...",
        "Compreendo. Como você vê a questão de...",
        "Muito claro! E quando se trata de..."
      ]
    }
  },

  // Prompts para Análise de Respostas
  ANALYSIS: {
    // Prompt para avaliar resposta individual
    EVALUATE_RESPONSE: (question: string, idealAnswer: string, candidateAnswer: string) =>
      `Analise a resposta do candidato para esta pergunta de entrevista:

PERGUNTA: ${question}
RESPOSTA IDEAL ESPERADA: ${idealAnswer}
RESPOSTA DO CANDIDATO: ${candidateAnswer}

Avalie a resposta considerando:
1. Relevância e adequação ao cargo
2. Clareza e organização da resposta
3. Experiência e conhecimento demonstrados
4. Atitude e motivação
5. Alinhamento com a resposta ideal

Forneça uma pontuação de 0 a 10 e um breve comentário explicativo em formato JSON:
{
  "score": number,
  "feedback": "comentário detalhado",
  "strengths": ["pontos fortes"],
  "improvements": ["áreas de melhoria"]
}`,

    // Prompt para análise geral da entrevista
    OVERALL_ASSESSMENT: (candidateName: string, jobTitle: string, responses: any[]) =>
      `Faça uma análise completa da entrevista do candidato ${candidateName} para a vaga de ${jobTitle}.

RESPOSTAS AVALIADAS:
${responses.map((r, i) => `${i + 1}. Pergunta: ${r.question}\nResposta: ${r.answer}\nPontuação: ${r.score}/10`).join('\n\n')}

Forneça uma avaliação geral em formato JSON:
{
  "overallScore": number,
  "summary": "resumo executivo da entrevista",
  "recommendation": "recomendação de contratação",
  "keyStrengths": ["principais pontos fortes"],
  "developmentAreas": ["áreas de desenvolvimento"],
  "culturalFit": "análise de fit cultural",
  "nextSteps": "próximos passos recomendados"
}`
  },

  // Prompts para Diferentes Tipos de Vaga
  JOB_SPECIFIC: {
    TECHNICAL: {
      INTRODUCTION: "Como assistente especializado em vagas técnicas, vou focar em suas habilidades, experiência com tecnologias e capacidade de resolução de problemas.",
      FOLLOW_UP: "Baseado na sua resposta, gostaria de entender melhor seus conhecimentos técnicos..."
    },
    SALES: {
      INTRODUCTION: "Vou avaliar suas habilidades de comunicação, persuasão e relacionamento com clientes.",
      FOLLOW_UP: "Interessante! Como você aplicaria essa abordagem em uma situação de venda..."
    },
    MANAGEMENT: {
      INTRODUCTION: "Focaremos em sua experiência de liderança, gestão de equipes e tomada de decisões.",
      FOLLOW_UP: "Excelente exemplo! Como você lidaria com conflitos de equipe nessa situação..."
    },
    CUSTOMER_SERVICE: {
      INTRODUCTION: "Vamos avaliar suas habilidades de atendimento, empatia e resolução de problemas.",
      FOLLOW_UP: "Muito bem! Como você manteria a qualidade do atendimento sob pressão..."
    }
  },

  // Prompts para Situações Especiais
  SPECIAL_SITUATIONS: {
    // Quando candidato não responde claramente
    UNCLEAR_RESPONSE: "Entendi. Poderia elaborar um pouco mais sobre esse ponto? Gostaria de entender melhor sua experiência.",
    
    // Quando candidato foge do tema
    REDIRECT: "Interessante perspectiva! Voltando à questão anterior, gostaria que você focasse especificamente em...",
    
    // Quando candidato demonstra nervosismo
    REASSURANCE: "Relaxe, você está indo muito bem! Esta é uma conversa informal para nos conhecermos melhor. Vamos continuar?",
    
    // Quando há problemas técnicos
    TECHNICAL_ISSUE: "Parece que tivemos um pequeno problema técnico. Não se preocupe, vamos continuar de onde paramos.",
    
    // Tempo limite da entrevista
    TIME_LIMIT: "Nosso tempo está chegando ao fim, mas você teve um excelente desempenho! Vamos finalizar com uma última pergunta."
  }
};

// Função utilitária para buscar prompts
export function getPrompt(category: string, type: string, ...args: any[]): string {
  const prompt = PROMPTS[category as keyof typeof PROMPTS]?.[type as any];
  
  if (typeof prompt === 'function') {
    return prompt(...args);
  }
  
  if (typeof prompt === 'string') {
    return prompt;
  }
  
  console.warn(`Prompt não encontrado: ${category}.${type}`);
  return '';
}

// Função para prompts aleatórios
export function getRandomPrompt(category: string, type: string): string {
  const prompts = PROMPTS[category as keyof typeof PROMPTS]?.[type as any];
  
  if (Array.isArray(prompts)) {
    return prompts[Math.floor(Math.random() * prompts.length)];
  }
  
  return getPrompt(category, type);
}

export default PROMPTS;