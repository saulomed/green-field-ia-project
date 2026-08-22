import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ApiValidationErrorResponse } from './api-validation-error.decorator';
import { ApiDomainErrorResponse } from './api-domain-error.decorator';
import { ApiRateLimitedResponse } from './api-rate-limited.decorator';

@Controller('fixture')
class FixtureController {
  @Get('validation')
  @ApiValidationErrorResponse()
  validation(): void {}

  @Get('domain')
  @ApiDomainErrorResponse(
    404,
    'USUARIO_NAO_ENCONTRADO',
    'Usuário não encontrado',
  )
  domain(): void {}

  @Get('rate-limited')
  @ApiRateLimitedResponse()
  rateLimited(): void {}
}

describe('api error decorators', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [FixtureController],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('fixture')
      .setVersion('1.0')
      .build();
    document = SwaggerModule.createDocument(app, config);
  });

  afterAll(async () => {
    await app.close();
  });

  it('declares 400 with ErrorResponseDto on the validation-error endpoint', () => {
    const response =
      document.paths['/fixture/validation'].get!.responses['400'];
    expect(response).toMatchObject({
      description: 'Falha de validação do corpo da requisição',
    });
    expect(JSON.stringify(response)).toContain('ErrorResponseDto');
  });

  it('declares the given status and description on the domain-error endpoint', () => {
    const response = document.paths['/fixture/domain'].get!.responses['404'];
    expect(response.description).toContain('USUARIO_NAO_ENCONTRADO');
    expect(JSON.stringify(response)).toContain('ErrorResponseDto');
  });

  it('declares 429 with ErrorResponseDto on the rate-limited endpoint', () => {
    const response =
      document.paths['/fixture/rate-limited'].get!.responses['429'];
    expect(response).toMatchObject({
      description: 'Limite de requisições excedido (LIMITE_EXCEDIDO)',
    });
    expect(JSON.stringify(response)).toContain('ErrorResponseDto');
  });

  it('declares ErrorResponseDto once in components.schemas with exactly statusCode, error, message, details', () => {
    const schema = document.components?.schemas?.ErrorResponseDto as {
      properties: Record<string, unknown>;
    };
    expect(schema).toBeDefined();
    expect(Object.keys(schema.properties).sort()).toEqual([
      'details',
      'error',
      'message',
      'statusCode',
    ]);
  });
});
