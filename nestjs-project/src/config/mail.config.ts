import { registerAs, ConfigType } from '@nestjs/config';

/**
 * Mail service configuration namespace.
 * Covers SMTP connection settings for transactional email (Mailpit in dev).
 *
 * @author Saulo Santos
 * @date 15/06/2026
 */
export const mailConfig = registerAs('mail', () => ({
  host: process.env.MAIL_HOST as string,
  port: Number(process.env.MAIL_PORT),
}));

export type MailConfig = ConfigType<typeof mailConfig>;
