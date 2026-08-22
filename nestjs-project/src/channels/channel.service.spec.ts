import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ChannelService } from './channel.service';
import { Channel } from './entities/channel.entity';
import { User } from '../users/entities/user.entity';

type ChannelRepositoryMock = jest.Mocked<
  Pick<Repository<Channel>, 'exists' | 'create' | 'save' | 'findOneBy'>
>;

const buildRepositoryMock = (): ChannelRepositoryMock => ({
  exists: jest.fn().mockResolvedValue(false),
  create: jest.fn().mockReturnValue({} as Channel),
  save: jest.fn().mockResolvedValue({} as Channel),
  findOneBy: jest.fn().mockResolvedValue(null),
});

describe('ChannelService', () => {
  let service: ChannelService;
  let injectedRepository: ChannelRepositoryMock;
  let transactionalRepository: ChannelRepositoryMock;
  let manager: jest.Mocked<Pick<EntityManager, 'getRepository'>>;

  beforeEach(async () => {
    injectedRepository = buildRepositoryMock();
    transactionalRepository = buildRepositoryMock();
    manager = {
      getRepository: jest.fn().mockReturnValue(transactionalRepository),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelService,
        {
          provide: getRepositoryToken(Channel),
          useValue: injectedRepository,
        },
      ],
    }).compile();

    service = module.get<ChannelService>(ChannelService);
  });

  describe('normalizePrefix', () => {
    it('extracts prefix before @ and lowercases it', () => {
      expect(service.normalizePrefix('John.Doe@gmail.com')).toBe('johndoe');
    });

    it('removes non-alphanumeric characters from prefix', () => {
      expect(service.normalizePrefix('john.doe+tag@example.com')).toBe(
        'johndoetag',
      );
    });

    it('handles all-numeric prefix', () => {
      expect(service.normalizePrefix('12345@example.com')).toBe('12345');
    });

    it('handles prefix with only special chars as empty string', () => {
      expect(service.normalizePrefix('...@example.com')).toBe('');
    });
  });

  describe('createForUser', () => {
    const user = { id: 'user-uuid', email: 'john.doe@gmail.com', name: 'John Doe' } as User;

    it('uses the injected repository when no manager is provided', async () => {
      const savedChannel = { id: 'ch-uuid', nickname: 'johndoe' } as Channel;
      injectedRepository.create.mockReturnValue(savedChannel);
      injectedRepository.save.mockResolvedValue(savedChannel);

      const result = await service.createForUser(user);

      expect(injectedRepository.create).toHaveBeenCalledWith({
        userId: user.id,
        nickname: 'johndoe',
        name: 'John Doe',
        description: null,
      });
      expect(injectedRepository.save).toHaveBeenCalledWith(savedChannel);
      expect(manager.getRepository).not.toHaveBeenCalled();
      expect(result).toBe(savedChannel);
    });

    it('resolves the repository from the manager to join its transaction', async () => {
      const savedChannel = { id: 'ch-uuid', nickname: 'johndoe' } as Channel;
      transactionalRepository.create.mockReturnValue(savedChannel);
      transactionalRepository.save.mockResolvedValue(savedChannel);

      const result = await service.createForUser(
        user,
        manager as unknown as EntityManager,
      );

      expect(manager.getRepository).toHaveBeenCalledWith(Channel);
      expect(transactionalRepository.save).toHaveBeenCalledWith(savedChannel);
      expect(injectedRepository.save).not.toHaveBeenCalled();
      expect(result).toBe(savedChannel);
    });

    it('queries the base nickname for availability before creating', async () => {
      await service.createForUser(user, manager as unknown as EntityManager);

      expect(transactionalRepository.exists).toHaveBeenCalledWith({
        where: { nickname: 'johndoe' },
      });
    });

    it('appends random suffix when base nickname already exists', async () => {
      transactionalRepository.exists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await service.createForUser(user, manager as unknown as EntityManager);

      expect(transactionalRepository.exists).toHaveBeenCalledTimes(2);
      const usedNickname = transactionalRepository.create.mock.calls[0][0]
        .nickname as string;
      expect(usedNickname).toMatch(/^johndoe-[a-z0-9]{4}$/);
    });

    it('retries until a free nickname is found', async () => {
      transactionalRepository.exists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await service.createForUser(user, manager as unknown as EntityManager);

      expect(transactionalRepository.exists).toHaveBeenCalledTimes(3);
    });
  });

  describe('findByUserId', () => {
    it('returns the channel owned by the given user', async () => {
      const channel = { id: 'ch-uuid', userId: 'user-uuid' } as Channel;
      injectedRepository.findOneBy.mockResolvedValue(channel);

      await expect(service.findByUserId('user-uuid')).resolves.toBe(channel);
      expect(injectedRepository.findOneBy).toHaveBeenCalledWith({
        userId: 'user-uuid',
      });
    });

    it('returns null when the user has no channel', async () => {
      injectedRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findByUserId('user-uuid')).resolves.toBeNull();
    });
  });
});
