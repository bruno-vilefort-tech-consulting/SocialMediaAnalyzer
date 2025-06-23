/**
 * Serviço de exportação HTML com players de áudio funcionais
 * Gera HTML profissional com design responsivo e players nativos
 * Inclui conversão de áudio e criação de ZIP com todos os arquivos
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import ffmpeg from 'fluent-ffmpeg';
import archiver from 'archiver';

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

export class HTMLExportService {
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
      console.log('FFmpeg configurado para HTML export');
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
          console.log(`Audio convertido: ${path.basename(mp3Path)}`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`Erro na conversao: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Gera pacote ZIP completo com HTML e áudios
   */
  async generateCandidatePackage(candidateData: CandidateData): Promise<Buffer> {
    const tempFiles: string[] = [];
    const audioFiles: string[] = [];
    
    try {
      // Converter todos os áudios para MP3
      for (let i = 0; i < candidateData.responses.length; i++) {
        const response = candidateData.responses[i];
        if (response.audioUrl) {
          try {
            const audioFileName = path.basename(response.audioUrl);
            const oggPath = path.join(this.uploadsDir, audioFileName);
            const mp3FileName = `audio_pergunta_${i + 1}.mp3`;
            const mp3Path = path.join(this.tempDir, mp3FileName);
            
            // Verificar se arquivo .ogg existe
            await access(oggPath);
            
            // Converter para mp3
            await this.convertOggToMp3(oggPath, mp3Path);
            audioFiles.push(mp3Path);
            tempFiles.push(mp3Path);
            
            // Atualizar URL no candidateData para apontar para arquivo local
            response.audioUrl = mp3FileName;
            
          } catch (error) {
            console.error(`Erro ao processar audio: ${error.message}`);
            response.audioUrl = undefined;
          }
        }
      }
      
      // Gerar HTML
      const htmlContent = await this.generateCandidateHTML(candidateData);
      const htmlFileName = this.generateFileName(
        candidateData.name, 
        candidateData.jobName, 
        candidateData.completedAt
      );
      const htmlPath = path.join(this.tempDir, htmlFileName);
      
      // Salvar HTML temporariamente
      await writeFile(htmlPath, htmlContent, 'utf8');
      tempFiles.push(htmlPath);
      
      // Criar ZIP
      const zipBuffer = await this.createZipPackage(htmlPath, audioFiles);
      
      return zipBuffer;
      
    } finally {
      // Limpar arquivos temporários
      await this.cleanupTempFiles(tempFiles);
    }
  }

  /**
   * Cria arquivo ZIP com HTML e áudios
   */
  private async createZipPackage(htmlPath: string, audioFiles: string[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });
      
      const chunks: Buffer[] = [];
      
      archive.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      archive.on('end', () => {
        const zipBuffer = Buffer.concat(chunks);
        resolve(zipBuffer);
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
      
      // Adicionar HTML
      archive.file(htmlPath, { name: path.basename(htmlPath) });
      
      // Adicionar áudios
      audioFiles.forEach(audioPath => {
        archive.file(audioPath, { name: path.basename(audioPath) });
      });
      
      archive.finalize();
    });
  }

  async generateCandidateHTML(candidateData: CandidateData): Promise<string> {
    // Calcular pontuação final
    const validScores = candidateData.responses.filter(r => r.score && r.score > 0).map(r => r.score!);
    const finalScore = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;
    
    const date = candidateData.completedAt ? new Date(candidateData.completedAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
    
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Entrevista - ${candidateData.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
            color: white;
            padding: 30px;
            position: relative;
        }
        
        .header h1 {
            font-size: 2.2em;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .final-score {
            position: absolute;
            top: 30px;
            right: 30px;
            background: ${finalScore >= 70 ? '#48bb78' : finalScore >= 50 ? '#ed8936' : '#f56565'};
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-weight: bold;
            font-size: 1.1em;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 20px;
        }
        
        .info-item {
            opacity: 0.9;
        }
        
        .info-label {
            font-size: 0.9em;
            margin-bottom: 5px;
            opacity: 0.8;
        }
        
        .info-value {
            font-weight: 600;
            font-size: 1.1em;
        }
        
        .content {
            padding: 40px;
        }
        
        .question-block {
            background: #f7fafc;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
            border-left: 5px solid #4299e1;
            page-break-inside: avoid;
        }
        
        .question-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
        }
        
        .question-title {
            color: #2d3748;
            font-size: 1.1em;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .question-text {
            color: #4a5568;
            font-size: 1em;
            line-height: 1.6;
        }
        
        .question-score {
            background: ${''};
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9em;
            white-space: nowrap;
        }
        
        .answer-section {
            margin: 20px 0;
        }
        
        .section-title {
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 10px;
            font-size: 0.95em;
        }
        
        .candidate-answer {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
            color: #4a5568;
            line-height: 1.6;
        }
        
        .perfect-answer {
            background: linear-gradient(135deg, #f0fff4 0%, #e6fffa 100%);
            border: 1px solid #68d391;
            border-radius: 8px;
            padding: 15px;
            color: #22543d;
            line-height: 1.6;
        }
        
        .audio-player {
            background: #edf2f7;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
        }
        
        .audio-controls {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 10px;
        }
        
        audio {
            width: 100%;
            height: 40px;
        }
        
        .audio-info {
            font-size: 0.9em;
            color: #4a5568;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .footer {
            background: #f7fafc;
            padding: 20px 40px;
            text-align: center;
            color: #718096;
            font-size: 0.9em;
            border-top: 1px solid #e2e8f0;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
                border-radius: 0;
            }
            
            .question-block {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
        
        @media (max-width: 768px) {
            .info-grid {
                grid-template-columns: 1fr;
                gap: 15px;
            }
            
            .final-score {
                position: relative;
                top: auto;
                right: auto;
                margin-top: 20px;
                text-align: center;
            }
            
            .question-header {
                flex-direction: column;
                gap: 15px;
            }
            
            .content {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${candidateData.name}</h1>
            ${finalScore > 0 ? `<div class="final-score">Pontuação Final: ${finalScore}/100</div>` : ''}
            
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">WhatsApp</div>
                    <div class="info-value">${candidateData.phone}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Vaga</div>
                    <div class="info-value">${candidateData.jobName}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Email</div>
                    <div class="info-value">${candidateData.email}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Data da Entrevista</div>
                    <div class="info-value">${date}</div>
                </div>
            </div>
        </div>
        
        <div class="content">
            ${candidateData.responses.map((response, index) => {
              const scoreColor = response.score && response.score >= 70 ? '#48bb78' : 
                               response.score && response.score >= 50 ? '#ed8936' : '#f56565';
              
              return `
                <div class="question-block">
                    <div class="question-header">
                        <div>
                            <div class="question-title">Pergunta ${index + 1}</div>
                            <div class="question-text">${response.questionText}</div>
                        </div>
                        ${response.score && response.score > 0 ? 
                          `<div class="question-score" style="background: ${scoreColor}">${response.score}/100</div>` : 
                          '<div class="question-score" style="background: #a0aec0">Processando...</div>'
                        }
                    </div>
                    
                    <div class="answer-section">
                        <div class="section-title">Resposta do Candidato</div>
                        <div class="candidate-answer">
                            ${response.transcription || 'Aguardando resposta'}
                        </div>
                    </div>
                    
                    ${response.perfectAnswer ? `
                        <div class="answer-section">
                            <div class="section-title">Resposta Perfeita</div>
                            <div class="perfect-answer">
                                ${response.perfectAnswer}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${response.audioUrl ? `
                        <div class="answer-section">
                            <div class="section-title">Áudio da Resposta</div>
                            <div class="audio-player">
                                <div class="audio-info">
                                    🎵 Player de áudio interativo
                                </div>
                                <audio controls preload="metadata">
                                    <source src="${response.audioUrl}" type="audio/mpeg">
                                    Seu navegador não suporta o elemento de áudio.
                                </audio>
                            </div>
                        </div>
                    ` : ''}
                </div>
              `;
            }).join('')}
        </div>
        
        <div class="footer">
            Relatório gerado pelo Sistema de Entrevistas IA - Grupo Maximus<br>
            Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
        </div>
    </div>
</body>
</html>`;

    return html;
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
    
    return `${cleanName}_${cleanJob}_${dateStr}.html`;
  }

  generateZipFileName(candidateName: string, jobName: string, date?: string): string {
    const cleanName = candidateName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const cleanJob = jobName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const dateStr = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    return `${cleanName}_${cleanJob}_${dateStr}.zip`;
  }
}

export const htmlExportService = new HTMLExportService();