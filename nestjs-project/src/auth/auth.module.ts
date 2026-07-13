import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthConfig } from '../config/auth.config';
import { UsersModule } from '../users/users.module';
import { ChannelsModule } from '../channels/channels.module';
import { MailModule } from '../mail/mail.module';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { PasswordService } from './password.service';
import { PasswordResetTokenService } from './password-reset-token.service';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Authentication domain module: registration, confirmation, login and
 * session management (built incrementally across SI-02.9–02.15).
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const auth = config.get<AuthConfig>('auth')!;
        return {
          secret: auth.jwtSecret,
          signOptions: { expiresIn: auth.jwtAccessTtl },
        };
      },
    }),
    TypeOrmModule.forFeature([PasswordResetToken]),
    UsersModule,
    ChannelsModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    PasswordService,
    PasswordResetTokenService,
    AuthService,
    SessionService,
    LocalStrategy,
    JwtStrategy,
  ],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
