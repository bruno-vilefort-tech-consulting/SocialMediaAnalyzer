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
        from: 'MaxcamRH <onboarding@resend.dev>',
        to: data.to,
        subject: data.subject,
        html: data.html,
      });

      if (result.error) {
        console.error('❌ Erro da API Resend:', result.error);
        throw new Error(`Erro ao enviar email: ${result.error.message || JSON.stringify(result.error)}`);
      }

      console.log(`✅ Email enviado para ${data.to} - ID: ${result.data?.id}`);
      return result;
    } catch (error) {
      console.error('❌ Erro no serviço de email:', error);
      throw new Error(`Erro ao enviar email: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }
}

export const emailService = new EmailService();