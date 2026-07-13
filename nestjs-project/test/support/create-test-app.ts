import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

/**
 * Builds and initializes a NestJS app wired the same way `main.ts` does
 * (ValidationPipe with the project's error format, HttpExceptionFilter).
 * `Test.createTestingModule` doesn't run `main.ts`, so e2e specs must
 * reproduce this setup themselves — centralized here instead of copy-pasted
 * per spec file.
 *
 * @author Saulo Santos
 * @date 13/07/2026
 */
export async function createTestApp(): Promise<{
  app: INestApplication<App>;
  moduleFixture: TestingModule;
}> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
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

  return { app, moduleFixture };
}
