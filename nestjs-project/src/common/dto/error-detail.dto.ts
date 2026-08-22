import { ApiProperty } from '@nestjs/swagger';

/**
 * Per-field violation entry inside `ErrorResponseDto.details`.
 * Emitted only for `400` validation errors — a `DomainException` never
 * carries `details`.
 *
 * @author Saulo Santos
 * @date 22/08/2026
 */
export class ErrorDetailDto {
  @ApiProperty({ example: 'email' })
  field: string;

  @ApiProperty({ example: 'email must be a valid email' })
  message: string;
}
