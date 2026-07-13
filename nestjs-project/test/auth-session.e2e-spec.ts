import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { awaitMessageTo } from './support/mailpit';

describe('Auth — POST /auth/refresh, /auth/logout (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => {
          const message = errors
            .flatMap((e) => Object.values(e.constraints ?? {}))
            .join('; ');
          return new BadRequestException({ error: 'Bad Request', message });
        },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    db = moduleFixture.get<DataSource>(getDataSourceToken());
  });

  afterEach(async () => {
    await db.query(`DELETE FROM users WHERE email LIKE 'e2e-session-%'`);
  });

  afterAll(async () => {
    await app.close();
  });

  const password = 'super-secret-1';

  /** Full raw `Set-Cookie` entry (name, value and attributes) for attribute assertions. */
  function findRawCookie(cookies: string[], name: string): string {
    return cookies.find((c) => c.startsWith(`${name}=`))!;
  }

  /** Just the `name=value` pair, suitable for forwarding in a request's `Cookie` header. */
  function extractCookie(cookies: string[], name: string): string {
    return findRawCookie(cookies, name).split(';')[0];
  }

  async function registerConfirmAndLogin(
    email: string,
  ): Promise<{ accessCookie: string; refreshCookie: string }> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    const message = await awaitMessageTo(email);
    const token = message!.Text.match(/token=(\S+)/)![1];
    await request(app.getHttpServer())
      .post('/auth/confirm')
      .send({ token })
      .expect(204);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = response.headers['set-cookie'] as unknown as string[];
    return {
      accessCookie: extractCookie(cookies, 'access_token'),
      refreshCookie: extractCookie(cookies, 'refresh_token'),
    };
  }

  describe('POST /auth/refresh', () => {
    it('rotates cookies and returns id and e-mail for a valid refresh token', async () => {
      const email = 'e2e-session-refresh@example.com';
      const { refreshCookie } = await registerConfirmAndLogin(email);

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(200);

      expect(response.body).toEqual({ id: expect.any(String), email });

      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(extractCookie(cookies, 'refresh_token')).not.toEqual(
        refreshCookie,
      );
      expect(findRawCookie(cookies, 'access_token')).toMatch(/HttpOnly/);
      expect(findRawCookie(cookies, 'refresh_token')).toMatch(
        /Path=\/auth/,
      );
    });

    it('rejects reuse of an already-rotated refresh token and revokes the family', async () => {
      const email = 'e2e-session-reuse@example.com';
      const { refreshCookie } = await registerConfirmAndLogin(email);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        error: 'TOKEN_REUTILIZADO',
      });
    });

    it('rejects a missing refresh cookie with SESSAO_INVALIDA', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        error: 'SESSAO_INVALIDA',
      });
    });

    it('rejects a malformed refresh cookie with SESSAO_INVALIDA', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', ['refresh_token=not-a-jwt'])
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        error: 'SESSAO_INVALIDA',
      });
    });
  });

  describe('POST /auth/logout', () => {
    it('clears cookies, revokes the family, and returns 204', async () => {
      const email = 'e2e-session-logout@example.com';
      const { accessCookie, refreshCookie } =
        await registerConfirmAndLogin(email);

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', [accessCookie, refreshCookie])
        .expect(204);

      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(findRawCookie(cookies, 'access_token')).toMatch(
        /access_token=;/,
      );
      expect(findRawCookie(cookies, 'refresh_token')).toMatch(
        /refresh_token=;/,
      );

      // The refresh token's jti is already revoked at this point (by logout),
      // so SessionService.rotate treats presenting it again as reuse — the
      // same code path a stolen/replayed token would hit.
      const refreshAttempt = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(401);

      expect(refreshAttempt.body).toMatchObject({
        statusCode: 401,
        error: 'TOKEN_REUTILIZADO',
      });
    });

    it('rejects logout without a valid access token', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });
});
