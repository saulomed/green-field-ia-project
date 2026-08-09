import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AUTH_COOKIES } from '../auth/auth.constants';

/**
 * Builds the OpenAPI document from the app's controllers (code-first).
 * Pure function — takes an already-created app, does not start an HTTP server,
 * so SI-6's generation script can reuse it without a listening port.
 *
 * @author Saulo Santos
 * @date 09/08/2026
 * @param app - a Nest application instance (listening or not)
 * @returns the assembled OpenAPI document
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('StreamTube API')
    .setDescription(
      'API REST da plataforma StreamTube — upload, gerenciamento e publicação de vídeos.',
    )
    .setVersion('1.0.0')
    .setOpenAPIVersion('3.0.0')
    .addTag('auth', 'Autenticação e gerenciamento de conta')
    .addTag('users', 'Perfil do usuário autenticado')
    .addCookieAuth(AUTH_COOKIES.ACCESS_TOKEN, { type: 'apiKey' }, 'jwt-cookie')
    .build();

  return SwaggerModule.createDocument(app, config);
}
