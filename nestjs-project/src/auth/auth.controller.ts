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
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiValidationErrorResponse } from '../common/decorators/api-validation-error.decorator';
import { ApiDomainErrorResponse } from '../common/decorators/api-domain-error.decorator';
import { ApiRateLimitedResponse } from '../common/decorators/api-rate-limited.decorator';
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
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cria uma conta e o canal associado' })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiValidationErrorResponse()
  @ApiDomainErrorResponse(409, 'EMAIL_JA_EXISTE', 'E-mail já cadastrado')
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @Throttle({ [THROTTLER_NAME]: AUTH_THROTTLE.LOGIN })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autentica com e-mail e senha',
    description:
      'Em caso de sucesso, define os cookies httpOnly `access_token` e `refresh_token` (este com `path=/auth`).',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiValidationErrorResponse()
  @ApiDomainErrorResponse(
    401,
    'CREDENCIAIS_INVALIDAS',
    'E-mail ou senha incorretos',
  )
  @ApiDomainErrorResponse(
    403,
    'EMAIL_NAO_CONFIRMADO',
    'Conta ainda não confirmada',
  )
  @ApiRateLimitedResponse()
  async login(
    @Body() _dto: LoginDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    return this.authService.login(req.user, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('jwt-cookie')
  @ApiOperation({
    summary: 'Rotaciona o par de tokens de sessão',
    description:
      'Lê o cookie `refresh_token`; em caso de sucesso, reemite os cookies httpOnly `access_token` e `refresh_token` (este com `path=/auth`).',
  })
  @ApiOkResponse({ type: RefreshResponseDto })
  @ApiDomainErrorResponse(
    401,
    'SESSAO_INVALIDA',
    'Refresh token ausente, inválido ou expirado',
  )
  @ApiDomainErrorResponse(
    401,
    'TOKEN_REUTILIZADO',
    'Refresh token já rotacionado apresentado novamente',
  )
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
  @ApiCookieAuth('jwt-cookie')
  @ApiOperation({
    summary: 'Encerra a sessão',
    description:
      'Revoga o refresh token e limpa os cookies `access_token` e `refresh_token`.',
  })
  @ApiNoContentResponse()
  @ApiDomainErrorResponse(
    401,
    'SESSAO_INVALIDA',
    'Refresh token ausente, inválido ou expirado',
  )
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
  @ApiOperation({
    summary: 'Confirma a conta a partir do token enviado por e-mail',
  })
  @ApiNoContentResponse()
  @ApiDomainErrorResponse(
    400,
    'TOKEN_INVALIDO',
    'Token de confirmação inválido ou expirado',
  )
  @ApiDomainErrorResponse(
    409,
    'EMAIL_JA_CONFIRMADO',
    'Conta já confirmada anteriormente',
  )
  async confirm(@Query() dto: ConfirmDto): Promise<void> {
    await this.authService.confirmAccount(dto);
  }

  @Post('resend-confirmation')
  @Throttle({ [THROTTLER_NAME]: AUTH_THROTTLE.RESEND_CONFIRMATION })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reenvia o e-mail de confirmação de conta' })
  @ApiNoContentResponse()
  @ApiValidationErrorResponse()
  @ApiRateLimitedResponse()
  async resendConfirmation(@Body() dto: ResendConfirmationDto): Promise<void> {
    await this.authService.resendConfirmation(dto);
  }

  @Post('forgot-password')
  @Throttle({ [THROTTLER_NAME]: AUTH_THROTTLE.FORGOT_PASSWORD })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Inicia o fluxo de recuperação de senha' })
  @ApiNoContentResponse()
  @ApiValidationErrorResponse()
  @ApiRateLimitedResponse()
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Redefine a senha a partir do token enviado por e-mail',
  })
  @ApiNoContentResponse()
  @ApiValidationErrorResponse()
  @ApiDomainErrorResponse(
    400,
    'TOKEN_INVALIDO',
    'Token de redefinição inválido ou expirado',
  )
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto);
  }
}
