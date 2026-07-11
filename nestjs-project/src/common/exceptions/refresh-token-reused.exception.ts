import { DomainException } from './domain.exception';

/**
 * Thrown when a refresh token that was already rotated (and thus revoked)
 * is presented again — signals credential theft per RFC 9700 reuse detection.
 * The caller must revoke the entire rotation family on this signal.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export class RefreshTokenReusedException extends DomainException {
  constructor() {
    super('TOKEN_REUTILIZADO', 'Refresh token reutilizado', 401);
  }
}
