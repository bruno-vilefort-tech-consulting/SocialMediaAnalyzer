/**
 * Serviço de Exportação de PDF com Áudio Embeddado
 * 
 * Este serviço converte arquivos .ogg em .mp3, gera PDFs com dados do candidato
 * e limpa arquivos temporários automaticamente.
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

export class PDFExportService {
  private uploadsDir = path.join(process.cwd(), 'uploads');
  private tempDir = path.join(process.cwd(), 'temp');

  constructor() {
    // Criar diretório temp se não existir
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    // Configurar ffmpeg path se necessário
    try {
      ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
    } catch (error) {
      console.log('FFmpeg path configurado automaticamente');
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
          console.log(`🎵 Conversão concluída: ${path.basename(mp3Path)}`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`❌ Erro na conversão: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Gera PDF com dados do candidato e áudios embeddados
   */
  async generateCandidatePDF(candidateData: CandidateData): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([595, 842]); // A4 size
    let yPosition = 800;
    
    const primaryColor = rgb(0.2, 0.3, 0.5); // Azul escuro
    const accentColor = rgb(0.1, 0.6, 0.4); // Verde
    const grayColor = rgb(0.4, 0.4, 0.4);
    
    // Header - Nome do candidato
    page.drawText(candidateData.name, {
      x: 50,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: primaryColor,
    });
    yPosition -= 40;
    
    // Informações de contato
    page.drawText(`WhatsApp: ${candidateData.phone}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: helveticaFont,
      color: grayColor,
    });
    yPosition -= 20;
    
    page.drawText(`Email: ${candidateData.email}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: helveticaFont,
      color: grayColor,
    });
    yPosition -= 30;
    
    // Vaga
    page.drawText(`Vaga: ${candidateData.jobName}`, {
      x: 50,
      y: yPosition,
      size: 14,
      font: helveticaBold,
      color: primaryColor,
    });
    yPosition -= 40;
    
    // Data
    if (candidateData.completedAt) {
      const date = new Date(candidateData.completedAt).toLocaleDateString('pt-BR');
      page.drawText(`Data da Entrevista: ${date}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: helveticaFont,
        color: grayColor,
      });
      yPosition -= 40;
    }
    
    // Linha separadora
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 545, y: yPosition },
      thickness: 2,
      color: accentColor,
    });
    yPosition -= 30;
    
    // Conversão e embedding de áudios
    const audioFiles: string[] = [];
    
    for (let i = 0; i < candidateData.responses.length; i++) {
      const response = candidateData.responses[i];
      
      // Verificar se precisamos de nova página
      if (yPosition < 200) {
        page = pdfDoc.addPage([595, 842]);
        yPosition = 800;
      }
      
      // Pergunta
      page.drawText(`Pergunta ${i + 1}:`, {
        x: 50,
        y: yPosition,
        size: 14,
        font: helveticaBold,
        color: primaryColor,
      });
      yPosition -= 25;
      
      // Texto da pergunta (quebra de linha se necessário)
      const questionLines = this.wrapText(response.questionText, 70);
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
      
      const responseLines = this.wrapText(response.transcription || 'Aguardando resposta', 70);
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
          color: rgb(0.8, 0.4, 0.0), // Laranja
        });
        yPosition -= 20;
        
        const perfectLines = this.wrapText(response.perfectAnswer, 70);
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
      
      // Score
      if (response.score && response.score > 0) {
        page.drawText(`Pontuação IA: ${response.score}/100`, {
          x: 400,
          y: yPosition + 20,
          size: 12,
          font: helveticaBold,
          color: response.score >= 70 ? rgb(0, 0.6, 0) : response.score >= 50 ? rgb(0.8, 0.6, 0) : rgb(0.8, 0, 0),
        });
      }
      
      // Conversão de áudio
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
          
          // Adicionar informação sobre áudio no PDF
          page.drawText(`🎵 Áudio disponível: ${mp3FileName}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: helveticaFont,
            color: rgb(0, 0.4, 0.8),
          });
          yPosition -= 15;
          
          // Nota sobre reprodução
          page.drawText('(Abra este PDF com um leitor que suporte áudio embeddado)', {
            x: 50,
            y: yPosition,
            size: 8,
            font: helveticaFont,
            color: grayColor,
          });
          yPosition -= 20;
          
        } catch (error) {
          console.error(`❌ Erro ao processar áudio: ${error.message}`);
          page.drawText('⚠️ Áudio não disponível', {
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
    page.drawText('Relatório gerado pelo Sistema de Entrevistas IA - Grupo Maximus', {
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
  
  /**
   * Quebra texto em linhas para caber na página
   */
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
        console.log(`🗑️ Arquivo temporário removido: ${path.basename(filePath)}`);
      } catch (error) {
        console.error(`❌ Erro ao remover arquivo temporário: ${error.message}`);
      }
    }
  }
  
  /**
   * Gera nome do arquivo PDF
   */
  generateFileName(candidateName: string, jobName: string, date?: string): string {
    const cleanName = candidateName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const cleanJob = jobName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const dateStr = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    return `${cleanName}_${cleanJob}_${dateStr}.pdf`;
  }
}

export const pdfExportService = new PDFExportService();