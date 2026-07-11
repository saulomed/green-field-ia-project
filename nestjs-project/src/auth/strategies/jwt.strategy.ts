import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthConfig } from '../../config/auth.config';
import { AUTH_COOKIES } from '../auth.constants';

export interface AccessTokenPayload {
  sub: string;
}

export function cookieExtractor(req: Request): string | null {
  const token: unknown = req?.cookies?.[AUTH_COOKIES.ACCESS_TOKEN];
  return typeof token === 'string' ? token : null;
}

/**
 * Authenticates requests bearing a valid access token in the `access_token`
 * cookie. Expired tokens are rejected (`ignoreExpiration: false`).
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const auth = configService.get<AuthConfig>('auth')!;
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: auth.jwtSecret,
    });
  }

  validate(payload: AccessTokenPayload): AccessTokenPayload {
    return payload;
  }
}
