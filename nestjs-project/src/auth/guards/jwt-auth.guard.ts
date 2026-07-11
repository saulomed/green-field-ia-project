import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects routes requiring a valid access token cookie, delegating
 * verification to JwtStrategy.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
