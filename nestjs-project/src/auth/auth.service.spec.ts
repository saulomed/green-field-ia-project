import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { UsersService } from '../users/users.service';
import { ChannelService } from '../channels/channel.service';
import { SessionService, TokenPair } from './session.service';
import { PasswordResetTokenService } from './password-reset-token.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { ConfirmDto } from './dto/confirm.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import { EmailAlreadyExistsException } from '../common/exceptions/email-already-exists.exception';
import { EmailAlreadyConfirmedException } from '../common/exceptions/email-already-confirmed.exception';
import { InvalidTokenException } from '../common/exceptions/invalid-token.exception';
import { InvalidSessionException } from '../common/exceptions/invalid-session.exception';
import { EmailNotConfirmedException } from '../common/exceptions/email-not-confirmed.exception';
import { RefreshTokenReusedException } from '../common/exceptions/refresh-token-reused.exception';

describe('AuthService', () => {
  let service: AuthService;
  let transactionManager: EntityManager;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let passwordService: jest.Mocked<Pick<PasswordService, 'hash' | 'verify'>>;
  let usersService: jest.Mocked<
    Pick<
      UsersService,
      | 'existsByEmail'
      | 'create'
      | 'findByEmail'
      | 'findById'
      | 'markConfirmed'
      | 'updatePassword'
    >
  >;
  let channelService: jest.Mocked<
    Pick<ChannelService, 'createForUser' | 'findByUserId'>
  >;
  let sessionService: jest.Mocked<
    Pick<
      SessionService,
      | 'issuePair'
      | 'setAuthCookies'
      | 'rotate'
      | 'revokeFamilyForRawToken'
      | 'revokeAllForUser'
      | 'clearAuthCookies'
    >
  >;
  let passwordResetTokenService: jest.Mocked<
    Pick<PasswordResetTokenService, 'issue' | 'consume' | 'invalidateAll'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;
  let mailService: jest.Mocked<
    Pick<MailService, 'sendConfirmation' | 'sendPasswordReset'>
  >;

  const dto: RegisterDto = {
    email: 'john.doe@gmail.com',
    password: 'super-secret',
  };

  beforeEach(async () => {
    transactionManager = {} as EntityManager;
    dataSource = {
      transaction: jest.fn((cb: (m: EntityManager) => unknown) =>
        cb(transactionManager),
      ),
    };
    passwordService = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
      verify: jest.fn(),
    };
    usersService = {
      existsByEmail: jest.fn().mockResolvedValue(false),
      create: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      markConfirmed: jest.fn().mockResolvedValue(undefined),
      updatePassword: jest.fn().mockResolvedValue(undefined),
    };
    channelService = {
      createForUser: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue(null),
    };
    sessionService = {
      issuePair: jest.fn(),
      setAuthCookies: jest.fn(),
      rotate: jest.fn(),
      revokeFamilyForRawToken: jest.fn(),
      revokeAllForUser: jest.fn(),
      clearAuthCookies: jest.fn(),
    };
    passwordResetTokenService = {
      issue: jest.fn().mockResolvedValue('raw-reset-token'),
      consume: jest.fn(),
      invalidateAll: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('confirm-jwt'),
      verifyAsync: jest.fn(),
    };
    mailService = {
      sendConfirmation: jest.fn().mockResolvedValue(undefined),
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: PasswordService, useValue: passwordService },
        { provide: UsersService, useValue: usersService },
        { provide: ChannelService, useValue: channelService },
        { provide: SessionService, useValue: sessionService },
        {
          provide: PasswordResetTokenService,
          useValue: passwordResetTokenService,
        },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('24h') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  function stubSuccessfulPersist(): User {
    const user = { id: 'user-uuid', email: dto.email } as User;
    usersService.create.mockResolvedValue(user);
    channelService.createForUser.mockResolvedValue({
      id: 'ch-uuid',
      nickname: 'johndoe',
      name: 'johndoe',
    } as Channel);
    return user;
  }

  it('hashes the password before handing it to UsersService', async () => {
    stubSuccessfulPersist();

    await service.register(dto);

    expect(passwordService.hash).toHaveBeenCalledWith(dto.password);
    expect(usersService.create).toHaveBeenCalledWith(
      { email: dto.email, passwordHash: 'hashed-password' },
      transactionManager,
    );
  });

  it('persists user and channel within the same transaction', async () => {
    const user = stubSuccessfulPersist();

    await service.register(dto);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(usersService.create).toHaveBeenCalledWith(
      expect.anything(),
      transactionManager,
    );
    expect(channelService.createForUser).toHaveBeenCalledWith(
      user,
      transactionManager,
    );
  });

  it('rejects registration when the e-mail already exists', async () => {
    usersService.existsByEmail.mockResolvedValue(true);

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      EmailAlreadyExistsException,
    );

    expect(usersService.create).not.toHaveBeenCalled();
    expect(channelService.createForUser).not.toHaveBeenCalled();
  });

  it('rejects registration when the e-mail is taken inside the transaction', async () => {
    usersService.existsByEmail
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      EmailAlreadyExistsException,
    );

    expect(usersService.create).not.toHaveBeenCalled();
    expect(channelService.createForUser).not.toHaveBeenCalled();
  });

  it('propagates a channel-creation failure so the transaction rolls back', async () => {
    usersService.create.mockResolvedValue({
      id: 'user-uuid',
      email: dto.email,
    } as User);
    channelService.createForUser.mockRejectedValue(
      new Error('nickname collision limit'),
    );

    await expect(service.register(dto)).rejects.toThrow(
      'nickname collision limit',
    );
  });

  it('returns id, email and channel nickname on success', async () => {
    stubSuccessfulPersist();

    const result = await service.register(dto);

    expect(result).toEqual({
      id: 'user-uuid',
      email: dto.email,
      channel: { nickname: 'johndoe' },
    });
  });

  it('sends the confirmation e-mail with a signed JWT after commit', async () => {
    stubSuccessfulPersist();

    await service.register(dto);

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'user-uuid', purpose: 'confirm' },
      { expiresIn: '24h' },
    );
    expect(mailService.sendConfirmation).toHaveBeenCalledWith(
      dto.email,
      'johndoe',
      'confirm-jwt',
    );
  });

  it('does not fail registration when the confirmation e-mail dispatch throws', async () => {
    stubSuccessfulPersist();
    mailService.sendConfirmation.mockRejectedValue(new Error('smtp down'));

    await expect(service.register(dto)).resolves.toEqual({
      id: 'user-uuid',
      email: dto.email,
      channel: { nickname: 'johndoe' },
    });
  });

  describe('confirmAccount', () => {
    const confirmDto: ConfirmDto = { token: 'confirm-jwt' };

    function stubUser(overrides: Partial<User> = {}): User {
      return {
        id: 'user-uuid',
        email: dto.email,
        isConfirmed: false,
        ...overrides,
      } as User;
    }

    it('activates a pending account with a valid confirmation token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        purpose: 'confirm',
      });
      usersService.findById.mockResolvedValue(stubUser());

      await service.confirmAccount(confirmDto);

      expect(usersService.markConfirmed).toHaveBeenCalledWith('user-uuid');
    });

    it('rejects an expired or invalid JWT', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.confirmAccount(confirmDto)).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
      expect(usersService.markConfirmed).not.toHaveBeenCalled();
    });

    it('rejects a token whose purpose is not "confirm"', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        purpose: 'reset',
      });

      await expect(service.confirmAccount(confirmDto)).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
      expect(usersService.markConfirmed).not.toHaveBeenCalled();
    });

    it('rejects a token whose subject no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        purpose: 'confirm',
      });
      usersService.findById.mockResolvedValue(null);

      await expect(service.confirmAccount(confirmDto)).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
      expect(usersService.markConfirmed).not.toHaveBeenCalled();
    });

    it('rejects confirming an already-confirmed account', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        purpose: 'confirm',
      });
      usersService.findById.mockResolvedValue(stubUser({ isConfirmed: true }));

      await expect(service.confirmAccount(confirmDto)).rejects.toBeInstanceOf(
        EmailAlreadyConfirmedException,
      );
      expect(usersService.markConfirmed).not.toHaveBeenCalled();
    });
  });

  describe('resendConfirmation', () => {
    const resendDto: ResendConfirmationDto = { email: dto.email };

    function stubUser(overrides: Partial<User> = {}): User {
      return {
        id: 'user-uuid',
        email: dto.email,
        isConfirmed: false,
        ...overrides,
      } as User;
    }

    it('asks ChannelService for the channel name instead of loading the relation', async () => {
      usersService.findByEmail.mockResolvedValue(stubUser());
      channelService.findByUserId.mockResolvedValue({
        name: 'johndoe',
      } as Channel);

      await service.resendConfirmation(resendDto);

      expect(channelService.findByUserId).toHaveBeenCalledWith('user-uuid');
      expect(mailService.sendConfirmation).toHaveBeenCalledWith(
        dto.email,
        'johndoe',
        'confirm-jwt',
      );
    });

    it('does not send an e-mail for an already-confirmed account', async () => {
      usersService.findByEmail.mockResolvedValue(
        stubUser({ isConfirmed: true }),
      );

      await service.resendConfirmation(resendDto);

      expect(mailService.sendConfirmation).not.toHaveBeenCalled();
    });

    it('resolves neutrally when no account exists for the e-mail', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.resendConfirmation(resendDto),
      ).resolves.toBeUndefined();
      expect(mailService.sendConfirmation).not.toHaveBeenCalled();
    });
  });

  describe('validateCredentials', () => {
    function stubUser(overrides: Partial<User> = {}): User {
      return {
        id: 'user-uuid',
        email: dto.email,
        passwordHash: 'hashed-password',
        isConfirmed: true,
        ...overrides,
      } as User;
    }

    it('returns the user when the password matches', async () => {
      const user = stubUser();
      usersService.findByEmail.mockResolvedValue(user);
      passwordService.verify.mockResolvedValue(true);

      const result = await service.validateCredentials(dto.email, dto.password);

      expect(result).toBe(user);
      expect(usersService.findByEmail).toHaveBeenCalledWith(dto.email);
    });

    it('returns null when the e-mail is unknown', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateCredentials(dto.email, dto.password);

      expect(result).toBeNull();
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('returns null when the password does not match', async () => {
      usersService.findByEmail.mockResolvedValue(stubUser());
      passwordService.verify.mockResolvedValue(false);

      const result = await service.validateCredentials(
        dto.email,
        'wrong-password',
      );

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    const res = {} as Response;
    const pair: TokenPair = {
      accessToken: 'access-jwt',
      refreshToken: 'refresh-jwt',
    };

    function stubConfirmedUser(overrides: Partial<User> = {}): User {
      return {
        id: 'user-uuid',
        email: dto.email,
        isConfirmed: true,
        ...overrides,
      } as User;
    }

    it('issues a session and gets the nickname from ChannelService', async () => {
      sessionService.issuePair.mockResolvedValue(pair);
      channelService.findByUserId.mockResolvedValue({
        nickname: 'johndoe',
      } as Channel);
      const user = stubConfirmedUser();

      const result = await service.login(user, res);

      expect(sessionService.issuePair).toHaveBeenCalledWith(user);
      expect(sessionService.setAuthCookies).toHaveBeenCalledWith(res, pair);
      expect(channelService.findByUserId).toHaveBeenCalledWith('user-uuid');
      expect(result).toEqual({
        id: 'user-uuid',
        email: dto.email,
        channel: { nickname: 'johndoe' },
      });
    });

    it('rejects login for an unconfirmed account without issuing a session', async () => {
      const user = stubConfirmedUser({ isConfirmed: false });

      await expect(service.login(user, res)).rejects.toBeInstanceOf(
        EmailNotConfirmedException,
      );
      expect(sessionService.issuePair).not.toHaveBeenCalled();
      expect(sessionService.setAuthCookies).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const res = {} as Response;
    const pair: TokenPair = {
      accessToken: 'new-access-jwt',
      refreshToken: 'new-refresh-jwt',
    };

    it('rotates the session and returns id and email for the rotated userId', async () => {
      sessionService.rotate.mockResolvedValue({ pair, userId: 'user-uuid' });
      usersService.findById.mockResolvedValue({
        id: 'user-uuid',
        email: dto.email,
      } as User);

      const result = await service.refresh('raw-refresh-jwt', res);

      expect(sessionService.rotate).toHaveBeenCalledWith('raw-refresh-jwt');
      expect(sessionService.setAuthCookies).toHaveBeenCalledWith(res, pair);
      expect(usersService.findById).toHaveBeenCalledWith('user-uuid');
      expect(result).toEqual({ id: 'user-uuid', email: dto.email });
    });

    it('rejects a missing refresh token cookie without calling rotate', async () => {
      await expect(service.refresh(undefined, res)).rejects.toBeInstanceOf(
        InvalidSessionException,
      );
      expect(sessionService.rotate).not.toHaveBeenCalled();
    });

    it('maps an invalid/expired/unknown refresh token to InvalidSessionException', async () => {
      sessionService.rotate.mockRejectedValue(new InvalidTokenException());

      await expect(
        service.refresh('raw-refresh-jwt', res),
      ).rejects.toBeInstanceOf(InvalidSessionException);
    });

    it('rejects a rotated session whose user no longer exists', async () => {
      sessionService.rotate.mockResolvedValue({ pair, userId: 'user-uuid' });
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.refresh('raw-refresh-jwt', res),
      ).rejects.toBeInstanceOf(InvalidSessionException);
    });

    it('propagates reuse detection as-is', async () => {
      sessionService.rotate.mockRejectedValue(
        new RefreshTokenReusedException(),
      );

      await expect(
        service.refresh('raw-refresh-jwt', res),
      ).rejects.toBeInstanceOf(RefreshTokenReusedException);
    });
  });

  describe('logout', () => {
    const res = {} as Response;

    it('revokes the family for the refresh cookie and clears both cookies', async () => {
      await service.logout('raw-refresh-jwt', res);

      expect(sessionService.revokeFamilyForRawToken).toHaveBeenCalledWith(
        'raw-refresh-jwt',
      );
      expect(sessionService.clearAuthCookies).toHaveBeenCalledWith(res);
    });

    it('still clears cookies when no refresh cookie is present', async () => {
      await service.logout(undefined, res);

      expect(sessionService.revokeFamilyForRawToken).not.toHaveBeenCalled();
      expect(sessionService.clearAuthCookies).toHaveBeenCalledWith(res);
    });
  });

  describe('forgotPassword', () => {
    const forgotDto: ForgotPasswordDto = { email: dto.email };

    it('invalidates pending tokens, issues a new one and e-mails it for a known account', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-uuid',
        email: dto.email,
      } as User);
      channelService.findByUserId.mockResolvedValue({
        name: 'johndoe',
      } as Channel);

      await service.forgotPassword(forgotDto);

      expect(passwordResetTokenService.invalidateAll).toHaveBeenCalledWith(
        'user-uuid',
      );
      expect(passwordResetTokenService.issue).toHaveBeenCalledWith('user-uuid');
      expect(channelService.findByUserId).toHaveBeenCalledWith('user-uuid');
      expect(mailService.sendPasswordReset).toHaveBeenCalledWith(
        dto.email,
        'johndoe',
        'raw-reset-token',
      );
    });

    it('resolves neutrally without side effects when no account exists for the e-mail', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.forgotPassword(forgotDto)).resolves.toBeUndefined();

      expect(passwordResetTokenService.invalidateAll).not.toHaveBeenCalled();
      expect(passwordResetTokenService.issue).not.toHaveBeenCalled();
      expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const resetDto: ResetPasswordDto = {
      token: 'raw-reset-token',
      password: 'new-super-secret',
    };

    it('consumes the token, updates the password and revokes every session', async () => {
      passwordResetTokenService.consume.mockResolvedValue('user-uuid');

      await service.resetPassword(resetDto);

      expect(passwordResetTokenService.consume).toHaveBeenCalledWith(
        'raw-reset-token',
      );
      expect(passwordService.hash).toHaveBeenCalledWith('new-super-secret');
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        'user-uuid',
        'hashed-password',
      );
      expect(passwordResetTokenService.invalidateAll).toHaveBeenCalledWith(
        'user-uuid',
      );
      expect(sessionService.revokeAllForUser).toHaveBeenCalledWith('user-uuid');
    });

    it('propagates an invalid, expired or already-used token without updating anything', async () => {
      passwordResetTokenService.consume.mockRejectedValue(
        new InvalidTokenException(),
      );

      await expect(service.resetPassword(resetDto)).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
      expect(usersService.updatePassword).not.toHaveBeenCalled();
      expect(sessionService.revokeAllForUser).not.toHaveBeenCalled();
    });
  });
});
