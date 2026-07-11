import { DomainException } from './domain.exception';

/**
 * Thrown when confirming an account that is already confirmed —
 * also covers replay of an already-consumed confirmation JWT.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export class EmailAlreadyConfirmedException extends DomainException {
  constructor() {
    super('EMAIL_JA_CONFIRMADO', 'E-mail já confirmado', 409);
  }
}
