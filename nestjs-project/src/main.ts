import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { port } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

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

  await app.listen(port);
}
bootstrap();
