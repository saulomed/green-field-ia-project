import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects POST /auth/login, delegating credential validation to LocalStrategy.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
