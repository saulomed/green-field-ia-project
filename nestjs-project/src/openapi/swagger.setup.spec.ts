import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from '../config/swagger.config';
import { setupSwagger } from './swagger.setup';

jest.mock('@nestjs/swagger', () => {
  const actual =
    jest.requireActual<typeof import('@nestjs/swagger')>('@nestjs/swagger');
  return {
    ...actual,
    SwaggerModule: {
      ...actual.SwaggerModule,
      createDocument: jest.fn().mockReturnValue({ openapi: '3.0.0' }),
      setup: jest.fn(),
    },
  };
});

function createAppMock(config: { enabled: boolean; path: string }) {
  return {
    get: jest.fn().mockReturnValue(config),
  } as unknown as INestApplication;
}

describe('setupSwagger', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not build a document nor register any route when enabled is false', () => {
    const app = createAppMock({ enabled: false, path: 'api/docs' });

    setupSwagger(app);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() identity check, not a call
    expect(SwaggerModule.createDocument).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() identity check, not a call
    expect(SwaggerModule.setup).not.toHaveBeenCalled();
  });

  it('should call SwaggerModule.setup with the namespace path when enabled is true', () => {
    const app = createAppMock({ enabled: true, path: 'docs-alternativo' });

    setupSwagger(app);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() identity check, not a call
    expect(SwaggerModule.setup).toHaveBeenCalledWith(
      'docs-alternativo',
      app,
      { openapi: '3.0.0' },
      { swaggerOptions: { withCredentials: true } },
    );
  });

  it('should read the swagger namespace via swaggerConfig.KEY', () => {
    const app = createAppMock({ enabled: false, path: 'api/docs' });

    setupSwagger(app);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() identity check, not a call
    expect(app.get).toHaveBeenCalledWith(swaggerConfig.KEY);
  });
});
