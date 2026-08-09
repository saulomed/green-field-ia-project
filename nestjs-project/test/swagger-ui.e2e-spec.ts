import { INestApplication } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './support/create-test-app';
import { awaitMessageTo } from './support/mailpit';

describe('swagger-ui', () => {
  describe('1. Exposição por ambiente', () => {
    describe('1.1. ui-disponivel-quando-habilitado', () => {
      let app: INestApplication<App>;

      beforeAll(async () => {
        ({ app } = await createTestApp({
          swagger: { enabled: true, path: 'api/docs' },
        }));
      });

      afterAll(async () => {
        await app.close();
      });

      it('serves the Swagger UI at the configured path', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/docs')
          .expect(200);

        expect(response.headers['content-type']).toMatch(/^text\/html/);
        expect(response.text).toContain('swagger-ui');
      });

      it('serves the OpenAPI document as JSON', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/docs-json')
          .expect(200);

        const document = response.body as OpenAPIObject;
        expect(response.headers['content-type']).toMatch(/^application\/json/);
        expect(document.openapi).toBe('3.0.0');
        expect(Object.keys(document.paths).length).toBeGreaterThan(0);
      });
    });

    describe('1.2. ui-ausente-quando-desabilitado', () => {
      let app: INestApplication<App>;

      beforeAll(async () => {
        ({ app } = await createTestApp({ swagger: { enabled: false } }));
      });

      afterAll(async () => {
        await app.close();
      });

      it('returns 404 for the UI and the JSON document', async () => {
        await request(app.getHttpServer()).get('/api/docs').expect(404);
        await request(app.getHttpServer()).get('/api/docs-json').expect(404);
      });

      it('keeps other endpoints working', async () => {
        await request(app.getHttpServer()).get('/').expect(200);
      });
    });

    describe('1.3. path-configuravel-pelo-namespace', () => {
      let app: INestApplication<App>;

      beforeAll(async () => {
        ({ app } = await createTestApp({
          swagger: { enabled: true, path: 'docs-alternativo' },
        }));
      });

      afterAll(async () => {
        await app.close();
      });

      it('serves the UI only at the configured path', async () => {
        await request(app.getHttpServer()).get('/docs-alternativo').expect(200);
        await request(app.getHttpServer()).get('/api/docs').expect(404);
      });
    });
  });

  describe('2. Contrato do documento servido', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      ({ app } = await createTestApp({ swagger: { enabled: true } }));
    });

    afterAll(async () => {
      await app.close();
    });

    describe('2.1. documento-declara-security-scheme-de-cookie', () => {
      it('declares the jwt-cookie security scheme as apiKey over the access_token cookie', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/docs-json')
          .expect(200);

        const document = response.body as OpenAPIObject;
        const scheme = document.components?.securitySchemes?.['jwt-cookie'];
        expect(scheme).toMatchObject({
          type: 'apiKey',
          in: 'cookie',
          name: 'access_token',
        });
      });

      it('references jwt-cookie on protected endpoints', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/docs-json')
          .expect(200);

        const document = response.body as OpenAPIObject;
        const paths = document.paths;
        expect(paths['/auth/refresh']?.post?.security).toEqual(
          expect.arrayContaining([{ 'jwt-cookie': [] }]),
        );
        expect(paths['/auth/logout']?.post?.security).toEqual(
          expect.arrayContaining([{ 'jwt-cookie': [] }]),
        );
        expect(paths['/users/me']?.get?.security).toEqual(
          expect.arrayContaining([{ 'jwt-cookie': [] }]),
        );
      });

      it('does not declare security on a public endpoint', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/docs-json')
          .expect(200);

        const document = response.body as OpenAPIObject;
        const registerOp = document.paths['/auth/register']?.post;
        expect(registerOp?.security ?? []).toEqual([]);
      });
    });
  });

  describe('3. Sessão por cookie exercitada pelo contrato documentado', () => {
    let app: INestApplication<App>;
    let db: DataSource;

    beforeAll(async () => {
      ({ app } = await createTestApp({ swagger: { enabled: true } }));
      db = app.get<DataSource>(getDataSourceToken());
    });

    afterEach(async () => {
      await db.query(`DELETE FROM users WHERE email LIKE 'e2e-swagger-%'`);
    });

    afterAll(async () => {
      await app.close();
    });

    const password = 'super-secret-1';

    async function registerAndConfirmUser(email: string): Promise<void> {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(201);

      const message = await awaitMessageTo(email);
      const token = message!.Text.match(/token=(\S+)/)![1];

      await request(app.getHttpServer())
        .get('/auth/confirm')
        .query({ token })
        .expect(204);
    }

    describe('3.1. sessao-por-cookie-apos-login', () => {
      it('authenticates GET /users/me using cookies set by login, without any Authorization header', async () => {
        const email = 'e2e-swagger-session@example.com';
        await registerAndConfirmUser(email);

        const loginResponse = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email, password })
          .expect(200);

        const cookies = loginResponse.headers[
          'set-cookie'
        ] as unknown as string[];
        const accessCookie = cookies.find((c) =>
          c.startsWith('access_token='),
        )!;
        const refreshCookie = cookies.find((c) =>
          c.startsWith('refresh_token='),
        )!;
        expect(accessCookie).toContain('HttpOnly');
        expect(refreshCookie).toContain('Path=/auth');

        const meResponse = await request(app.getHttpServer())
          .get('/users/me')
          .set('Cookie', [accessCookie, refreshCookie])
          .expect(200);

        expect((meResponse.body as { email: string }).email).toBe(email);
      });

      it('rejects GET /users/me without any cookie', async () => {
        await request(app.getHttpServer()).get('/users/me').expect(401);
      });
    });
  });
});
