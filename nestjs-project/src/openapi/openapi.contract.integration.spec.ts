import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from './openapi.document';

interface EndpointExpectation {
  path: string;
  method: 'get' | 'post';
  tag: string;
  secured: boolean;
  statuses: number[];
}

const ENDPOINTS: EndpointExpectation[] = [
  {
    path: '/auth/register',
    method: 'post',
    tag: 'auth',
    secured: false,
    statuses: [201, 400, 409],
  },
  {
    path: '/auth/login',
    method: 'post',
    tag: 'auth',
    secured: false,
    statuses: [200, 400, 401, 403, 429],
  },
  {
    path: '/auth/refresh',
    method: 'post',
    tag: 'auth',
    secured: true,
    statuses: [200, 401],
  },
  {
    path: '/auth/logout',
    method: 'post',
    tag: 'auth',
    secured: true,
    statuses: [204, 401],
  },
  {
    path: '/auth/confirm',
    method: 'get',
    tag: 'auth',
    secured: false,
    statuses: [204, 400, 409],
  },
  {
    path: '/auth/resend-confirmation',
    method: 'post',
    tag: 'auth',
    secured: false,
    statuses: [204, 400, 429],
  },
  {
    path: '/auth/forgot-password',
    method: 'post',
    tag: 'auth',
    secured: false,
    statuses: [204, 400, 429],
  },
  {
    path: '/auth/reset-password',
    method: 'post',
    tag: 'auth',
    secured: false,
    statuses: [204, 400],
  },
  {
    path: '/users/me',
    method: 'get',
    tag: 'users',
    secured: true,
    statuses: [200, 401, 404],
  },
  { path: '/', method: 'get', tag: 'app', secured: false, statuses: [200] },
];

describe('openapi contract — existing controllers', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    document = buildOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  function getOperation(path: string, method: 'get' | 'post') {
    const operation = document.paths[path]?.[method];
    if (!operation) {
      throw new Error(
        `No ${method.toUpperCase()} operation declared for ${path}`,
      );
    }
    return operation;
  }

  describe.each(ENDPOINTS)(
    '$method $path',
    ({ path, method, tag, secured, statuses }) => {
      it('exists in the document under the expected tag', () => {
        const operation = getOperation(path, method);
        expect(operation.tags).toContain(tag);
      });

      it(`declares security ${secured ? '' : 'not '}as jwt-cookie`, () => {
        const operation = getOperation(path, method);
        if (secured) {
          expect(operation.security).toEqual(
            expect.arrayContaining([{ 'jwt-cookie': [] }]),
          );
        } else {
          expect(operation.security ?? []).toEqual([]);
        }
      });

      it('declares exactly the expected status codes', () => {
        const operation = getOperation(path, method);
        const declared = Object.keys(operation.responses ?? {})
          .map(Number)
          .sort((a, b) => a - b);
        expect(declared).toEqual([...statuses].sort((a, b) => a - b));
      });
    },
  );

  describe('DTO validation constraints (classValidatorShim, no @ApiProperty)', () => {
    it('declares email as string/format:email/maxLength:254 on RegisterDto', () => {
      const schema = document.components?.schemas?.RegisterDto as {
        properties: Record<
          string,
          { type?: string; format?: string; maxLength?: number }
        >;
      };
      expect(schema.properties.email).toMatchObject({
        type: 'string',
        format: 'email',
        maxLength: 254,
      });
    });

    it('declares password as string/minLength:8/maxLength:128 on RegisterDto', () => {
      const schema = document.components?.schemas?.RegisterDto as {
        properties: Record<
          string,
          { type?: string; minLength?: number; maxLength?: number }
        >;
      };
      expect(schema.properties.password).toMatchObject({
        type: 'string',
        minLength: 8,
        maxLength: 128,
      });
    });

    it('declares token as a required string on ResetPasswordDto', () => {
      const schema = document.components?.schemas?.ResetPasswordDto as {
        properties: Record<string, { type?: string }>;
        required?: string[];
      };
      expect(schema.properties.token).toMatchObject({ type: 'string' });
      expect(schema.required).toContain('token');
    });
  });
});
