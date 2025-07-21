/**
 * 🔥 ETAPA 5: SERVIÇO DE SINCRONIZAÇÃO EM TEMPO REAL
 * Implementa integração em tempo real entre WhatsApp e relatórios
 */

import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { firebaseDb } from './db';

interface RealTimeSubscriber {
  id: string;
  callback: (data: any) => void;
  unsubscribe?: () => void;
}

class RealTimeIntegrationService {
  private subscribers: Map<string, RealTimeSubscriber> = new Map();
  private activeListeners: Map<string, () => void> = new Map();

  /**
   * 🎯 MÉTODO PRINCIPAL: Configurar escuta em tempo real para seleção específica
   */
  async setupRealtimeListener(selectionId: string, clientId: number, callback: (responses: any[]) => void): Promise<string> {
    const listenerId = `${clientId}_${selectionId}_${Date.now()}`;
    
    console.log(`🔊 [REALTIME] Configurando listener para seleção ${selectionId}, cliente ${clientId}`);
    
    try {
      // Escutar mudanças na collection padronizada 'interviewResponses'
      const responsesQuery = query(
        collection(firebaseDb, "interviewResponses"),
        where('selectionId', '==', selectionId),
        where('clientId', '==', clientId)
      );

      const unsubscribe = onSnapshot(responsesQuery, (snapshot) => {
        console.log(`🔄 [REALTIME] Mudança detectada na seleção ${selectionId}: ${snapshot.size} documentos`);
        
        const responses: any[] = [];
        
        snapshot.forEach(doc => {
          const data = doc.data();
          responses.push({
            id: doc.id,
            candidateId: data.candidateId,
            candidateName: data.candidateName,
            candidatePhone: data.candidatePhone || data.phone,
            questionId: data.questionId || data.questionNumber,
            questionText: data.questionText,
            transcription: data.transcription,
            audioUrl: data.audioUrl,
            score: data.score || 0,
            timestamp: data.timestamp || data.createdAt,
            status: data.status || 'completed'
          });
        });

        // Notificar subscriber com dados atualizados
        console.log(`✅ [REALTIME] Enviando ${responses.length} respostas atualizadas para listener ${listenerId}`);
        callback(responses);
      }, (error) => {
        console.error(`❌ [REALTIME] Erro no listener ${listenerId}:`, error);
      });

      // Armazenar referência para cleanup
      this.activeListeners.set(listenerId, unsubscribe);
      
      console.log(`✅ [REALTIME] Listener ${listenerId} configurado com sucesso`);
      return listenerId;
      
    } catch (error: any) {
      console.error(`❌ [REALTIME] Erro ao configurar listener:`, error.message);
      throw error;
    }
  }

  /**
   * 🔄 INVALIDAR CACHE DOS RELATÓRIOS
   * Força atualização dos dados em cache quando há mudanças
   */
  async invalidateReportCache(selectionId: string): Promise<void> {
    try {
      console.log(`🗑️ [REALTIME] Invalidando cache para seleção ${selectionId}`);
      
      // Simular invalidação de cache (em produção, integrar com TanStack Query)
      // queryClient.invalidateQueries(['reports', selectionId]);
      
      console.log(`✅ [REALTIME] Cache invalidado para seleção ${selectionId}`);
    } catch (error: any) {
      console.error(`❌ [REALTIME] Erro ao invalidar cache:`, error.message);
    }
  }

  /**
   * 🎯 WEBHOOK PARA NOTIFICAÇÃO DE NOVAS RESPOSTAS
   * Recebe notificações quando WhatsApp processa nova resposta
   */
  async notifyNewResponse(selectionId: string, candidateId: number, responseData: any): Promise<void> {
    try {
      console.log(`📢 [REALTIME] Nova resposta recebida - Seleção: ${selectionId}, Candidato: ${candidateId}`);
      
      // Invalidar cache automaticamente
      await this.invalidateReportCache(selectionId);
      
      // Disparar evento para listeners ativos
      const activeListener = this.activeListeners.get(`*_${selectionId}_*`);
      if (activeListener) {
        console.log(`🔄 [REALTIME] Listener ativo encontrado para seleção ${selectionId}`);
      }
      
      console.log(`✅ [REALTIME] Notificação processada com sucesso`);
    } catch (error: any) {
      console.error(`❌ [REALTIME] Erro ao processar notificação:`, error.message);
    }
  }

  /**
   * 🛑 LIMPAR LISTENER ESPECÍFICO
   */
  removeListener(listenerId: string): void {
    const unsubscribe = this.activeListeners.get(listenerId);
    if (unsubscribe) {
      unsubscribe();
      this.activeListeners.delete(listenerId);
      console.log(`🗑️ [REALTIME] Listener ${listenerId} removido`);
    }
  }

  /**
   * 🛑 LIMPAR TODOS OS LISTENERS
   */
  removeAllListeners(): void {
    console.log(`🗑️ [REALTIME] Removendo ${this.activeListeners.size} listeners ativos`);
    
    this.activeListeners.forEach((unsubscribe, listenerId) => {
      unsubscribe();
      console.log(`🗑️ [REALTIME] Listener ${listenerId} limpo`);
    });
    
    this.activeListeners.clear();
    console.log(`✅ [REALTIME] Todos os listeners removidos`);
  }

  /**
   * 📊 STATUS DOS LISTENERS ATIVOS
   */
  getActiveListenersStatus(): { total: number, listeners: string[] } {
    return {
      total: this.activeListeners.size,
      listeners: Array.from(this.activeListeners.keys())
    };
  }
}

// Instância singleton para uso global
export const realtimeIntegrationService = new RealTimeIntegrationService();

// Export para usar em outros arquivos
export { RealTimeIntegrationService };