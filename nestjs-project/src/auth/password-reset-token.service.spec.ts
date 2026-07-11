import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { PasswordResetTokenService } from './password-reset-token.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { InvalidTokenException } from '../common/exceptions/invalid-token.exception';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('PasswordResetTokenService', () => {
  let service: PasswordResetTokenService;
  let repo: ReturnType<typeof mockRepo>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetTokenService,
        {
          provide: getRepositoryToken(PasswordResetToken),
          useFactory: mockRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('1h'),
          },
        },
      ],
    }).compile();

    service = module.get(PasswordResetTokenService);
    repo = module.get(getRepositoryToken(PasswordResetToken));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('issue', () => {
    it('should persist only the token hash, not the raw token', async () => {
      const userId = 'user-uuid';
      const entity = { userId, tokenHash: 'hash', expiresAt: new Date() };
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue({ ...entity, id: 'token-uuid' });

      const rawToken = await service.issue(userId);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );

      const { tokenHash } = repo.create.mock.calls[0][0] as { tokenHash: string };
      expect(tokenHash).not.toBe(rawToken);
      expect(tokenHash).toHaveLength(64); // SHA-256 hex
    });

    it('should return a 64-char hex string (32 random bytes)', async () => {
      repo.create.mockReturnValue({});
      repo.save.mockResolvedValue({});

      const rawToken = await service.issue('user-id');

      expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should set expiresAt roughly 1 hour in the future', async () => {
      repo.create.mockReturnValue({});
      repo.save.mockResolvedValue({});

      const before = Date.now();
      await service.issue('user-id');
      const after = Date.now();

      const { expiresAt } = repo.create.mock.calls[0][0] as { expiresAt: Date };
      const diff = expiresAt.getTime();
      expect(diff).toBeGreaterThanOrEqual(before + 3_600_000 - 100);
      expect(diff).toBeLessThanOrEqual(after + 3_600_000 + 100);
    });
  });

  describe('consume', () => {
    it('should return the userId and mark the token as used for a valid token', async () => {
      const rawToken = 'a'.repeat(64);
      const record: Partial<PasswordResetToken> = {
        id: 'token-id',
        userId: 'user-uuid',
        tokenHash: 'stored-hash',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      };
      repo.findOne.mockResolvedValue(record);
      repo.update.mockResolvedValue({ affected: 1 });

      const userId = await service.consume(rawToken);

      expect(userId).toBe('user-uuid');
      expect(repo.update).toHaveBeenCalledWith('token-id', { usedAt: expect.any(Date) });
    });

    it('should throw InvalidTokenException when token is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.consume('unknown-token')).rejects.toBeInstanceOf(InvalidTokenException);
    });

    it('should throw InvalidTokenException when token is already used', async () => {
      const record: Partial<PasswordResetToken> = {
        id: 'token-id',
        userId: 'user-uuid',
        usedAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 60_000),
      };
      repo.findOne.mockResolvedValue(record);

      await expect(service.consume('any-token')).rejects.toBeInstanceOf(InvalidTokenException);
    });

    it('should throw InvalidTokenException when token is expired', async () => {
      const record: Partial<PasswordResetToken> = {
        id: 'token-id',
        userId: 'user-uuid',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      };
      repo.findOne.mockResolvedValue(record);

      await expect(service.consume('any-token')).rejects.toBeInstanceOf(InvalidTokenException);
    });

    it('should use the same timestamp for expiry check and usedAt', async () => {
      const record: Partial<PasswordResetToken> = {
        id: 'token-id',
        userId: 'user-uuid',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      };
      repo.findOne.mockResolvedValue(record);
      repo.update.mockResolvedValue({ affected: 1 });

      await service.consume('valid-token');

      const [, updatePayload] = repo.update.mock.calls[0] as [string, { usedAt: Date }];
      expect(updatePayload.usedAt).toBeInstanceOf(Date);
    });

    it('should not call update when the token is rejected', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.consume('bad-token')).rejects.toThrow();
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('invalidateAll', () => {
    it('should mark all unused tokens for the user as used', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.invalidateAll('user-uuid');

      expect(qb.update).toHaveBeenCalledWith(PasswordResetToken);
      expect(qb.set).toHaveBeenCalledWith({ usedAt: expect.any(Date) });
      expect(qb.where).toHaveBeenCalledWith('user_id = :userId', { userId: 'user-uuid' });
      expect(qb.andWhere).toHaveBeenCalledWith('used_at IS NULL');
      expect(qb.execute).toHaveBeenCalled();
    });
  });
});
