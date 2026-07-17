import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { MailConfig } from '../config/mail.config';

/**
 * High-level email dispatch for account confirmation and password reset flows.
 * Delegates rendering and transport to MailerService (Handlebars + SMTP).
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly appBaseUrl: string;

  constructor(
    private readonly mailerService: MailerService,
    configService: ConfigService,
  ) {
    this.appBaseUrl = configService.get<MailConfig>('mail')!.appBaseUrl;
  }

  /**
   * Sends an account confirmation email containing a verification link.
   *
   * @param email - Recipient email address
   * @param name - Recipient display name (used in the template greeting)
   * @param token - JWT confirmation token appended to the link
   */
  async sendConfirmation(email: string, name: string, token: string): Promise<void> {
    const link = `${this.appBaseUrl}/confirm-account?token=${token}`;
    await this.mailerService.sendMail({
      to: email,
      subject: 'Confirme sua conta no StreamTube',
      template: 'confirm-account',
      context: { name, link },
    });
    this.logger.log(`Confirmation email sent to ${email}`);
  }

  /**
   * Sends a password reset email containing a one-time reset link.
   *
   * @param email - Recipient email address
   * @param name - Recipient display name (used in the template greeting)
   * @param token - Opaque reset token appended to the link
   */
  async sendPasswordReset(email: string, name: string, token: string): Promise<void> {
    const link = `${this.appBaseUrl}/reset-password?token=${token}`;
    await this.mailerService.sendMail({
      to: email,
      subject: 'Redefinição de senha do StreamTube',
      template: 'reset-password',
      context: { name, link },
    });
    this.logger.log(`Password reset email sent to ${email}`);
  }
}
