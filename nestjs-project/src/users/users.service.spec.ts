import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { ChannelService } from '../channels/channel.service';

type UserRepositoryMock = jest.Mocked<
  Pick<Repository<User>, 'exists' | 'create' | 'save' | 'findOneBy' | 'update'>
>;

const buildRepositoryMock = (): UserRepositoryMock => ({
  exists: jest.fn().mockResolvedValue(false),
  create: jest.fn().mockReturnValue({} as User),
  save: jest.fn().mockResolvedValue({} as User),
  findOneBy: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('UsersService', () => {
  let service: UsersService;
  let injectedRepository: UserRepositoryMock;
  let transactionalRepository: UserRepositoryMock;
  let manager: jest.Mocked<Pick<EntityManager, 'getRepository'>>;

  beforeEach(async () => {
    injectedRepository = buildRepositoryMock();
    transactionalRepository = buildRepositoryMock();
    manager = {
      getRepository: jest.fn().mockReturnValue(transactionalRepository),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: injectedRepository,
        },
        {
          provide: ChannelService,
          useValue: { findByUserId: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('existsByEmail', () => {
    it('uses the injected repository when no manager is provided', async () => {
      injectedRepository.exists.mockResolvedValue(true);

      await expect(service.existsByEmail('john@example.com')).resolves.toBe(
        true,
      );
      expect(injectedRepository.exists).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });
      expect(manager.getRepository).not.toHaveBeenCalled();
    });

    it('resolves the repository from the manager to join its transaction', async () => {
      transactionalRepository.exists.mockResolvedValue(true);

      await expect(
        service.existsByEmail(
          'john@example.com',
          manager as unknown as EntityManager,
        ),
      ).resolves.toBe(true);
      expect(manager.getRepository).toHaveBeenCalledWith(User);
      expect(injectedRepository.exists).not.toHaveBeenCalled();
    });

    it('returns false for an unknown e-mail', async () => {
      injectedRepository.exists.mockResolvedValue(false);

      await expect(service.existsByEmail('nobody@example.com')).resolves.toBe(
        false,
      );
    });
  });

  describe('create', () => {
    const input = { email: 'john@example.com', passwordHash: 'hashed' };

    it('uses the injected repository when no manager is provided', async () => {
      const saved = { id: 'user-uuid' } as User;
      injectedRepository.create.mockReturnValue(saved);
      injectedRepository.save.mockResolvedValue(saved);

      const result = await service.create(input);

      expect(injectedRepository.save).toHaveBeenCalledWith(saved);
      expect(manager.getRepository).not.toHaveBeenCalled();
      expect(result).toBe(saved);
    });

    it('resolves the repository from the manager to join its transaction', async () => {
      const saved = { id: 'user-uuid' } as User;
      transactionalRepository.create.mockReturnValue(saved);
      transactionalRepository.save.mockResolvedValue(saved);

      const result = await service.create(
        input,
        manager as unknown as EntityManager,
      );

      expect(manager.getRepository).toHaveBeenCalledWith(User);
      expect(transactionalRepository.save).toHaveBeenCalledWith(saved);
      expect(injectedRepository.save).not.toHaveBeenCalled();
      expect(result).toBe(saved);
    });

    it('creates the account unconfirmed', async () => {
      await service.create(input);

      expect(injectedRepository.create).toHaveBeenCalledWith({
        email: input.email,
        passwordHash: input.passwordHash,
        isConfirmed: false,
      });
    });
  });

  describe('findByEmail', () => {
    it('returns the matching user', async () => {
      const user = { id: 'user-uuid', email: 'john@example.com' } as User;
      injectedRepository.findOneBy.mockResolvedValue(user);

      await expect(service.findByEmail('john@example.com')).resolves.toBe(user);
      expect(injectedRepository.findOneBy).toHaveBeenCalledWith({
        email: 'john@example.com',
      });
    });

    it('returns null for an unknown e-mail', async () => {
      injectedRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findByEmail('nobody@example.com')).resolves.toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the matching user', async () => {
      const user = { id: 'user-uuid' } as User;
      injectedRepository.findOneBy.mockResolvedValue(user);

      await expect(service.findById('user-uuid')).resolves.toBe(user);
      expect(injectedRepository.findOneBy).toHaveBeenCalledWith({
        id: 'user-uuid',
      });
    });

    it('returns null for an unknown id', async () => {
      injectedRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findById('missing-uuid')).resolves.toBeNull();
    });
  });

  describe('markConfirmed', () => {
    it('flags the account as confirmed', async () => {
      await service.markConfirmed('user-uuid');

      expect(injectedRepository.update).toHaveBeenCalledWith('user-uuid', {
        isConfirmed: true,
      });
    });
  });

  describe('updatePassword', () => {
    it('persists the new password hash', async () => {
      await service.updatePassword('user-uuid', 'new-hash');

      expect(injectedRepository.update).toHaveBeenCalledWith('user-uuid', {
        passwordHash: 'new-hash',
      });
    });
  });
});
