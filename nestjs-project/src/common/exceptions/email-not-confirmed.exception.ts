import { DomainException } from './domain.exception';

/**
 * Thrown on login when the account exists and the password is correct, but
 * `isConfirmed` is still false.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export class EmailNotConfirmedException extends DomainException {
  constructor() {
    super('EMAIL_NAO_CONFIRMADO', 'E-mail ainda não confirmado', 403);
  }
}
