import { registerAs } from '@nestjs/config';

/**
 * Application-level configuration namespace.
 * Covers runtime settings: HTTP port and execution environment.
 *
 * @author Saulo Santos
 * @date 15/06/2026
 */
export const appConfig = registerAs('app', () => ({
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
}));
