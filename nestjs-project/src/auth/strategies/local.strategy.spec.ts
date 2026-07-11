import { Test, TestingModule } from '@nestjs/testing';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';
import { User } from '../../users/entities/user.entity';
import { InvalidCredentialsException } from '../../common/exceptions/invalid-credentials.exception';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: jest.Mocked<Pick<AuthService, 'validateCredentials'>>;

  beforeEach(async () => {
    authService = { validateCredentials: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
  });

  it('returns the user for valid credentials', async () => {
    const user = { id: 'user-uuid', email: 'john.doe@gmail.com' } as User;
    authService.validateCredentials.mockResolvedValue(user);

    const result = await strategy.validate(
      'john.doe@gmail.com',
      'super-secret',
    );

    expect(result).toBe(user);
    expect(authService.validateCredentials).toHaveBeenCalledWith(
      'john.doe@gmail.com',
      'super-secret',
    );
  });

  it('throws InvalidCredentialsException for invalid credentials', async () => {
    authService.validateCredentials.mockResolvedValue(null);

    await expect(
      strategy.validate('john.doe@gmail.com', 'wrong-password'),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
  });
});
