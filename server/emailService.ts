import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  candidateName?: string;
  jobTitle?: string;
}

export class EmailService {
  async sendEmail(emailData: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY não configurada');
      }

      const result = await resend.emails.send({
        from: 'Sistema de Entrevistas <noreply@resend.dev>', // Usar domínio padrão do Resend para testes
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
      });

      console.log(`✅ Email enviado com sucesso para ${emailData.to}:`, result.data?.id);
      
      return {
        success: true,
        messageId: result.data?.id
      };

    } catch (error: any) {
      console.error('❌ Erro ao enviar email:', error);
      
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao enviar email'
      };
    }
  }

  async sendInterviewInvite(data: {
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
    interviewLink: string;
    customMessage?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    
    const defaultMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Convite para Entrevista</h2>
        
        <p>Olá <strong>${data.candidateName}</strong>,</p>
        
        <p>Você foi selecionado(a) para participar do processo seletivo para a vaga de <strong>${data.jobTitle}</strong>.</p>
        
        <p>Para realizar sua entrevista por voz, clique no link abaixo:</p>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${data.interviewLink}" 
             style="background-color: #0079F2; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Iniciar Entrevista
          </a>
        </div>
        
        <p><strong>Instruções importantes:</strong></p>
        <ul>
          <li>A entrevista é realizada por voz através do navegador</li>
          <li>Certifique-se de estar em um ambiente silencioso</li>
          <li>Teste seu microfone antes de começar</li>
          <li>A entrevista tem duração aproximada de 15 minutos</li>
        </ul>
        
        <p>Link direto: <a href="${data.interviewLink}">${data.interviewLink}</a></p>
        
        <p>Boa sorte!</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          Este é um email automático do Sistema de Entrevistas por Voz.
        </p>
      </div>
    `;

    const htmlContent = data.customMessage || defaultMessage;

    return await this.sendEmail({
      to: data.candidateEmail,
      subject: `Convite para Entrevista - ${data.jobTitle}`,
      html: htmlContent,
      candidateName: data.candidateName,
      jobTitle: data.jobTitle
    });
  }
}

export const emailService = new EmailService();