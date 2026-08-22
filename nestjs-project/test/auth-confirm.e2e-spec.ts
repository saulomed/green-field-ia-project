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
import {
  awaitMessageTo,
  awaitMessageCountTo,
  extractToken,
} from './support/mailpit';

describe('Auth — GET /auth/confirm, POST /auth/resend-confirmation (e2e)', () => {
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
    await db.query(`DELETE FROM users WHERE email LIKE 'e2e-confirm-%'`);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerUser(email: string): Promise<void> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'E2E Tester', password: 'super-secret-1' })
      .expect(201);
  }

  function confirmAccount(token: string) {
    return request(app.getHttpServer()).get('/auth/confirm').query({ token });
  }

  it('activates the account with a valid confirmation token', async () => {
    const email = 'e2e-confirm-success@example.com';
    await registerUser(email);
    const message = await awaitMessageTo(email);
    const token = extractToken(message!);

    await confirmAccount(token).expect(204);

    const [user] = await db.query<Array<{ is_confirmed: boolean }>>(
      `SELECT is_confirmed FROM users WHERE email = $1`,
      [email],
    );
    expect(user.is_confirmed).toBe(true);
  });

  it('rejects an invalid or expired confirmation token', async () => {
    const response = await confirmAccount('not-a-real-jwt').expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'TOKEN_INVALIDO',
    });
  });

  it('rejects confirming an already-confirmed account', async () => {
    const email = 'e2e-confirm-duplicate@example.com';
    await registerUser(email);
    const message = await awaitMessageTo(email);
    const token = extractToken(message!);

    await confirmAccount(token).expect(204);

    const response = await confirmAccount(token).expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      error: 'EMAIL_JA_CONFIRMADO',
    });
  });

  it('returns a neutral 204 and resends the e-mail for a pending account', async () => {
    const email = 'e2e-confirm-resend@example.com';
    await registerUser(email);
    const baseline = await awaitMessageCountTo(email, 1);

    await request(app.getHttpServer())
      .post('/auth/resend-confirmation')
      .send({ email })
      .expect(204);

    const afterResend = await awaitMessageCountTo(email, baseline + 1);
    expect(afterResend).toBeGreaterThan(baseline);
  });

  it('returns a neutral 204 for an e-mail that has no account', async () => {
    await request(app.getHttpServer())
      .post('/auth/resend-confirmation')
      .send({ email: 'e2e-confirm-unknown@example.com' })
      .expect(204);
  });
});
