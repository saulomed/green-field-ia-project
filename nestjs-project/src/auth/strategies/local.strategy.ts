import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { User } from '../../users/entities/user.entity';
import { InvalidCredentialsException } from '../../common/exceptions/invalid-credentials.exception';

/**
 * Validates e-mail/password credentials for POST /auth/login via AuthService.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<User> {
    const user = await this.authService.validateCredentials(email, password);
    if (!user) {
      throw new InvalidCredentialsException();
    }
    return user;
  }
}
