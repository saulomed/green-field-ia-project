import { IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * Request body for POST /auth/reset-password.
 *
 * @author Saulo Santos
 * @date 13/07/2026
 */
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @Length(8, 128)
  password: string;
}
