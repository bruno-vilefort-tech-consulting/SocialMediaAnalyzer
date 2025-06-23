/**
 * Serviço simplificado de exportação PDF
 * Versão sem conversão de áudio para evitar problemas de encoding
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';

interface CandidateData {
  name: string;
  email: string;
  phone: string;
  jobName: string;
  responses: Array<{
    questionText: string;
    transcription: string;
    score?: number;
    perfectAnswer?: string;
  }>;
  completedAt?: string;
}

export class SimplePDFService {
  
  async generateCandidatePDF(candidateData: CandidateData): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([595, 842]); // A4 size
    let yPosition = 800;
    
    const primaryColor = rgb(0.2, 0.3, 0.5);
    const accentColor = rgb(0.1, 0.6, 0.4);
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
    
    // Perguntas e respostas
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
          color: rgb(0.8, 0.4, 0.0),
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
        page.drawText(`Pontuacao IA: ${response.score}/100`, {
          x: 400,
          y: yPosition + 20,
          size: 12,
          font: helveticaBold,
          color: response.score >= 70 ? rgb(0, 0.6, 0) : response.score >= 50 ? rgb(0.8, 0.6, 0) : rgb(0.8, 0, 0),
        });
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
  
  generateFileName(candidateName: string, jobName: string, date?: string): string {
    const cleanName = candidateName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const cleanJob = jobName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const dateStr = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    return `${cleanName}_${cleanJob}_${dateStr}.pdf`;
  }
}

export const simplePdfService = new SimplePDFService();