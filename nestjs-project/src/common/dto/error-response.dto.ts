import { ApiProperty } from '@nestjs/swagger';
import { ErrorCode } from './error-code.enum';
import { ErrorDetailDto } from './error-detail.dto';

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

  @ApiProperty({
    enum: ErrorCode,
    enumName: 'ErrorCode',
    example: ErrorCode.EMAIL_JA_EXISTE,
  })
  error: ErrorCode;

  @ApiProperty({ example: 'email must be a valid email' })
  message: string;

  @ApiProperty({
    type: () => [ErrorDetailDto],
    required: false,
    description:
      'Presente apenas quando o erro tem granularidade por campo (violações de validação).',
  })
  details?: ErrorDetailDto[];
}
