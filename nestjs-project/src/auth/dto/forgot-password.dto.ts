import { IsEmail, MaxLength } from 'class-validator';

/**
 * Request body for POST /auth/forgot-password.
 *
 * @author Saulo Santos
 * @date 13/07/2026
 */
export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}
