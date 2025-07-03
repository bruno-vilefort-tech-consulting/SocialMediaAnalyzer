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
      console.log(`🎯 [WHISPER] Processando arquivo: ${audioPath}`);
      
      // Verificar se arquivo existe
      const stats = await fs.stat(audioPath);
      console.log(`📊 [WHISPER] Tamanho do arquivo: ${stats.size} bytes`);
      
      if (stats.size < 1000) {
        throw new Error(`Arquivo muito pequeno: ${stats.size} bytes`);
      }
      
      // Converter arquivo OGG para formato compatível se necessário
      const fileBuffer = await fs.readFile(audioPath);
      
      // Usar FormData nativo do Node.js
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      
      formData.append('file', fileBuffer, {
        filename: path.basename(audioPath).replace('.ogg', '.wav'),
        contentType: 'audio/wav'
      });
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');
      formData.append('response_format', 'text');
      
      console.log(`🌐 [WHISPER] Enviando para OpenAI API...`);
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ OpenAI API Response:`, response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }
      
      const transcription = await response.text();
      console.log(`✅ [WHISPER] Transcrição obtida: "${transcription}"`);
      
      if (transcription && transcription.trim().length > 0) {
        return transcription.trim();
      }
      
      throw new Error('Transcrição vazia');
      
    } catch (error) {
      console.error(`❌ [WHISPER] Erro na transcrição:`, error.message);
      throw error;
    }
  }

  async processComercial3Transcriptions(): Promise<void> {
    console.log('🚀 Processando transcrições pendentes da Comercial 3...');
    
    const selectionId = '1750451676557';
    const candidateId = '1750448249756';
    const phone = '5511984316526';
    
    try {
      // Processar R1
      const audioPath1 = path.join(UPLOADS_DIR, `audio_${phone}_${selectionId}_R1.ogg`);
      console.log(`🎵 Processando áudio 1: ${audioPath1}`);
      
      const transcription1 = await this.transcribeAudioFile(audioPath1);
      console.log(`📝 Transcrição 1 obtida: "${transcription1}"`);
      
      // Buscar e atualizar resposta R1 no Firebase
      const responses = await storage.getResponsesBySelectionAndCandidate(selectionId, parseInt(candidateId), 1749849987543);
      console.log(`📊 Respostas encontradas: ${responses.length}`);
      
      if (responses.length >= 1) {
        try {
          await storage.updateResponse(responses[0].id, {
            transcription: transcription1,
            audioFile: `audio_${phone}_${selectionId}_R1.ogg`
          });
          console.log('✅ Transcrição R1 salva no banco');
        } catch (error) {
          console.log('❌ Erro ao atualizar resposta:', error.message);
          // Salvar diretamente no Firebase
          const { doc, updateDoc } = await import('firebase/firestore');
          const { firebaseDb } = await import('./db');
          await updateDoc(doc(firebaseDb, 'responses', String(responses[0].id)), {
            transcription: transcription1,
            audioFile: `audio_${phone}_${selectionId}_R1.ogg`,
            updatedAt: new Date()
          });
          console.log('✅ Transcrição R1 salva diretamente no Firebase');
        }
      }
      
      // Processar R2
      const audioPath2 = path.join(UPLOADS_DIR, `audio_${phone}_${selectionId}_R2.ogg`);
      console.log(`🎵 Processando áudio 2: ${audioPath2}`);
      
      const transcription2 = await this.transcribeAudioFile(audioPath2);
      console.log(`📝 Transcrição 2 obtida: "${transcription2}"`);
      
      if (responses.length >= 2) {
        try {
          await storage.updateResponse(responses[1].id, {
            transcription: transcription2,
            audioFile: `audio_${phone}_${selectionId}_R2.ogg`
          });
          console.log('✅ Transcrição R2 salva no banco');
        } catch (error) {
          console.log('❌ Erro ao atualizar resposta R2:', error.message);
          // Salvar diretamente no Firebase
          const { doc, updateDoc } = await import('firebase/firestore');
          const { firebaseDb } = await import('./db');
          await updateDoc(doc(firebaseDb, 'responses', String(responses[1].id)), {
            transcription: transcription2,
            audioFile: `audio_${phone}_${selectionId}_R2.ogg`,
            updatedAt: new Date()
          });
          console.log('✅ Transcrição R2 salva diretamente no Firebase');
        }
      }
      
      console.log('🎉 Processamento da Comercial 3 concluído com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro ao processar transcrições:', error.message);
      throw error;
    }
  }

  async processPendingTranscriptions(): Promise<void> {
    console.log('🔍 Buscando áudios pendentes de transcrição...');
    
    try {
      const uploadsDir = 'uploads';
      const files = await fs.readdir(uploadsDir);
      
      // Filtrar arquivos de áudio .ogg
      const audioFiles = files.filter(file => file.endsWith('.ogg') && file.includes('audio_'));
      
      console.log(`📁 Encontrados ${audioFiles.length} arquivos de áudio`);
      
      for (const audioFile of audioFiles) {
        const audioPath = path.join(uploadsDir, audioFile);
        
        // Extrair informações do nome do arquivo: audio_phone_selectionId_RX.ogg
        const parts = audioFile.replace('.ogg', '').split('_');
        if (parts.length >= 4) {
          const phone = parts[1];
          const selectionId = parts[2];
          const questionNum = parts[3].replace('R', '');
          
          console.log(`🎵 Processando: ${audioFile} (Seleção: ${selectionId}, Pergunta: ${questionNum})`);
          
          try {
            const transcription = await this.transcribeAudioFile(audioPath);
            console.log(`✅ Transcrição processada para ${audioFile}`);
            
            // Aqui você pode salvar no banco se necessário
            // Implementar lógica específica baseada no padrão de dados
            
          } catch (error) {
            console.error(`❌ Erro ao processar ${audioFile}:`, error.message);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao buscar arquivos pendentes:', error.message);
    }
  }
}

export const transcriptionService = new TranscriptionService();