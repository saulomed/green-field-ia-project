import { DomainException } from './domain.exception';

/**
 * Thrown by the throttler guard when a client exceeds the request limit for
 * a route's rate-limit window (global or route-specific).
 *
 * @author Saulo Santos
 * @date 13/07/2026
 */
export class RateLimitExceededException extends DomainException {
  constructor() {
    super(
      'LIMITE_EXCEDIDO',
      'Muitas requisições, tente novamente mais tarde',
      429,
    );
  }
}
