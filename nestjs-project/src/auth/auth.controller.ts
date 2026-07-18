import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { ConfirmDto } from './dto/confirm.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedRequest } from './types/authenticated-request';
import { AUTH_COOKIES } from './auth.constants';
import { readCookie } from './read-cookie';
import {
  AUTH_THROTTLE,
  THROTTLER_NAME,
} from '../common/constants/throttle.constants';

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

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @Throttle({ [THROTTLER_NAME]: AUTH_THROTTLE.LOGIN })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() _dto: LoginDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    return this.authService.login(req.user, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    return this.authService.refresh(
      readCookie(req, AUTH_COOKIES.REFRESH_TOKEN),
      res,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(
      readCookie(req, AUTH_COOKIES.REFRESH_TOKEN),
      res,
    );
  }

  @Get('confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirm(@Query() dto: ConfirmDto): Promise<void> {
    await this.authService.confirmAccount(dto);
  }

  @Post('resend-confirmation')
  @Throttle({ [THROTTLER_NAME]: AUTH_THROTTLE.RESEND_CONFIRMATION })
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendConfirmation(@Body() dto: ResendConfirmationDto): Promise<void> {
    await this.authService.resendConfirmation(dto);
  }

  @Post('forgot-password')
  @Throttle({ [THROTTLER_NAME]: AUTH_THROTTLE.FORGOT_PASSWORD })
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto);
  }
}
