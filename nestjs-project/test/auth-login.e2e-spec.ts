import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { awaitMessageTo, extractToken } from './support/mailpit';

describe('Auth — POST /auth/login (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
    await db.query(`DELETE FROM users WHERE email LIKE 'e2e-login-%'`);
  });

  afterAll(async () => {
    await app.close();
  });

  const password = 'super-secret-1';

  async function registerAndConfirmUser(email: string): Promise<void> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'E2E Tester', password })
      .expect(201);

    const message = await awaitMessageTo(email);
    const token = extractToken(message!);

    await request(app.getHttpServer())
      .get('/auth/confirm')
      .query({ token })
      .expect(204);
  }

  it('logs in with valid credentials of a confirmed account and sets session cookies', async () => {
    const email = 'e2e-login-success@example.com';
    await registerAndConfirmUser(email);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(response.body).toEqual({
      id: expect.any(String),
      email,
      channel: { nickname: expect.stringMatching(/^e2eloginsuccess/) },
    });

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const accessCookie = cookies.find((c) => c.startsWith('access_token='));
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));

    // COOKIE_SECURE defaults to false in this environment (see env.validation.ts),
    // so the Secure attribute is intentionally not asserted here — it's covered
    // against a `true` config value by session.service.spec.ts.
    expect(accessCookie).toMatch(/HttpOnly/);
    expect(accessCookie).toMatch(/SameSite=Strict/);
    expect(refreshCookie).toMatch(/HttpOnly/);
    expect(refreshCookie).toMatch(/SameSite=Strict/);
    expect(refreshCookie).toMatch(/Path=\/auth/);
  });

  it('rejects an unknown e-mail with the same code as a wrong password', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e-login-unknown@example.com', password })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      error: 'CREDENCIAIS_INVALIDAS',
    });
  });

  it('rejects a wrong password with CREDENCIAIS_INVALIDAS', async () => {
    const email = 'e2e-login-wrong-password@example.com';
    await registerAndConfirmUser(email);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'not-the-password' })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      error: 'CREDENCIAIS_INVALIDAS',
    });
  });

  it('rejects login for an account pending confirmation', async () => {
    const email = 'e2e-login-unconfirmed@example.com';
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'E2E Tester', password })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      error: 'EMAIL_NAO_CONFIRMADO',
    });
  });
});
