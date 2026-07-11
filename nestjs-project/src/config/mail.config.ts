import { registerAs, ConfigType } from '@nestjs/config';

/**
 * Mail service configuration namespace.
 * Covers SMTP connection settings and sender identity for transactional email (Mailpit in dev).
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export const mailConfig = registerAs('mail', () => ({
  host: process.env.MAIL_HOST as string,
  port: Number(process.env.MAIL_PORT),
  user: process.env.MAIL_USER,
  pass: process.env.MAIL_PASS,
  from: process.env.MAIL_FROM ?? 'StreamTube <noreply@streamtube.local>',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
}));

export type MailConfig = ConfigType<typeof mailConfig>;
