import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getStorageToken, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './support/create-test-app';
import {
  awaitMessageTo,
  awaitMessageCountTo,
  extractToken,
} from './support/mailpit';

describe('Auth — POST /auth/forgot-password, /auth/reset-password (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let throttlerStorage: ThrottlerStorageService;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    db = created.moduleFixture.get<DataSource>(getDataSourceToken());
    throttlerStorage = created.moduleFixture.get(getStorageToken());
  });

  afterEach(async () => {
    await db.query(`DELETE FROM users WHERE email LIKE 'e2e-pwreset-%'`);
    // Resets forgot-password's 3/h counter (SI-02.16) between tests so this
    // suite's scenarios don't share a rate-limit budget across a shared app.
    throttlerStorage.storage.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  const password = 'super-secret-1';

  async function registerConfirmAndLogin(email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'E2E Tester', password })
      .expect(201);

    const confirmMessage = await awaitMessageTo(email);
    await request(app.getHttpServer())
      .get('/auth/confirm')
      .query({ token: extractToken(confirmMessage!) })
      .expect(204);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='))!;
    return refreshCookie.split(';')[0];
  }

  async function requestResetToken(email: string): Promise<string> {
    const before = await awaitMessageCountTo(email, 1).catch(() => 0);
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(204);

    const count = await awaitMessageCountTo(email, before + 1);
    expect(count).toBeGreaterThan(before);
    const message = await awaitMessageTo(email);
    return extractToken(message!);
  }

  describe('POST /auth/forgot-password', () => {
    it('returns a neutral 204 and e-mails a reset link for an existing account', async () => {
      const email = 'e2e-pwreset-known@example.com';
      await registerConfirmAndLogin(email);

      await requestResetToken(email);
    });

    it('returns a neutral 204 for an e-mail that has no account', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'e2e-pwreset-unknown@example.com' })
        .expect(204);
    });

    it('invalidates a previously issued reset token when a new one is requested', async () => {
      const email = 'e2e-pwreset-superseded@example.com';
      await registerConfirmAndLogin(email);

      const firstToken = await requestResetToken(email);
      await requestResetToken(email);

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: firstToken, password: 'another-secret-1' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'TOKEN_INVALIDO',
      });
    });
  });

  describe('POST /auth/reset-password', () => {
    it('updates the password, single-uses the token, and revokes active sessions', async () => {
      const email = 'e2e-pwreset-success@example.com';
      const refreshCookie = await registerConfirmAndLogin(email);
      const token = await requestResetToken(email);
      const newPassword = 'brand-new-secret-1';

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, password: newPassword })
        .expect(204);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: newPassword })
        .expect(200);

      const reuseResponse = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, password: 'yet-another-secret-1' })
        .expect(400);
      expect(reuseResponse.body).toMatchObject({
        statusCode: 400,
        error: 'TOKEN_INVALIDO',
      });

      const refreshAttempt = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(401);
      expect(refreshAttempt.body).toMatchObject({ statusCode: 401 });
    });

    it('rejects an invalid, expired, or unknown reset token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'not-a-real-token', password: 'some-secret-1' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'TOKEN_INVALIDO',
      });
    });
  });
});
