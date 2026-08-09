import { buildSwaggerOptions } from './swagger.config';

describe('buildSwaggerOptions', () => {
  it('should enable docs when SWAGGER_ENABLED=true', () => {
    const options = buildSwaggerOptions({ SWAGGER_ENABLED: 'true' });
    expect(options.enabled).toBe(true);
  });

  it('should disable docs when SWAGGER_ENABLED=false', () => {
    const options = buildSwaggerOptions({ SWAGGER_ENABLED: 'false' });
    expect(options.enabled).toBe(false);
  });

  it('should default enabled to true when SWAGGER_ENABLED is absent and NODE_ENV is not production', () => {
    const options = buildSwaggerOptions({ NODE_ENV: 'development' });
    expect(options.enabled).toBe(true);
  });

  it('should default enabled to false when SWAGGER_ENABLED is absent and NODE_ENV is production', () => {
    const options = buildSwaggerOptions({ NODE_ENV: 'production' });
    expect(options.enabled).toBe(false);
  });

  it('should default path to api/docs when SWAGGER_PATH is absent', () => {
    const options = buildSwaggerOptions({});
    expect(options.path).toBe('api/docs');
  });

  it('should use SWAGGER_PATH when provided', () => {
    const options = buildSwaggerOptions({ SWAGGER_PATH: 'docs-alternativo' });
    expect(options.path).toBe('docs-alternativo');
  });
});
