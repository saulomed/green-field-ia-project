import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/strategies/jwt.strategy';

/**
 * Request whose `user` was populated by JwtAuthGuard with the token payload.
 */
type JwtRequest = Request & { user: AccessTokenPayload };

/**
 * User account endpoints.
 *
 * @author Saulo Santos
 * @date 18/07/2026
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Returns the authenticated user's profile. Requires a valid access token
   * cookie — used to exercise token-protected requests end to end.
   *
   * @param req - Request carrying the token payload on `user`
   * @returns The authenticated user's public profile
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: JwtRequest): Promise<UserProfileResponseDto> {
    return this.usersService.getProfile(req.user.sub);
  }
}
