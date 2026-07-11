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
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import { EmailAlreadyExistsException } from '../common/exceptions/email-already-exists.exception';

describe('AuthService', () => {
  let service: AuthService;
  let manager: jest.Mocked<Pick<EntityManager, 'exists' | 'create' | 'save'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction' | 'manager'>>;
  let passwordService: jest.Mocked<Pick<PasswordService, 'hash'>>;
  let channelService: jest.Mocked<Pick<ChannelService, 'createForUser'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;
  let mailService: jest.Mocked<Pick<MailService, 'sendConfirmation'>>;

  const dto: RegisterDto = {
    email: 'john.doe@gmail.com',
    password: 'super-secret',
  };

  beforeEach(async () => {
    manager = { exists: jest.fn(), create: jest.fn(), save: jest.fn() };
    dataSource = {
      manager: manager as unknown as EntityManager,
      transaction: jest.fn((cb: (m: EntityManager) => unknown) =>
        cb(manager as unknown as EntityManager),
      ),
    };
    passwordService = { hash: jest.fn().mockResolvedValue('hashed-password') };
    channelService = { createForUser: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('confirm-jwt') };
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
});
