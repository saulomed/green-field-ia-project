import { DomainException } from './domain.exception';

/**
 * Thrown on refresh when the refresh token cookie is absent, malformed,
 * expired, or its `jti` is unknown — anything short of a detected reuse
 * (which is signaled by RefreshTokenReusedException instead).
 *
 * @author Saulo Santos
 * @date 12/07/2026
 */
export class InvalidSessionException extends DomainException {
  constructor() {
    super('SESSAO_INVALIDA', 'Sessão inválida ou expirada', 401);
  }
}
