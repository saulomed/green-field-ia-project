import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './support/create-test-app';

/**
 * Each `it` below targets a distinct route, so a single shared app (and thus
 * a single ThrottlerStorageService instance) is safe — the guard tracks a
 * separate counter per route handler, not one global counter.
 *
 * @author Saulo Santos
 * @date 13/07/2026
 */
describe('Auth — rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Fires `attempt()` `allowedCount` times (none of which should be
   * throttled), then once more, asserting that last one is blocked with the
   * project's standard 429 shape.
   */
  async function expectThrottledAfter(
    attempt: () => ReturnType<ReturnType<typeof request>['post']>,
    allowedCount: number,
  ): Promise<void> {
    for (let i = 0; i < allowedCount; i++) {
      const response = await attempt();
      expect(response.status).not.toBe(429);
    }

    const blocked = await attempt().expect(429);
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      error: 'LIMITE_EXCEDIDO',
    });
  }

  it('blocks the 6th POST /auth/login request within the window with 429 LIMITE_EXCEDIDO', async () => {
    await expectThrottledAfter(
      () =>
        request(app.getHttpServer()).post('/auth/login').send({
          email: 'e2e-throttle-login@example.com',
          password: 'wrong-password',
        }),
      5,
    );
  });

  it('blocks the 4th POST /auth/forgot-password request within the window with 429', async () => {
    await expectThrottledAfter(
      () =>
        request(app.getHttpServer())
          .post('/auth/forgot-password')
          .send({ email: 'e2e-throttle-forgot@example.com' }),
      3,
    );
  });

  it('blocks the 4th POST /auth/resend-confirmation request within the window with 429', async () => {
    await expectThrottledAfter(
      () =>
        request(app.getHttpServer())
          .post('/auth/resend-confirmation')
          .send({ email: 'e2e-throttle-resend@example.com' }),
      3,
    );
  });

  it('does not apply the sensitive route limits to a non-sensitive endpoint', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer()).get('/').expect(200);
    }
  });
});
