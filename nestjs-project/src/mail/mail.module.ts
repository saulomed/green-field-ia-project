import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { join } from 'path';
import { MailConfig } from '../config/mail.config';
import { MailService } from './mail.service';

/**
 * Provides transactional email via SMTP (Mailpit in dev) with Handlebars templates.
 * Exports MailService for use by auth flows.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mail = config.get<MailConfig>('mail')!;
        return {
          transport: {
            host: mail.host,
            port: mail.port,
            auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
          },
          defaults: { from: mail.from },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
