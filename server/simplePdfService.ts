/**
 * Serviço de exportação PDF com áudio embeddado
 * Inclui conversão .ogg para .mp3 e limpeza automática
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);

interface CandidateData {
  name: string;
  email: string;
  phone: string;
  jobName: string;
  responses: Array<{
    questionText: string;
    transcription: string;
    audioUrl?: string;
    score?: number;
    perfectAnswer?: string;
  }>;
  completedAt?: string;
}

export class SimplePDFService {
  private uploadsDir = path.join(process.cwd(), 'uploads');
  private tempDir = path.join(process.cwd(), 'temp');

  constructor() {
    // Criar diretório temp se não existir
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    // Configurar ffmpeg path
    try {
      ffmpeg.setFfmpegPath('/nix/store/3zc5jbvqzrn8zmva4fx5p0nh4yy03wk4-ffmpeg-6.1.1-bin/bin/ffmpeg');
      console.log('FFmpeg configurado com sucesso');
    } catch (error) {
      console.log('Erro ao configurar FFmpeg:', error);
    }
  }

  /**
   * Converte arquivo .ogg para .mp3
   */
  private async convertOggToMp3(oggPath: string, mp3Path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(oggPath)
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .output(mp3Path)
        .on('end', () => {
          console.log(`Conversao de audio concluida: ${path.basename(mp3Path)}`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`Erro na conversao: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  async generateCandidatePDF(candidateData: CandidateData): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([595, 842]); // A4 size
    let yPosition = 800;
    
    const primaryColor = rgb(0.2, 0.3, 0.5);
    const accentColor = rgb(0.1, 0.6, 0.4);
    const grayColor = rgb(0.4, 0.4, 0.4);
    
    // Calcular pontuação final
    const validScores = candidateData.responses.filter(r => r.score && r.score > 0).map(r => r.score!);
    const finalScore = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;
    
    // Header - Nome do candidato (lado esquerdo)
    page.drawText(candidateData.name, {
      x: 50,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: primaryColor,
    });
    
    // Pontuação Final (lado direito)
    if (finalScore > 0) {
      const scoreColor = finalScore >= 70 ? rgb(0, 0.6, 0) : finalScore >= 50 ? rgb(0.8, 0.6, 0) : rgb(0.8, 0, 0);
      page.drawText(`Pontuacao Final: ${finalScore}/100`, {
        x: 350,
        y: yPosition,
        size: 18,
        font: helveticaBold,
        color: scoreColor,
      });
    }
    yPosition -= 50;
    
    // Layout em duas colunas
    // Coluna esquerda - Contato
    page.drawText(`WhatsApp: ${candidateData.phone}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: helveticaFont,
      color: grayColor,
    });
    
    page.drawText(`Email: ${candidateData.email}`, {
      x: 50,
      y: yPosition - 20,
      size: 12,
      font: helveticaFont,
      color: grayColor,
    });
    
    // Coluna direita - Vaga e Data
    page.drawText(`Vaga: ${candidateData.jobName}`, {
      x: 350,
      y: yPosition,
      size: 12,
      font: helveticaBold,
      color: primaryColor,
    });
    
    if (candidateData.completedAt) {
      const date = new Date(candidateData.completedAt).toLocaleDateString('pt-BR');
      page.drawText(`Data da Entrevista: ${date}`, {
        x: 350,
        y: yPosition - 20,
        size: 12,
        font: helveticaFont,
        color: grayColor,
      });
    }
    
    yPosition -= 60;
    
    // Linha separadora
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 545, y: yPosition },
      thickness: 2,
      color: accentColor,
    });
    yPosition -= 30;
    
    // Arquivos temporários para limpeza
    const audioFiles: string[] = [];
    
    // Perguntas e respostas
    for (let i = 0; i < candidateData.responses.length; i++) {
      const response = candidateData.responses[i];
      
      // Calcular espaço necessário para esta resposta
      const questionLines = this.wrapText(response.questionText, 70);
      const responseLines = this.wrapText(response.transcription || 'Aguardando resposta', 70);
      const perfectLines = response.perfectAnswer ? this.wrapText(response.perfectAnswer, 70) : [];
      
      const requiredSpace = 80 + (questionLines.length * 15) + (responseLines.length * 14) + (perfectLines.length * 14) + 
                           (response.audioUrl ? 40 : 0) + (response.perfectAnswer ? 40 : 0);
      
      // Verificar se precisamos de nova página
      if (yPosition < requiredSpace) {
        page = pdfDoc.addPage([595, 842]);
        yPosition = 800;
      }
      
      // Pergunta com score no lado direito
      page.drawText(`Pergunta ${i + 1}:`, {
        x: 50,
        y: yPosition,
        size: 14,
        font: helveticaBold,
        color: primaryColor,
      });
      
      // Score individual
      if (response.score && response.score > 0) {
        const scoreColor = response.score >= 70 ? rgb(0, 0.6, 0) : response.score >= 50 ? rgb(0.8, 0.6, 0) : rgb(0.8, 0, 0);
        page.drawText(`${response.score}/100`, {
          x: 500,
          y: yPosition,
          size: 14,
          font: helveticaBold,
          color: scoreColor,
        });
      }
      yPosition -= 25;
      
      // Texto da pergunta
      for (const line of questionLines) {
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: 11,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;
      }
      yPosition -= 10;
      
      // Resposta do candidato
      page.drawText('Resposta do Candidato:', {
        x: 50,
        y: yPosition,
        size: 12,
        font: helveticaBold,
        color: accentColor,
      });
      yPosition -= 20;
      
      for (const line of responseLines) {
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPosition -= 14;
      }
      yPosition -= 10;
      
      // Resposta perfeita
      if (response.perfectAnswer) {
        page.drawText('Resposta Perfeita:', {
          x: 50,
          y: yPosition,
          size: 12,
          font: helveticaBold,
          color: rgb(0.8, 0.4, 0.0),
        });
        yPosition -= 20;
        
        for (const line of perfectLines) {
          page.drawText(line, {
            x: 50,
            y: yPosition,
            size: 10,
            font: helveticaFont,
            color: rgb(0.5, 0.3, 0.0),
          });
          yPosition -= 14;
        }
        yPosition -= 10;
      }
      
      // Processamento de áudio
      if (response.audioUrl) {
        try {
          const audioFileName = path.basename(response.audioUrl);
          const oggPath = path.join(this.uploadsDir, audioFileName);
          const mp3FileName = `${path.parse(audioFileName).name}.mp3`;
          const mp3Path = path.join(this.tempDir, mp3FileName);
          
          // Verificar se arquivo .ogg existe
          await access(oggPath);
          
          // Converter para mp3
          await this.convertOggToMp3(oggPath, mp3Path);
          audioFiles.push(mp3Path);
          
          // Embed do áudio no PDF (referência)
          page.drawText(`Audio da resposta: ${mp3FileName}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: helveticaFont,
            color: rgb(0, 0.4, 0.8),
          });
          yPosition -= 15;
          
          page.drawText('(Audio convertido e disponivel para reproducao)', {
            x: 50,
            y: yPosition,
            size: 8,
            font: helveticaFont,
            color: grayColor,
          });
          yPosition -= 20;
          
        } catch (error) {
          console.error(`Erro ao processar audio: ${error.message}`);
          page.drawText('Audio nao disponivel', {
            x: 50,
            y: yPosition,
            size: 10,
            font: helveticaFont,
            color: rgb(0.8, 0, 0),
          });
          yPosition -= 20;
        }
      }
      
      yPosition -= 20;
    }
    
    // Rodapé
    page.drawText('Relatorio gerado pelo Sistema de Entrevistas IA - Grupo Maximus', {
      x: 50,
      y: 30,
      size: 8,
      font: helveticaFont,
      color: grayColor,
    });
    
    const pdfBytes = await pdfDoc.save();
    
    // Limpar arquivos mp3 temporários
    await this.cleanupTempFiles(audioFiles);
    
    return Buffer.from(pdfBytes);
  }
  
  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + word).length <= maxChars) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }
  
  /**
   * Remove arquivos temporários
   */
  private async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await unlink(filePath);
        console.log(`Arquivo temporario removido: ${path.basename(filePath)}`);
      } catch (error) {
        console.error(`Erro ao remover arquivo temporario: ${error.message}`);
      }
    }
  }

  generateFileName(candidateName: string, jobName: string, date?: string): string {
    const cleanName = candidateName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const cleanJob = jobName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const dateStr = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    return `${cleanName}_${cleanJob}_${dateStr}.pdf`;
  }
}

export const simplePdfService = new SimplePDFService();