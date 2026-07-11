import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { Response } from 'express';
import { SessionService } from './session.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { InvalidTokenException } from '../common/exceptions/invalid-token.exception';
import { RefreshTokenReusedException } from '../common/exceptions/refresh-token-reused.exception';

describe('SessionService', () => {
  let service: SessionService;
  let manager: jest.Mocked<
    Pick<
      EntityManager,
      'create' | 'save' | 'update' | 'findOneBy' | 'createQueryBuilder'
    >
  >;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction' | 'manager'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;
  let queryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };

  const user = { id: 'user-uuid' } as User;

  function refreshTokenFixture(
    overrides: Partial<RefreshToken> = {},
  ): RefreshToken {
    return {
      id: 'old-refresh-id',
      userId: user.id,
      familyId: 'family-uuid',
      jti: 'old-jti',
      revokedAt: null,
      ...overrides,
    } as RefreshToken;
  }

  beforeEach(async () => {
    queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    manager = {
      create: jest.fn((_entity, data) => data),
      save: jest.fn((_entity, data) =>
        Promise.resolve({ id: 'new-refresh-id', ...data }),
      ),
      update: jest.fn().mockResolvedValue(undefined),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    dataSource = {
      manager: manager as unknown as EntityManager,
      transaction: jest.fn((cb: (m: EntityManager) => unknown) =>
        cb(manager as unknown as EntityManager),
      ),
    };
    jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-jwt')
        .mockResolvedValueOnce('refresh-jwt'),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              jwtSecret: 'secret',
              jwtAccessTtl: '15m',
              jwtRefreshTtl: '7d',
              cookie: { secure: true, sameSite: 'strict' },
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  describe('issuePair', () => {
    it('persists the jti of the refresh token and returns the signed pair', async () => {
      const pair = await service.issuePair(user);

      expect(pair).toEqual({
        accessToken: 'access-jwt',
        refreshToken: 'refresh-jwt',
      });
      expect(manager.save).toHaveBeenCalledWith(
        RefreshToken,
        expect.objectContaining({ userId: user.id, jti: expect.any(String) }),
      );
    });
  });

  describe('rotate', () => {
    it('revokes the used token and issues a new pair in the same family', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        jti: 'old-jti',
      });
      manager.findOneBy.mockResolvedValue(refreshTokenFixture());

      const pair = await service.rotate('raw-refresh-jwt');

      expect(pair).toEqual({
        accessToken: 'access-jwt',
        refreshToken: 'refresh-jwt',
      });
      expect(manager.update).toHaveBeenCalledWith(
        RefreshToken,
        'old-refresh-id',
        {
          revokedAt: expect.any(Date),
          replacedById: 'new-refresh-id',
        },
      );
      expect(manager.save).toHaveBeenCalledWith(
        RefreshToken,
        expect.objectContaining({ familyId: 'family-uuid' }),
      );
    });

    it('revokes the whole family and signals reuse when the jti was already revoked', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        jti: 'stolen-jti',
      });
      manager.findOneBy.mockResolvedValue(
        refreshTokenFixture({
          id: 'stolen-refresh-id',
          jti: 'stolen-jti',
          revokedAt: new Date(),
        }),
      );

      await expect(service.rotate('raw-refresh-jwt')).rejects.toBeInstanceOf(
        RefreshTokenReusedException,
      );

      expect(queryBuilder.where).toHaveBeenCalledWith('family_id = :value', {
        value: 'family-uuid',
      });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('rejects an invalid or expired refresh JWT', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      await expect(service.rotate('bad-jwt')).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
    });

    it('rejects a refresh JWT whose jti is unknown', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        jti: 'unknown-jti',
      });
      manager.findOneBy.mockResolvedValue(null);

      await expect(service.rotate('raw-refresh-jwt')).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
    });
  });

  describe('setAuthCookies / clearAuthCookies', () => {
    it('sets access_token and refresh_token as httpOnly, secure, SameSite=Strict cookies, refresh scoped to /auth', () => {
      const res = {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
      } as unknown as jest.Mocked<Response>;

      service.setAuthCookies(res, {
        accessToken: 'access-jwt',
        refreshToken: 'refresh-jwt',
      });

      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'access-jwt',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
        }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-jwt',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/auth',
        }),
      );
    });

    it('clears both cookies, matching the refresh token path', () => {
      const res = {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
      } as unknown as jest.Mocked<Response>;

      service.clearAuthCookies(res);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.any(Object),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/auth' }),
      );
    });
  });
});
