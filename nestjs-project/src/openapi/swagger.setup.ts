import { INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from '../config/swagger.config';
import { buildOpenApiDocument } from './openapi.document';

/**
 * Mounts the Swagger UI + JSON document routes when the `swagger` namespace
 * resolves `enabled: true`; no-op (no routes registered, no document built)
 * otherwise.
 *
 * @author Saulo Santos
 * @date 09/08/2026
 * @param app - a Nest application instance, not yet listening
 */
export function setupSwagger(app: INestApplication): void {
  const { enabled, path } = app.get<ConfigType<typeof swaggerConfig>>(
    swaggerConfig.KEY,
  );

  if (!enabled) {
    return;
  }

  const document = buildOpenApiDocument(app);
  SwaggerModule.setup(path, app, document, {
    swaggerOptions: { withCredentials: true },
  });
}
