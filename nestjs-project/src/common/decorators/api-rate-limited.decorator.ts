import { applyDecorators } from '@nestjs/common';
import { ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

/**
 * Declara a resposta `429` (`LIMITE_EXCEDIDO`) das rotas protegidas por
 * `@Throttle`.
 *
 * @author Saulo Santos
 * @date 09/08/2026
 */
export function ApiRateLimitedResponse(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiTooManyRequestsResponse({
      description: 'Limite de requisições excedido (LIMITE_EXCEDIDO)',
      type: ErrorResponseDto,
    }),
  );
}
