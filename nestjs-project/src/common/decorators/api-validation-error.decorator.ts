import { applyDecorators } from '@nestjs/common';
import { ApiBadRequestResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

/**
 * Declara a resposta `400` emitida pelo `ValidationPipe` global quando o
 * `class-validator` rejeita o corpo da requisição.
 *
 * @author Saulo Santos
 * @date 09/08/2026
 */
export function ApiValidationErrorResponse(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiBadRequestResponse({
      description: 'Falha de validação do corpo da requisição',
      type: ErrorResponseDto,
    }),
  );
}
