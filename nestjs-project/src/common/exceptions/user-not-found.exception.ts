import { DomainException } from './domain.exception';

/**
 * Thrown when a user referenced by a valid access token no longer exists.
 *
 * @author Saulo Santos
 * @date 18/07/2026
 */
export class UserNotFoundException extends DomainException {
  constructor(userId: string) {
    super('USUARIO_NAO_ENCONTRADO', `Usuário ${userId} não encontrado`, 404);
  }
}
