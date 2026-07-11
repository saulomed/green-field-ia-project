import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { ChannelService } from '../channels/channel.service';
import { PasswordService } from './password.service';
import { MailService } from '../mail/mail.service';
import { AuthConfig } from '../config/auth.config';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { EmailAlreadyExistsException } from '../common/exceptions/email-already-exists.exception';

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

  private async sendConfirmationEmail(user: User, name: string): Promise<void> {
    try {
      const confirmTokenTtl = this.configService.get<
        AuthConfig['confirmTokenTtl']
      >('auth.confirmTokenTtl');
      const token = await this.jwtService.signAsync(
        { sub: user.id, purpose: 'confirm' },
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
