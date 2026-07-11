import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { ChannelService } from '../channels/channel.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { ConfirmDto } from './dto/confirm.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import { EmailAlreadyExistsException } from '../common/exceptions/email-already-exists.exception';
import { EmailAlreadyConfirmedException } from '../common/exceptions/email-already-confirmed.exception';
import { InvalidTokenException } from '../common/exceptions/invalid-token.exception';

describe('AuthService', () => {
  let service: AuthService;
  let manager: jest.Mocked<
    Pick<
      EntityManager,
      'exists' | 'create' | 'save' | 'findOneBy' | 'findOne' | 'update'
    >
  >;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction' | 'manager'>>;
  let passwordService: jest.Mocked<Pick<PasswordService, 'hash'>>;
  let channelService: jest.Mocked<Pick<ChannelService, 'createForUser'>>;
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
    };
    dataSource = {
      manager: manager as unknown as EntityManager,
      transaction: jest.fn((cb: (m: EntityManager) => unknown) =>
        cb(manager as unknown as EntityManager),
      ),
    };
    passwordService = { hash: jest.fn().mockResolvedValue('hashed-password') };
    channelService = { createForUser: jest.fn() };
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
});
