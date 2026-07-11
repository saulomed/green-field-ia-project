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

const MAILPIT_API = 'http://mailpit:8025/api/v1';

async function findMessageTo(
  email: string,
): Promise<{ Subject: string; Text: string } | undefined> {
  const res = await fetch(
    `${MAILPIT_API}/search?query=to:${encodeURIComponent(email)}`,
  );
  const { messages } = (await res.json()) as {
    messages: Array<{ ID: string }>;
  };
  if (messages.length === 0) return undefined;

  const detail = await fetch(`${MAILPIT_API}/message/${messages[0].ID}`);
  return (await detail.json()) as { Subject: string; Text: string };
}

async function awaitMessageTo(
  email: string,
  timeoutMs = 2000,
  pollIntervalMs = 50,
): Promise<{ Subject: string; Text: string } | undefined> {
  const deadline = Date.now() + timeoutMs;
  do {
    const message = await findMessageTo(email);
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  } while (Date.now() < deadline);
  return undefined;
}

describe('Auth — POST /auth/register (e2e)', () => {
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
    await db.query(`DELETE FROM users WHERE email LIKE 'e2e-register-%'`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user and creates a channel with derived nickname', async () => {
    const email = 'e2e-register-success@example.com';

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'super-secret-1' })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      email,
      channel: { nickname: expect.stringMatching(/^e2eregistersuccess/) },
    });

    const [user] = await db.query<Array<{ is_confirmed: boolean }>>(
      `SELECT is_confirmed FROM users WHERE email = $1`,
      [email],
    );
    expect(user.is_confirmed).toBe(false);
  });

  it('rejects registration with an already registered e-mail', async () => {
    const email = 'e2e-register-duplicate@example.com';
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
  });

  it('rejects a password shorter than 8 characters with a validation error', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'e2e-register-shortpwd@example.com', password: 'short' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
    });
  });

  it('sends a confirmation e-mail captured by the mail server', async () => {
    const email = 'e2e-register-mail@example.com';

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'super-secret-1' })
      .expect(201);

    const message = await awaitMessageTo(email);

    expect(message).toBeDefined();
    expect(message!.Subject).toContain('Confirme sua conta');
    expect(message!.Text).toContain('/auth/confirm?token=');
  });
});
