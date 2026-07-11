import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  INestApplication,
  Module,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsEmail, IsString, MinLength } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

class TestDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  name: string;
}

@Controller('test')
class TestController {
  @Post()
  @HttpCode(200)
  create(@Body() _dto: TestDto) {
    return { ok: true };
  }
}

@Module({ controllers: [TestController] })
class TestAppModule {}

describe('Validation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [TestAppModule],
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 400 with error format for invalid body', async () => {
    const response = await request(app.getHttpServer())
      .post('/test')
      .send({ email: 'not-an-email', name: 'ab' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: expect.any(String),
      message: expect.any(String),
    });
  });

  it('should return 400 for body with extra (non-whitelisted) fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/test')
      .send({ email: 'user@example.com', name: 'John', extraField: 'hack' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: expect.any(String),
      message: expect.any(String),
    });
  });

  it('should return 404 in error format for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/non-existent-route');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: expect.any(String),
      message: expect.any(String),
    });
  });

  it('should return 200 for valid body', async () => {
    const response = await request(app.getHttpServer())
      .post('/test')
      .send({ email: 'user@example.com', name: 'John' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
