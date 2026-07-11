import { DomainException } from './domain.exception';

/**
 * Thrown when a token (confirmation JWT, opaque reset token) is absent,
 * expired, already used, or has an unexpected purpose claim.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export class InvalidTokenException extends DomainException {
  constructor() {
    super('TOKEN_INVALIDO', 'Token inválido ou expirado', 400);
  }
}
