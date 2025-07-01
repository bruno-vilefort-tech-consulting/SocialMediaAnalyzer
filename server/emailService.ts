import { Resend } from 'resend';

interface EmailData {
  to: string;
  subject: string;
  html: string;
}

interface AssessmentEmailData {
  to: string;
  subject: string;
  message: string;
  assessmentType: string;
  candidateName: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
    }
  }

  async sendEmail(data: EmailData): Promise<EmailResult> {
    if (!this.resend) {
      return {
        success: false,
        error: 'Serviço de email não configurado. Verifique a chave RESEND_API_KEY.'
      };
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
        return {
          success: false,
          error: result.error.message || JSON.stringify(result.error)
        };
      }

      console.log(`✅ Email enviado para ${data.to} - ID: ${result.data?.id}`);
      return {
        success: true,
        messageId: result.data?.id
      };
    } catch (error) {
      console.error('❌ Erro no serviço de email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  async sendAssessmentEmail(data: AssessmentEmailData): Promise<EmailResult> {
    const assessmentUrls = {
      'Player MX': 'https://app.maxcamrh.com/player-mx',
      'Vision MX': 'https://app.maxcamrh.com/vision-mx',
      'Energy MX': 'https://app.maxcamrh.com/energy-mx',
      'Personality MX': 'https://app.maxcamrh.com/personality-mx',
      'Power MX': 'https://app.maxcamrh.com/power-mx'
    };

    const assessmentUrl = assessmentUrls[data.assessmentType as keyof typeof assessmentUrls] || '#';

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Assessment MaxcamRH</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0; font-size: 28px;">MaxcamRH</h1>
              <p style="color: #666; margin: 5px 0 0 0;">Sistema de Avaliação Profissional</p>
            </div>
            
            <div style="margin-bottom: 30px;">
              <h2 style="color: #1f2937; margin-bottom: 15px;">Olá, ${data.candidateName}!</h2>
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <p style="margin: 0; color: #374151;">${data.message}</p>
              </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h3 style="color: white; margin: 0 0 10px 0; font-size: 20px;">${data.assessmentType}</h3>
                <p style="color: #e2e8f0; margin: 0; font-size: 14px;">Avaliação Profissional Personalizada</p>
              </div>
              
              <a href="${assessmentUrl}" style="display: inline-block; background-color: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0;">
                Iniciar Assessment
              </a>
            </div>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                Este e-mail foi enviado por Ana Luíza, gestora de RH da MaxcamRH.<br>
                Se você tem dúvidas, responda este e-mail ou entre em contato conosco.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: data.to,
      subject: data.subject,
      html: htmlTemplate
    });
  }
}

export const emailService = new EmailService();