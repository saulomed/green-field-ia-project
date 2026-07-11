import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from './password.service';
import { authConfig } from '../config/auth.config';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(authConfig().argon2),
          },
        },
      ],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
  });

  describe('hash', () => {
    it('should produce an argon2id digest', async () => {
      const digest = await service.hash('my-password');
      expect(digest).toMatch(/^\$argon2id\$/);
    });

    it('should produce a different digest on each call (random salt)', async () => {
      const first = await service.hash('same-password');
      const second = await service.hash('same-password');
      expect(first).not.toBe(second);
    });
  });

  describe('verify', () => {
    it('should return true for the correct password', async () => {
      const digest = await service.hash('correct-password');
      expect(await service.verify(digest, 'correct-password')).toBe(true);
    });

    it('should return false for a wrong password', async () => {
      const digest = await service.hash('correct-password');
      expect(await service.verify(digest, 'wrong-password')).toBe(false);
    });

    it('should return false without throwing for an invalid digest', async () => {
      expect(await service.verify('not-a-valid-hash', 'password')).toBe(false);
    });
  });
});
