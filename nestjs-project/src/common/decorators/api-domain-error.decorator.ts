import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

/**
 * Declara uma resposta de erro de domínio (uma linha do Error Catalog) para
 * um endpoint — status HTTP, código de erro (`error` no envelope) e descrição
 * legível.
 *
 * @author Saulo Santos
 * @date 09/08/2026
 * @param status - status HTTP da resposta (ex.: 404, 409)
 * @param error - código de erro de domínio emitido no campo `error` (ex.: `USUARIO_NAO_ENCONTRADO`)
 * @param description - descrição em português do gatilho do erro
 */
export function ApiDomainErrorResponse(
  status: number,
  error: string,
  description: string,
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiResponse({
      status,
      description: `${description} (${error})`,
      type: ErrorResponseDto,
    }),
  );
}
