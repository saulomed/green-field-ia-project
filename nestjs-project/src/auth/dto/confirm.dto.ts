import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Request body for POST /auth/confirm.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export class ConfirmDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
