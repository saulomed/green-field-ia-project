import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtStrategy, cookieExtractor } from './jwt.strategy';
import { authConfig } from '../../config/auth.config';

describe('cookieExtractor', () => {
  it('reads the token from the access_token cookie', () => {
    const req = { cookies: { access_token: 'the-jwt' } } as unknown as Request;
    expect(cookieExtractor(req)).toBe('the-jwt');
  });

  it('returns null when there is no access_token cookie', () => {
    const req = { cookies: {} } as unknown as Request;
    expect(cookieExtractor(req)).toBeNull();
  });

  it('returns null when there are no cookies at all', () => {
    const req = {} as unknown as Request;
    expect(cookieExtractor(req)).toBeNull();
  });
});

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(authConfig()) },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('returns the token payload as-is', () => {
    const payload = { sub: 'user-uuid' };
    expect(strategy.validate(payload)).toBe(payload);
  });
});
