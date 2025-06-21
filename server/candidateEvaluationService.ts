/**
 * Serviço de Avaliação de Candidatos usando OpenAI
 * 
 * Este arquivo implementa o sistema de pontuação de respostas de candidatos
 * comparando com a resposta perfeita cadastrada pelo cliente.
 * 
 * Pontuação de 0 a 100 baseada em:
 * - Conteúdo e cobertura dos pontos-chave (70 pontos)
 * - Coerência e clareza (25 pontos) 
 * - Tom e profissionalismo (5 pontos)
 */

import OpenAI from 'openai';

interface EvaluationRequest {
  pergunta: string;
  respostaCandidato: string;
  respostaPerfeita: string;
}

interface EvaluationResult {
  pontuacaoGeral: number; // 0-100
  conteudo: number; // 0-70
  coerencia: number; // 0-25
  tom: number; // 0-5
  feedback?: string;
}

export class CandidateEvaluationService {
  private openai: OpenAI | null = null;

  async initialize(apiKey: string): Promise<void> {
    if (!apiKey) {
      throw new Error('OpenAI API Key é obrigatória para avaliação de candidatos');
    }
    
    this.openai = new OpenAI({ 
      apiKey: apiKey
    });
    
    console.log('✅ [EVALUATION] Serviço de avaliação de candidatos inicializado');
  }

  async evaluateResponse(request: EvaluationRequest): Promise<EvaluationResult> {
    if (!this.openai) {
      throw new Error('Serviço de avaliação não foi inicializado');
    }

    try {
      console.log('🤖 [EVALUATION] Iniciando avaliação de resposta...');
      console.log('📝 [EVALUATION] Pergunta:', request.pergunta.substring(0, 50) + '...');
      console.log('💭 [EVALUATION] Resposta candidato:', request.respostaCandidato.substring(0, 50) + '...');
      console.log('⭐ [EVALUATION] Resposta perfeita:', request.respostaPerfeita.substring(0, 50) + '...');

      const prompt = this.buildEvaluationPrompt(request);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "Você é um avaliador especialista de entrevistas de RH. Analise as respostas de forma objetiva e imparcial."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0 // Temperatura zero para resultados completamente determinísticos
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Resposta vazia da OpenAI');
      }

      console.log('📊 [EVALUATION] Resposta bruta da OpenAI:', content);
      
      const result = this.parseEvaluationResponse(content);
      
      console.log('✅ [EVALUATION] Avaliação concluída:', {
        pontuacaoGeral: result.pontuacaoGeral,
        conteudo: result.conteudo,
        coerencia: result.coerencia,
        tom: result.tom
      });

      return result;

    } catch (error) {
      console.error('❌ [EVALUATION] Erro na avaliação:', error.message);
      
      // Fallback: retorna pontuação neutra em caso de erro
      return this.getFallbackEvaluation();
    }
  }

  private buildEvaluationPrompt(request: EvaluationRequest): string {
    return `Compare a "Resposta do candidato" com a "Resposta perfeita".
Calcule uma pontuação geral de 0 a 100 e notas parciais nos critérios abaixo, usando apenas números inteiros.

Critérios e pesos (total 100):
1. Conteúdo e cobertura dos pontos-chave – 70
   • Verifique se o candidato aborda todos os temas essenciais, apresenta fatos corretos e demonstra entendimento completo da resposta perfeita.

2. Coerência e clareza – 25
   • Avalie a lógica da exposição, a organização das ideias e a facilidade de compreensão, sem contradições ou ambiguidades.

3. Tom e profissionalismo – 5
   • Observe a adequação da linguagem ao contexto da vaga, o respeito e a formalidade do discurso.

Formate a saída exatamente assim em JSON:
{
  "PONTUACAO_GERAL": <0-100>,
  "CONTEUDO": <0-70>,
  "COERENCIA": <0-25>,
  "TOM": <0-5>,
  "FEEDBACK": "Breve análise da resposta (opcional)"
}

### Pergunta
${request.pergunta}

### Resposta perfeita
${request.respostaPerfeita}

### Resposta do candidato
${request.respostaCandidato}`;
  }

  private parseEvaluationResponse(content: string): EvaluationResult {
    try {
      const parsed = JSON.parse(content);
      
      // Validar e normalizar as pontuações
      const pontuacaoGeral = this.validateScore(parsed.PONTUACAO_GERAL || 0, 0, 100);
      const conteudo = this.validateScore(parsed.CONTEUDO || 0, 0, 70);
      const coerencia = this.validateScore(parsed.COERENCIA || 0, 0, 25);
      const tom = this.validateScore(parsed.TOM || 0, 0, 5);

      return {
        pontuacaoGeral,
        conteudo,
        coerencia,
        tom,
        feedback: parsed.FEEDBACK || ''
      };

    } catch (parseError) {
      console.error('❌ [EVALUATION] Erro ao parsear resposta JSON:', parseError.message);
      console.error('📄 [EVALUATION] Conteúdo recebido:', content);
      
      return this.getFallbackEvaluation();
    }
  }

  private validateScore(score: any, min: number, max: number): number {
    const numScore = parseInt(score);
    if (isNaN(numScore)) return min;
    return Math.max(min, Math.min(max, numScore));
  }

  private getFallbackEvaluation(): EvaluationResult {
    console.log('⚠️ [EVALUATION] Usando avaliação fallback');
    return {
      pontuacaoGeral: 50,
      conteudo: 35,
      coerencia: 12,
      tom: 3,
      feedback: 'Avaliação automática indisponível'
    };
  }

  /**
   * Processa avaliação de uma resposta individual durante a entrevista
   */
  async evaluateInterviewResponse(
    interviewId: string,
    questionText: string,
    candidateResponse: string,
    perfectAnswer: string,
    openaiApiKey: string
  ): Promise<number> {
    try {
      // Inicializar serviço se necessário
      if (!this.openai) {
        await this.initialize(openaiApiKey);
      }

      const evaluation = await this.evaluateResponse({
        pergunta: questionText,
        respostaCandidato: candidateResponse,
        respostaPerfeita: perfectAnswer
      });

      console.log(`📊 [EVALUATION] Entrevista ${interviewId} - Pontuação: ${evaluation.pontuacaoGeral}/100`);
      
      return evaluation.pontuacaoGeral;

    } catch (error) {
      console.error(`❌ [EVALUATION] Erro na avaliação da entrevista ${interviewId}:`, error.message);
      return 50; // Pontuação neutra em caso de erro
    }
  }
}

// Instância singleton do serviço
export const candidateEvaluationService = new CandidateEvaluationService();