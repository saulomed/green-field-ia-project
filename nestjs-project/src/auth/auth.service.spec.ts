import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { ChannelService } from '../channels/channel.service';
import { SessionService, TokenPair } from './session.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { ConfirmDto } from './dto/confirm.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';
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
  let manager: jest.Mocked<
    Pick<
      EntityManager,
      | 'exists'
      | 'create'
      | 'save'
      | 'findOneBy'
      | 'findOne'
      | 'update'
      | 'findOneByOrFail'
    >
  >;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction' | 'manager'>>;
  let passwordService: jest.Mocked<Pick<PasswordService, 'hash' | 'verify'>>;
  let channelService: jest.Mocked<Pick<ChannelService, 'createForUser'>>;
  let sessionService: jest.Mocked<
    Pick<
      SessionService,
      | 'issuePair'
      | 'setAuthCookies'
      | 'rotate'
      | 'revokeFamilyForRawToken'
      | 'clearAuthCookies'
    >
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;
  let mailService: jest.Mocked<Pick<MailService, 'sendConfirmation'>>;

  const dto: RegisterDto = {
    email: 'john.doe@gmail.com',
    password: 'super-secret',
  };

  beforeEach(async () => {
    manager = {
      exists: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      findOneByOrFail: jest.fn(),
    };
    dataSource = {
      manager: manager as unknown as EntityManager,
      transaction: jest.fn((cb: (m: EntityManager) => unknown) =>
        cb(manager as unknown as EntityManager),
      ),
    };
    passwordService = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
      verify: jest.fn(),
    };
    channelService = { createForUser: jest.fn() };
    sessionService = {
      issuePair: jest.fn(),
      setAuthCookies: jest.fn(),
      rotate: jest.fn(),
      revokeFamilyForRawToken: jest.fn(),
      clearAuthCookies: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('confirm-jwt'),
      verifyAsync: jest.fn(),
    };
    mailService = { sendConfirmation: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: PasswordService, useValue: passwordService },
        { provide: ChannelService, useValue: channelService },
        { provide: SessionService, useValue: sessionService },
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
    manager.exists.mockResolvedValue(false);
    const user = { id: 'user-uuid', email: dto.email } as User;
    manager.create.mockReturnValue(user);
    manager.save.mockResolvedValue(user);
    channelService.createForUser.mockResolvedValue({
      id: 'ch-uuid',
      nickname: 'johndoe',
      name: 'johndoe',
    } as Channel);
    return user;
  }

  it('hashes the password before persisting the user', async () => {
    stubSuccessfulPersist();

    await service.register(dto);

    expect(passwordService.hash).toHaveBeenCalledWith(dto.password);
    expect(manager.create).toHaveBeenCalledWith(User, {
      email: dto.email,
      passwordHash: 'hashed-password',
      isConfirmed: false,
    });
  });

  it('rejects registration when the e-mail already exists', async () => {
    manager.exists.mockResolvedValue(true);

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      EmailAlreadyExistsException,
    );

    expect(manager.save).not.toHaveBeenCalled();
    expect(channelService.createForUser).not.toHaveBeenCalled();
  });

  it('propagates a channel-creation failure so the transaction rolls back', async () => {
    manager.exists.mockResolvedValue(false);
    const user = { id: 'user-uuid', email: dto.email } as User;
    manager.create.mockReturnValue(user);
    manager.save.mockResolvedValue(user);
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
      manager.findOneBy.mockResolvedValue(stubUser());

      await service.confirmAccount(confirmDto);

      expect(manager.update).toHaveBeenCalledWith(User, 'user-uuid', {
        isConfirmed: true,
      });
    });

    it('rejects an expired or invalid JWT', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.confirmAccount(confirmDto)).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('rejects a token whose purpose is not "confirm"', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        purpose: 'reset',
      });

      await expect(service.confirmAccount(confirmDto)).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('rejects confirming an already-confirmed account', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        purpose: 'confirm',
      });
      manager.findOneBy.mockResolvedValue(stubUser({ isConfirmed: true }));

      await expect(service.confirmAccount(confirmDto)).rejects.toBeInstanceOf(
        EmailAlreadyConfirmedException,
      );
      expect(manager.update).not.toHaveBeenCalled();
    });
  });

  describe('resendConfirmation', () => {
    const resendDto: ResendConfirmationDto = { email: dto.email };

    function stubUserWithChannel(overrides: Partial<User> = {}): User {
      return {
        id: 'user-uuid',
        email: dto.email,
        isConfirmed: false,
        channel: { name: 'johndoe' } as Channel,
        ...overrides,
      } as User;
    }

    it('sends a new confirmation e-mail for a pending account', async () => {
      manager.findOne.mockResolvedValue(stubUserWithChannel());

      await service.resendConfirmation(resendDto);

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

    it('does not send an e-mail for an already-confirmed account', async () => {
      manager.findOne.mockResolvedValue(
        stubUserWithChannel({ isConfirmed: true }),
      );

      await service.resendConfirmation(resendDto);

      expect(mailService.sendConfirmation).not.toHaveBeenCalled();
    });

    it('resolves neutrally when no account exists for the e-mail', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.resendConfirmation(resendDto),
      ).resolves.toBeUndefined();
      expect(mailService.sendConfirmation).not.toHaveBeenCalled();
    });
  });

  describe('validateCredentials', () => {
    function stubUserWithChannel(overrides: Partial<User> = {}): User {
      return {
        id: 'user-uuid',
        email: dto.email,
        passwordHash: 'hashed-password',
        isConfirmed: true,
        channel: { nickname: 'johndoe' } as Channel,
        ...overrides,
      } as User;
    }

    it('returns the user with its channel loaded when the password matches', async () => {
      const user = stubUserWithChannel();
      manager.findOne.mockResolvedValue(user);
      passwordService.verify.mockResolvedValue(true);

      const result = await service.validateCredentials(dto.email, dto.password);

      expect(result).toBe(user);
      expect(manager.findOne).toHaveBeenCalledWith(User, {
        where: { email: dto.email },
        relations: { channel: true },
      });
    });

    it('returns null when the e-mail is unknown', async () => {
      manager.findOne.mockResolvedValue(null);

      const result = await service.validateCredentials(dto.email, dto.password);

      expect(result).toBeNull();
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('returns null when the password does not match', async () => {
      manager.findOne.mockResolvedValue(stubUserWithChannel());
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
        channel: { nickname: 'johndoe' } as Channel,
        ...overrides,
      } as User;
    }

    it('issues a session and returns id, email and channel nickname for a confirmed account', async () => {
      sessionService.issuePair.mockResolvedValue(pair);
      const user = stubConfirmedUser();

      const result = await service.login(user, res);

      expect(sessionService.issuePair).toHaveBeenCalledWith(user);
      expect(sessionService.setAuthCookies).toHaveBeenCalledWith(res, pair);
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
      manager.findOneByOrFail.mockResolvedValue({
        id: 'user-uuid',
        email: dto.email,
      });

      const result = await service.refresh('raw-refresh-jwt', res);

      expect(sessionService.rotate).toHaveBeenCalledWith('raw-refresh-jwt');
      expect(sessionService.setAuthCookies).toHaveBeenCalledWith(res, pair);
      expect(manager.findOneByOrFail).toHaveBeenCalledWith(User, {
        id: 'user-uuid',
      });
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
});
