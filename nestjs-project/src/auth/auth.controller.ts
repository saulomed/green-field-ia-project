import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { ConfirmDto } from './dto/confirm.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';

/**
 * Authentication and account-management endpoints.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirm(@Body() dto: ConfirmDto): Promise<void> {
    await this.authService.confirmAccount(dto);
  }

  @Post('resend-confirmation')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendConfirmation(@Body() dto: ResendConfirmationDto): Promise<void> {
    await this.authService.resendConfirmation(dto);
  }
}
