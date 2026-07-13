import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Response } from 'express';
import { User } from '../users/entities/user.entity';
import { ChannelService } from '../channels/channel.service';
import { PasswordService } from './password.service';
import { SessionService, TokenPair } from './session.service';
import { PasswordResetTokenService } from './password-reset-token.service';
import { MailService } from '../mail/mail.service';
import { AuthConfig } from '../config/auth.config';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { ConfirmDto } from './dto/confirm.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailAlreadyExistsException } from '../common/exceptions/email-already-exists.exception';
import { EmailAlreadyConfirmedException } from '../common/exceptions/email-already-confirmed.exception';
import { InvalidTokenException } from '../common/exceptions/invalid-token.exception';
import { InvalidSessionException } from '../common/exceptions/invalid-session.exception';
import { EmailNotConfirmedException } from '../common/exceptions/email-not-confirmed.exception';
import { JWT_PURPOSE } from './auth.constants';

interface ConfirmTokenPayload {
  sub: string;
  purpose: string;
}

/**
 * Handles account registration: atomic user + channel creation, plus
 * best-effort dispatch of the account confirmation e-mail.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly passwordService: PasswordService,
    private readonly channelService: ChannelService,
    private readonly sessionService: SessionService,
    private readonly passwordResetTokenService: PasswordResetTokenService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Registers a new user: hashes the password, then atomically persists
   * the User and its Channel in a single transaction. On success, issues a
   * confirmation JWT and dispatches the confirmation e-mail best-effort —
   * a failure to send does not undo the registration.
   *
   * @param dto - Validated registration payload
   * @returns The created user's id, email and channel nickname
   * @throws EmailAlreadyExistsException if the e-mail is already registered
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const emailTaken = await this.dataSource.manager.exists(User, {
      where: { email: dto.email },
    });
    if (emailTaken) {
      throw new EmailAlreadyExistsException();
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const { user, channel } = await this.dataSource.transaction(
      async (manager) => {
        const emailExists = await manager.exists(User, {
          where: { email: dto.email },
        });
        if (emailExists) {
          throw new EmailAlreadyExistsException();
        }

        const user = manager.create(User, {
          email: dto.email,
          passwordHash,
          isConfirmed: false,
        });
        await manager.save(User, user);

        const channel = await this.channelService.createForUser(user, manager);

        return { user, channel };
      },
    );

    await this.sendConfirmationEmail(user, channel.name);

    return {
      id: user.id,
      email: user.email,
      channel: { nickname: channel.nickname },
    };
  }

  /**
   * Activates the account identified by a confirmation JWT.
   *
   * @throws InvalidTokenException if the token is absent, expired, or not a confirm token
   * @throws EmailAlreadyConfirmedException if the account is already confirmed (also covers token replay)
   */
  async confirmAccount(dto: ConfirmDto): Promise<void> {
    const payload = await this.verifyConfirmToken(dto.token);

    const user = await this.dataSource.manager.findOneBy(User, {
      id: payload.sub,
    });
    if (!user) {
      throw new InvalidTokenException();
    }
    if (user.isConfirmed) {
      throw new EmailAlreadyConfirmedException();
    }

    await this.dataSource.manager.update(User, user.id, {
      isConfirmed: true,
    });
  }

  /**
   * Re-sends the confirmation e-mail for a pending account. Always resolves
   * without revealing whether the e-mail belongs to an account or its
   * confirmation state — the caller receives a neutral response either way.
   * Previously issued confirmation JWTs remain valid until they expire.
   */
  async resendConfirmation(dto: ResendConfirmationDto): Promise<void> {
    const user = await this.dataSource.manager.findOne(User, {
      where: { email: dto.email },
      relations: { channel: true },
      select: { channel: { name: true } },
    });

    if (user && !user.isConfirmed) {
      await this.sendConfirmationEmail(user, user.channel.name);
    }
  }

  /**
   * Verifies e-mail/password credentials for the local login strategy.
   * Loads the user's channel alongside it, since a successful login needs
   * the nickname for its response.
   *
   * @returns The matching user, or `null` if the e-mail is unknown or the password is wrong
   */
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.dataSource.manager.findOne(User, {
      where: { email },
      relations: { channel: true },
    });
    if (!user) {
      return null;
    }

    const valid = await this.passwordService.verify(
      user.passwordHash,
      password,
    );
    return valid ? user : null;
  }

  /**
   * Issues a session for a user already authenticated by LocalAuthGuard.
   *
   * @param user - The credential-validated user, with its channel loaded
   * @param res - Response the session cookies are attached to
   * @throws EmailNotConfirmedException if the account's e-mail is not confirmed
   */
  async login(user: User, res: Response): Promise<LoginResponseDto> {
    if (!user.isConfirmed) {
      throw new EmailNotConfirmedException();
    }

    const pair = await this.sessionService.issuePair(user);
    this.sessionService.setAuthCookies(res, pair);

    return {
      id: user.id,
      email: user.email,
      channel: { nickname: user.channel.nickname },
    };
  }

  /**
   * Rotates the session identified by the raw refresh token cookie, issuing
   * a fresh access/refresh pair.
   *
   * @param rawRefreshToken - Raw refresh JWT from the `refresh_token` cookie, if present
   * @param res - Response the rotated session cookies are attached to
   * @throws InvalidSessionException if the cookie is absent, malformed, or unknown
   * @throws RefreshTokenReusedException if the token had already been rotated (reuse)
   */
  async refresh(
    rawRefreshToken: string | undefined,
    res: Response,
  ): Promise<RefreshResponseDto> {
    if (!rawRefreshToken) {
      throw new InvalidSessionException();
    }

    let userId: string;
    let pair: TokenPair;
    try {
      ({ pair, userId } = await this.sessionService.rotate(rawRefreshToken));
    } catch (err) {
      if (err instanceof InvalidTokenException) {
        throw new InvalidSessionException();
      }
      throw err;
    }

    this.sessionService.setAuthCookies(res, pair);

    const user = await this.dataSource.manager.findOneByOrFail(User, {
      id: userId,
    });

    return { id: user.id, email: user.email };
  }

  /**
   * Ends the current session: revokes the rotation family tied to the
   * refresh token cookie (if resolvable) and clears both session cookies.
   *
   * @param rawRefreshToken - Raw refresh JWT from the `refresh_token` cookie, if present
   * @param res - Response the cookie clearing is attached to
   */
  async logout(
    rawRefreshToken: string | undefined,
    res: Response,
  ): Promise<void> {
    if (rawRefreshToken) {
      await this.sessionService.revokeFamilyForRawToken(rawRefreshToken);
    }
    this.sessionService.clearAuthCookies(res);
  }

  /**
   * Requests a password reset for the given e-mail. Always resolves without
   * revealing whether the e-mail belongs to an account — the caller receives
   * a neutral response either way. For a known account, any pending reset
   * tokens are invalidated before a fresh one is issued and e-mailed.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.dataSource.manager.findOne(User, {
      where: { email: dto.email },
      relations: { channel: true },
      select: { channel: { name: true } },
    });

    if (user) {
      const [, token] = await Promise.all([
        this.passwordResetTokenService.invalidateAll(user.id),
        this.passwordResetTokenService.issue(user.id),
      ]);
      await this.mailService.sendPasswordReset(
        user.email,
        user.channel.name,
        token,
      );
    }
  }

  /**
   * Redeems a password reset token: hashes and persists the new password,
   * invalidates any other pending reset tokens, and revokes every active
   * session for the user.
   *
   * @throws InvalidTokenException if the token is absent, expired, or already used
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const [userId, passwordHash] = await Promise.all([
      this.passwordResetTokenService.consume(dto.token),
      this.passwordService.hash(dto.password),
    ]);

    await this.dataSource.manager.update(User, userId, { passwordHash });
    await Promise.all([
      this.passwordResetTokenService.invalidateAll(userId),
      this.sessionService.revokeAllForUser(userId),
    ]);
  }

  private async verifyConfirmToken(
    token: string,
  ): Promise<ConfirmTokenPayload> {
    let payload: ConfirmTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<ConfirmTokenPayload>(token);
    } catch {
      throw new InvalidTokenException();
    }

    if (payload.purpose !== JWT_PURPOSE.CONFIRM) {
      throw new InvalidTokenException();
    }
    return payload;
  }

  private async sendConfirmationEmail(user: User, name: string): Promise<void> {
    try {
      const confirmTokenTtl = this.configService.get<
        AuthConfig['confirmTokenTtl']
      >('auth.confirmTokenTtl');
      const token = await this.jwtService.signAsync(
        { sub: user.id, purpose: JWT_PURPOSE.CONFIRM },
        { expiresIn: confirmTokenTtl },
      );
      await this.mailService.sendConfirmation(user.email, name, token);
    } catch (err) {
      this.logger.error(
        `Failed to send confirmation e-mail to ${user.email}`,
        err,
      );
    }
  }
}
