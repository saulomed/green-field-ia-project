import { DomainException } from './domain.exception';

/**
 * Thrown when registering with an e-mail that already belongs to an account.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export class EmailAlreadyExistsException extends DomainException {
  constructor() {
    super('EMAIL_JA_EXISTE', 'E-mail já cadastrado', 409);
  }
}
