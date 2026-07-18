import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Query parameters for GET /auth/confirm.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export class ConfirmDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
