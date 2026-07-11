import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { ChannelService } from './channel.service';
import { Channel } from './entities/channel.entity';
import { User } from '../users/entities/user.entity';

describe('ChannelService', () => {
  let service: ChannelService;
  let manager: jest.Mocked<Pick<EntityManager, 'exists' | 'create' | 'save'>>;

  beforeEach(async () => {
    manager = {
      exists: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChannelService],
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
    const user = { id: 'user-uuid', email: 'john.doe@gmail.com' } as User;

    beforeEach(() => {
      manager.create.mockReturnValue({} as Channel);
      manager.save.mockResolvedValue({} as Channel);
    });

    it('creates channel with normalized nickname when no collision', async () => {
      const savedChannel = { id: 'ch-uuid', nickname: 'johndoe' } as Channel;
      manager.exists.mockResolvedValue(false);
      manager.create.mockReturnValue(savedChannel);
      manager.save.mockResolvedValue(savedChannel);

      const result = await service.createForUser(
        user,
        manager as unknown as EntityManager,
      );

      expect(manager.exists).toHaveBeenCalledWith(Channel, {
        where: { nickname: 'johndoe' },
      });
      expect(manager.create).toHaveBeenCalledWith(Channel, {
        userId: user.id,
        nickname: 'johndoe',
        name: 'johndoe',
        description: null,
      });
      expect(result).toBe(savedChannel);
    });

    it('appends random suffix when base nickname already exists', async () => {
      manager.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await service.createForUser(user, manager as unknown as EntityManager);

      expect(manager.exists).toHaveBeenCalledTimes(2);
      const usedNickname = (manager.create as jest.Mock).mock.calls[0][1]
        .nickname as string;
      expect(usedNickname).toMatch(/^johndoe-[a-z0-9]{4}$/);
    });

    it('retries until a free nickname is found', async () => {
      manager.exists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await service.createForUser(user, manager as unknown as EntityManager);

      expect(manager.exists).toHaveBeenCalledTimes(3);
    });
  });
});
