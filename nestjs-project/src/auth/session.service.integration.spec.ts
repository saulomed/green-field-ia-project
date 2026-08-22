import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { databaseConfig } from '../config/database.config';
import { authConfig, AuthConfig } from '../config/auth.config';
import { envValidationSchema } from '../config/env.validation';
import { DatabaseModule } from '../database/database.module';
import { insertUser } from '../database/migration-test-helpers';
import { SessionService } from './session.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenReusedException } from '../common/exceptions/refresh-token-reused.exception';

/**
 * Exercises SessionService.rotate against a real DataSource so transaction
 * commit/rollback semantics are actually in effect — a mocked
 * `dataSource.transaction` (as used in session.service.spec.ts) executes the
 * callback directly and cannot catch a revocation being silently rolled back
 * by a `throw` inside the same transaction.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
describe('SessionService (integration)', () => {
  let module: TestingModule;
  let db: DataSource;
  let service: SessionService;
  const userId = '20000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig, authConfig],
          validationSchema: envValidationSchema,
          validationOptions: { allowUnknown: true, abortEarly: true },
        }),
        DatabaseModule,
        JwtModule.registerAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const auth = config.get<AuthConfig>('auth')!;
            return {
              secret: auth.jwtSecret,
              signOptions: { expiresIn: auth.jwtAccessTtl },
            };
          },
        }),
      ],
      providers: [SessionService],
    }).compile();

    db = module.get<DataSource>(getDataSourceToken());
    service = module.get<SessionService>(SessionService);

    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await insertUser(db, { id: userId, email: 'session-integration@example.com' });
  });

  afterAll(async () => {
    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await module.close();
  });

  it('persists the refresh token jti on issuePair', async () => {
    const pair = await service.issuePair({ id: userId } as never);

    const jwtService = module.get<JwtService>(JwtService);
    const decoded = jwtService.decode<{ jti: string }>(pair.refreshToken);
    const stored = await db.manager.findOneBy(RefreshToken, {
      jti: decoded.jti,
    });

    expect(stored).not.toBeNull();
    expect(stored?.userId).toBe(userId);
    expect(stored?.revokedAt).toBeNull();
  });

  it('revokes the whole family in the database when reuse is detected, even though rotate() throws', async () => {
    const first = await service.issuePair({ id: userId } as never);
    const { pair: rotated } = await service.rotate(first.refreshToken);

    // Replaying the already-rotated (now revoked) refresh token simulates a
    // stolen/reused token — the family must be revoked in the database, not
    // just reported as revoked to the caller.
    await expect(service.rotate(first.refreshToken)).rejects.toBeInstanceOf(
      RefreshTokenReusedException,
    );

    const jwtService = module.get<JwtService>(JwtService);
    const decoded = jwtService.decode<{ jti: string }>(rotated.refreshToken);
    const currentGenerationToken = await db.manager.findOneBy(RefreshToken, {
      jti: decoded.jti,
    });

    expect(currentGenerationToken?.revokedAt).not.toBeNull();
  });
});
