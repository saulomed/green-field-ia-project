import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { App } from 'supertest/types';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './support/create-test-app';

/**
 * Proves the normalized error envelope wired through the real `main.ts`
 * pipeline (`createTestApp` mirrors it) — `message` is always a string and
 * per-field violations land in `details`, per `http-error-contract/TD-01`
 * and `TD-02`.
 *
 * @author Saulo Santos
 * @date 22/08/2026
 */
describe('Error envelope — ValidationPipe normalization (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;
    db = moduleFixture.get<DataSource>(getDataSourceToken());
  });

  afterEach(async () => {
    await db.query(`DELETE FROM users WHERE email LIKE 'e2e-envelope-%'`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('normalizes a validation failure into a single message plus per-field details', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: expect.any(String),
    });
    expect(Array.isArray(response.body.message)).toBe(false);
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
        expect.objectContaining({ field: 'password' }),
      ]),
    );
  });

  it('does not attach details to a domain error', async () => {
    const email = `e2e-envelope-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'super-secret-1' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'another-secret' })
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      error: 'EMAIL_JA_EXISTE',
    });
    expect(response.body.details).toBeUndefined();
  });
});
