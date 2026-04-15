import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: this.configService.get('SENDGRID_API_KEY'),
      },
    });
  }

  async sendVerificationEmail(to: string, token: string) {
    const verificationUrl = `${this.configService.get('STORE_URL')}/verificar-email?token=${token}`;

    await this.transporter.sendMail({
      from: `"${this.configService.get('EMAIL_FROM_NAME')}" <${this.configService.get('EMAIL_FROM')}>`,
      to,
      subject: 'Verifique seu email - Gaqno Shop',
      html: `
        <h1>Bem-vindo ao Gaqno Shop!</h1>
        <p>Por favor, clique no link abaixo para verificar seu email:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #e11d48; color: white; text-decoration: none; border-radius: 4px;">Verificar Email</a>
        <p>Ou copie e cole este link no seu navegador:</p>
        <p>${verificationUrl}</p>
        <p>Este link expira em 24 horas.</p>
      `,
    });
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const resetUrl = `${this.configService.get('STORE_URL')}/redefinir-senha?token=${token}`;

    await this.transporter.sendMail({
      from: `"${this.configService.get('EMAIL_FROM_NAME')}" <${this.configService.get('EMAIL_FROM')}>`,
      to,
      subject: 'Recuperação de senha - Gaqno Shop',
      html: `
        <h1>Recuperação de Senha</h1>
        <p>Você solicitou a recuperação de senha. Clique no link abaixo para criar uma nova senha:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #e11d48; color: white; text-decoration: none; border-radius: 4px;">Redefinir Senha</a>
        <p>Ou copie e cole este link no seu navegador:</p>
        <p>${resetUrl}</p>
        <p>Este link expira em 1 hora.</p>
        <p>Se você não solicitou esta recuperação, ignore este email.</p>
      `,
    });
  }
}
