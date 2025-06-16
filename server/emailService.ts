import { Resend } from 'resend';

interface EmailData {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
    }
  }

  async sendEmail(data: EmailData): Promise<void> {
    if (!this.resend) {
      throw new Error('Serviço de email não configurado. Verifique a chave RESEND_API_KEY.');
    }

    try {
      const result = await this.resend.emails.send({
        from: 'Sistema de Entrevistas <noreply@grupomaximuns.com.br>',
        to: data.to,
        subject: data.subject,
        html: data.html,
      });

      if (result.error) {
        throw new Error(`Erro ao enviar email: ${result.error.message}`);
      }

      console.log(`✅ Email enviado para ${data.to} - ID: ${result.data?.id}`);
    } catch (error) {
      console.error('❌ Erro no serviço de email:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService();