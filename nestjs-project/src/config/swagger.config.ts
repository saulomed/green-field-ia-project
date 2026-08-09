import { registerAs, ConfigType } from '@nestjs/config';

/**
 * Builds the swagger namespace options from an environment variable map.
 * Pure function so the env → namespace mapping is testable without ConfigModule.
 *
 * @author Saulo Santos
 * @date 09/08/2026
 * @param env - environment variable map (process.env or a test stub)
 * @returns whether the docs routes are exposed and at which path
 */
export function buildSwaggerOptions(env: NodeJS.ProcessEnv): {
  enabled: boolean;
  path: string;
} {
  return {
    enabled:
      env.SWAGGER_ENABLED !== undefined
        ? env.SWAGGER_ENABLED === 'true'
        : env.NODE_ENV !== 'production',
    path: env.SWAGGER_PATH || 'api/docs',
  };
}

/**
 * Swagger configuration namespace registered with @nestjs/config.
 * Governs whether the OpenAPI UI/document routes are exposed and at which path.
 *
 * @author Saulo Santos
 * @date 09/08/2026
 */
export const swaggerConfig = registerAs('swagger', () =>
  buildSwaggerOptions(process.env),
);

export type SwaggerConfig = ConfigType<typeof swaggerConfig>;
