import { OpenAI } from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import { storage } from './storage.js';
import { UPLOADS_DIR } from '../src/config/paths';

export class TranscriptionService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  async transcribeAudioFile(audioPath: string): Promise<string> {
    try {
      // Verificar se arquivo existe
      const stats = await fs.stat(audioPath);
      
      if (stats.size < 1000) {
        throw new Error(`Arquivo muito pequeno: ${stats.size} bytes`);
      }
      
      // Usar OpenAI SDK para transcrição
      const transcriptionResult = await this.openai.audio.transcriptions.create({
        file: require('fs').createReadStream(audioPath),
        model: 'whisper-1',
        language: 'pt',
        response_format: 'text'
      });
      
      if (transcriptionResult && transcriptionResult.trim().length > 0) {
        return transcriptionResult.trim();
      }
      
      throw new Error('Transcrição vazia');
      
    } catch (error) {
      throw error;
    }
  }

  async processComercial3Transcriptions(): Promise<void> {
    const selectionId = '1750451676557';
    const candidateId = '1750448249756';
    const phone = '5511984316526';
    
    try {
      // Processar R1
      const audioPath1 = path.join(UPLOADS_DIR, `audio_${phone}_${selectionId}_R1.ogg`);
      
      const transcription1 = await this.transcribeAudioFile(audioPath1);
      
      // Buscar e atualizar resposta R1 no Firebase
      const responses = await storage.getResponsesBySelectionAndCandidate(selectionId, parseInt(candidateId), 1749849987543);
      
      if (responses.length >= 1) {
        try {
          await storage.updateResponse(responses[0].id, {
            transcription: transcription1,
            audioFile: `audio_${phone}_${selectionId}_R1.ogg`
          });
        } catch (error) {
          // Salvar diretamente no Firebase
          const { doc, updateDoc } = await import('firebase/firestore');
          const { firebaseDb } = await import('./db');
          await updateDoc(doc(firebaseDb, 'responses', String(responses[0].id)), {
            transcription: transcription1,
            audioFile: `audio_${phone}_${selectionId}_R1.ogg`,
            updatedAt: new Date()
          });
        }
      }
      
      // Processar R2
      const audioPath2 = path.join(UPLOADS_DIR, `audio_${phone}_${selectionId}_R2.ogg`);
      
      const transcription2 = await this.transcribeAudioFile(audioPath2);
      
      if (responses.length >= 2) {
        try {
          await storage.updateResponse(responses[1].id, {
            transcription: transcription2,
            audioFile: `audio_${phone}_${selectionId}_R2.ogg`
          });
        } catch (error) {
          // Salvar diretamente no Firebase
          const { doc, updateDoc } = await import('firebase/firestore');
          const { firebaseDb } = await import('./db');
          await updateDoc(doc(firebaseDb, 'responses', String(responses[1].id)), {
            transcription: transcription2,
            audioFile: `audio_${phone}_${selectionId}_R2.ogg`,
            updatedAt: new Date()
          });
        }
      }
      
    } catch (error) {
      throw error;
    }
  }

  async processPendingTranscriptions(): Promise<void> {
    try {
      const uploadsDir = 'uploads';
      const files = await fs.readdir(uploadsDir);
      
      // Filtrar arquivos de áudio .ogg
      const audioFiles = files.filter(file => file.endsWith('.ogg') && file.includes('audio_'));
      
      for (const audioFile of audioFiles) {
        const audioPath = path.join(uploadsDir, audioFile);
        
        // Extrair informações do nome do arquivo: audio_phone_selectionId_RX.ogg
        const parts = audioFile.replace('.ogg', '').split('_');
        if (parts.length >= 4) {
          const phone = parts[1];
          const selectionId = parts[2];
          const questionNum = parts[3].replace('R', '');
          
          try {
            const transcription = await this.transcribeAudioFile(audioPath);
            
            // Aqui você pode salvar no banco se necessário
            // Implementar lógica específica baseada no padrão de dados
            
          } catch (error) {
            // Audio processing error handled silently
          }
        }
      }
      
    } catch (error) {
      // Error handled silently
    }
  }
}

export const transcriptionService = new TranscriptionService();