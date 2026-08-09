import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import {
  buildSwaggerOptions,
  swaggerConfig,
} from '../../src/config/swagger.config';
import { setupSwagger } from '../../src/openapi/swagger.setup';

/**
 * Builds and initializes a NestJS app wired the same way `main.ts` does
 * (cookieParser, ValidationPipe with the project's error format,
 * HttpExceptionFilter, setupSwagger). `Test.createTestingModule` doesn't run
 * `main.ts`, so e2e specs must reproduce this setup themselves — centralized
 * here instead of copy-pasted per spec file.
 *
 * @author Saulo Santos
 * @date 13/07/2026
 * @param overrides.swagger - partial override of the `swagger` namespace for this app instance
 */
export async function createTestApp(overrides?: {
  swagger?: Partial<ReturnType<typeof buildSwaggerOptions>>;
}): Promise<{
  app: INestApplication<App>;
  moduleFixture: TestingModule;
}> {
  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (overrides?.swagger) {
    moduleBuilder.overrideProvider(swaggerConfig.KEY).useValue({
      ...buildSwaggerOptions(process.env),
      ...overrides.swagger,
    });
  }

  const moduleFixture = await moduleBuilder.compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
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
  setupSwagger(app);
  await app.init();

  return { app, moduleFixture };
}
