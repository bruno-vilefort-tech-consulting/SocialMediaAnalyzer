/**
 * Serviço de comparação de respostas usando OpenAI
 * 
 * Este arquivo contém o serviço responsável por comparar as respostas dos candidatos
 * com as respostas perfeitas cadastradas pelo cliente usando a API do ChatGPT.
 * 
 * O sistema recebe:
 * - Pergunta original
 * - Resposta do candidato (transcrição do áudio)
 * - Resposta perfeita cadastrada pelo cliente
 * 
 * E retorna uma nota de 0% a 100% para cada pergunta individual.
 */

import { storage } from './storage';

interface ComparisonRequest {
  question: string;
  candidateAnswer: string;
  perfectAnswer: string;
}

interface ComparisonResult {
  score: number; // 0-100
  feedback: string;
  similarities: string[];
  differences: string[];
}

export class AIComparisonService {
  private openaiApiKey: string | null = null;

  async initialize(): Promise<void> {
    try {
      const config = await storage.getMasterSettings();
      this.openaiApiKey = config?.openaiApiKey || null;
    } catch (error) {
      // Error handled silently
    }
  }

  async compareAnswers(request: ComparisonRequest): Promise<ComparisonResult> {
    if (!this.openaiApiKey) {
      await this.initialize();
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key não configurada');
      }
    }

    try {
      const prompt = this.buildComparisonPrompt(request);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'Você é um especialista em avaliação de respostas de entrevistas. Analise as respostas com base nos critérios fornecidos e retorne sempre um JSON válido.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('Resposta vazia da OpenAI API');
      }

      return this.parseAIResponse(content);
      
    } catch (error) {
      // Fallback: análise simples baseada em palavras-chave
      return this.fallbackComparison(request);
    }
  }

  private buildComparisonPrompt(request: ComparisonRequest): string {
    return `
Analise a resposta do candidato comparando com a resposta perfeita para a seguinte pergunta:

PERGUNTA: "${request.question}"

RESPOSTA PERFEITA (referência): "${request.perfectAnswer}"

RESPOSTA DO CANDIDATO: "${request.candidateAnswer}"

Critérios de avaliação:
1. Conteúdo relevante e precisão técnica (40%)
2. Estrutura e organização da resposta (20%) 
3. Exemplos práticos e experiência demonstrada (20%)
4. Completude da resposta (20%)

Retorne APENAS um JSON válido no seguinte formato:
{
  "score": número_de_0_a_100,
  "feedback": "análise_detalhada_da_resposta",
  "similarities": ["ponto_similar_1", "ponto_similar_2"],
  "differences": ["diferença_1", "diferença_2"]
}

Seja objetivo e construtivo na análise. O score deve refletir a qualidade geral da resposta comparada à referência.
`;
  }

  private parseAIResponse(content: string): ComparisonResult {
    try {
      // Tentar extrair JSON da resposta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON não encontrado na resposta');
      }

      const result = JSON.parse(jsonMatch[0]);
      
      // Validar estrutura
      if (typeof result.score !== 'number' || result.score < 0 || result.score > 100) {
        throw new Error('Score inválido');
      }

      return {
        score: Math.round(result.score),
        feedback: result.feedback || 'Análise não disponível',
        similarities: Array.isArray(result.similarities) ? result.similarities : [],
        differences: Array.isArray(result.differences) ? result.differences : []
      };
      
    } catch (error) {
      throw new Error('Resposta da AI inválida');
    }
  }

  private fallbackComparison(request: ComparisonRequest): ComparisonResult {
    // Análise simples baseada em palavras-chave como fallback
    const candidateWords = request.candidateAnswer.toLowerCase().split(/\s+/);
    const perfectWords = request.perfectAnswer.toLowerCase().split(/\s+/);
    
    const commonWords = candidateWords.filter(word => 
      perfectWords.includes(word) && word.length > 3
    );
    
    const similarity = commonWords.length / Math.max(perfectWords.length, 1);
    const score = Math.min(100, Math.round(similarity * 100));
    
    return {
      score,
      feedback: 'Análise automática baseada em similaridade de palavras-chave.',
      similarities: commonWords.slice(0, 3),
      differences: ['Análise detalhada não disponível no momento']
    };
  }

  async analyzeAllResponses(interviewId: string): Promise<void> {
    try {
      const interviewIdNum = parseInt(interviewId);
      
      // Buscar entrevista e respostas
      const interview = await storage.getInterviewById(interviewIdNum);
      if (!interview) {
        throw new Error('Entrevista não encontrada');
      }

      const responses = await storage.getResponsesByInterviewId(interviewIdNum);
      if (!responses || responses.length === 0) {
        return;
      }

      // Buscar perguntas da vaga
      const selection = await storage.getSelectionById(interview.selectionId);
      if (!selection) {
        throw new Error('Seleção não encontrada');
      }

      const job = await storage.getJobById(selection.jobId);
      if (!job || !job.perguntas) {
        throw new Error('Vaga ou perguntas não encontradas');
      }

      let totalScore = 0;
      let validResponses = 0;

      // Analisar cada resposta
      for (const response of responses) {
        try {
          const questionIndex = response.questionId - 1;
          const question = job.perguntas[questionIndex];
          
          if (!question || !response.transcription) {
            continue;
          }

          const comparison = await this.compareAnswers({
            question: question.pergunta,
            candidateAnswer: response.transcription,
            perfectAnswer: question.respostaPerfeita
          });

          // Atualizar resposta com análise AI
          await storage.updateResponse(response.id, {
            score: comparison.score,
            aiAnalysis: {
              feedback: comparison.feedback,
              similarities: comparison.similarities,
              differences: comparison.differences,
              analyzedAt: new Date().toISOString()
            }
          });

          totalScore += comparison.score;
          validResponses++;
          
        } catch (error) {
          // Error analyzing individual response handled silently
        }
      }

      // Calcular e salvar score total
      if (validResponses > 0) {
        const finalScore = Math.round(totalScore / validResponses);
        
        await storage.updateInterview(interviewIdNum, {
          totalScore: finalScore,
          completedAt: new Date(),
          status: 'completed'
        });
      }
      
    } catch (error) {
      // Error analyzing interview handled silently
    }
  }
}

export const aiComparisonService = new AIComparisonService();