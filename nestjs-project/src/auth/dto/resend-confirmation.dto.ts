import { IsEmail, MaxLength } from 'class-validator';

/**
 * Request body for POST /auth/resend-confirmation.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export class ResendConfirmationDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}
