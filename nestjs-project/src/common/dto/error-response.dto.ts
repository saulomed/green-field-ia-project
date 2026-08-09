import { ApiProperty } from '@nestjs/swagger';

/**
 * Envelope de erro HTTP emitido pelo `HttpExceptionFilter` global.
 * Espelha byte a byte os campos escritos em `response.status(statusCode).json(...)`.
 *
 * Decorado explicitamente com `@ApiProperty` (não tem decorators de
 * `class-validator` para o CLI plugin inferir via `classValidatorShim`, e a
 * inferência puramente por tipo do plugin não roda sob `ts-jest` — só no
 * build via `nest build`).
 *
 * @author Saulo Santos
 * @date 09/08/2026
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({ example: 'email must be a valid email' })
  message: string;
}
