import { registerAs, ConfigType } from '@nestjs/config';

/**
 * Authentication configuration namespace.
 * Covers JWT settings, token TTLs, argon2id hashing parameters, and cookie flags.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET as string,
  jwtAccessTtl: process.env.JWT_ACCESS_TTL as string,
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL as string,
  confirmTokenTtl: process.env.CONFIRM_TOKEN_TTL as string,
  resetTokenTtl: process.env.RESET_TOKEN_TTL as string,
  argon2: {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  },
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAMESITE as 'strict' | 'lax' | 'none',
  },
}));

export type AuthConfig = ConfigType<typeof authConfig>;
