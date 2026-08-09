import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from './openapi.document';

describe('buildOpenApiDocument', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should declare OpenAPI version 3.0.0', () => {
    const document = buildOpenApiDocument(app);
    expect(document.openapi).toBe('3.0.0');
  });

  it('should declare the jwt-cookie securityScheme as apiKey over the access_token cookie', () => {
    const document = buildOpenApiDocument(app);
    const scheme = document.components?.securitySchemes?.['jwt-cookie'];
    expect(scheme).toBeDefined();
    expect(scheme).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
    });
  });

  it('should declare the auth and users tags', () => {
    const document = buildOpenApiDocument(app);
    const tagNames = document.tags?.map((tag) => tag.name) ?? [];
    expect(tagNames).toContain('auth');
    expect(tagNames).toContain('users');
  });
});
