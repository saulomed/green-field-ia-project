import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

/**
 * Request body for POST /auth/login.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(8, 128)
  password: string;
}
