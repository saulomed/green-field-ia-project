import { DomainException } from './domain.exception';

/**
 * Thrown on login when the e-mail is unknown or the password is wrong.
 * Uses the same code/status for both cases so the response never reveals
 * whether an account exists for the given e-mail.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('CREDENCIAIS_INVALIDAS', 'Credenciais inválidas', 401);
  }
}
