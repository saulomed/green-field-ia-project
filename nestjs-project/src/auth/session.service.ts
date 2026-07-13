import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { CookieOptions, Response } from 'express';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthConfig } from '../config/auth.config';
import { AUTH_COOKIES } from './auth.constants';
import { InvalidTokenException } from '../common/exceptions/invalid-token.exception';
import { RefreshTokenReusedException } from '../common/exceptions/refresh-token-reused.exception';
import { parseTtlToMs } from '../common/utils/parse-ttl';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RotateResult {
  pair: TokenPair;
  userId: string;
}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

/**
 * Issues, rotates, and revokes refresh-token families for session management.
 * Only the refresh JWT's `jti` is persisted — the signed tokens themselves
 * never touch the database (DT-04, RFC 9700 rotation + reuse detection).
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Injectable()
export class SessionService {
  private readonly auth: AuthConfig;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.auth = configService.get<AuthConfig>('auth')!;
  }

  /**
   * Issues a fresh access/refresh pair for a newly authenticated user,
   * starting a new rotation family.
   */
  async issuePair(user: User): Promise<TokenPair> {
    return this.issuePairForFamily(
      this.dataSource.manager,
      user.id,
      randomUUID(),
    );
  }

  /**
   * Validates a raw refresh JWT and rotates it: revokes the token used and
   * issues a new pair in the same family. If the token was already revoked
   * (reuse of a token from an earlier rotation), the entire family is
   * revoked and rotation is rejected.
   *
   * @throws InvalidTokenException if the JWT is invalid/expired or unknown
   * @throws RefreshTokenReusedException if the token was already rotated (reuse)
   */
  async rotate(rawRefreshToken: string): Promise<RotateResult> {
    let payload: RefreshTokenPayload;
    try {
      payload =
        await this.jwtService.verifyAsync<RefreshTokenPayload>(rawRefreshToken);
    } catch {
      throw new InvalidTokenException();
    }

    // Reuse revocation must survive even though this method ultimately throws:
    // returning (rather than throwing) inside the transaction lets it commit,
    // and RefreshTokenReusedException is raised only after that commit succeeds.
    const result = await this.dataSource.transaction(async (manager) => {
      const current = await manager.findOneBy(RefreshToken, {
        jti: payload.jti,
      });
      if (!current) {
        throw new InvalidTokenException();
      }

      if (current.revokedAt) {
        await this.revokeWhere(manager, 'family_id', current.familyId);
        return { reused: true as const };
      }

      const pair = await this.issuePairForFamily(
        manager,
        current.userId,
        current.familyId,
        current.id,
      );
      return { reused: false as const, userId: current.userId, pair };
    });

    if (result.reused) {
      throw new RefreshTokenReusedException();
    }
    return { pair: result.pair, userId: result.userId };
  }

  /** Revokes every non-revoked token in a rotation family (logout, reuse detection). */
  async revokeFamily(familyId: string): Promise<void> {
    await this.revokeWhere(this.dataSource.manager, 'family_id', familyId);
  }

  /**
   * Resolves the rotation family of a raw refresh token and revokes it
   * (logout). The token is only decoded, not signature-verified — a
   * forged or stale `jti` simply matches no row and this becomes a no-op,
   * so logout can stay best-effort without weakening revocation elsewhere.
   */
  async revokeFamilyForRawToken(rawRefreshToken: string): Promise<void> {
    const payload =
      this.jwtService.decode<RefreshTokenPayload>(rawRefreshToken);
    if (!payload?.jti) {
      return;
    }

    const current = await this.dataSource.manager.findOneBy(RefreshToken, {
      jti: payload.jti,
    });
    if (!current) {
      return;
    }

    await this.revokeFamily(current.familyId);
  }

  /** Revokes every non-revoked token belonging to a user, across all families (password reset). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.revokeWhere(this.dataSource.manager, 'user_id', userId);
  }

  /** Sets `access_token` and `refresh_token` as httpOnly cookies (refresh scoped to `/auth`). */
  setAuthCookies(res: Response, pair: TokenPair): void {
    const base = this.baseCookieOptions();

    res.cookie(AUTH_COOKIES.ACCESS_TOKEN, pair.accessToken, {
      ...base,
      maxAge: parseTtlToMs(this.auth.jwtAccessTtl),
    });
    res.cookie(AUTH_COOKIES.REFRESH_TOKEN, pair.refreshToken, {
      ...base,
      maxAge: parseTtlToMs(this.auth.jwtRefreshTtl),
      path: '/auth',
    });
  }

  /** Clears both session cookies (logout). */
  clearAuthCookies(res: Response): void {
    const base = this.baseCookieOptions();

    res.clearCookie(AUTH_COOKIES.ACCESS_TOKEN, base);
    res.clearCookie(AUTH_COOKIES.REFRESH_TOKEN, { ...base, path: '/auth' });
  }

  private baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.auth.cookie.secure,
      sameSite: this.auth.cookie.sameSite,
    };
  }

  private async issuePairForFamily(
    manager: EntityManager,
    userId: string,
    familyId: string,
    replacedId?: string,
  ): Promise<TokenPair> {
    const jti = randomUUID();
    const expiresAt = new Date(
      Date.now() + parseTtlToMs(this.auth.jwtRefreshTtl),
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId },
        { expiresIn: this.auth.jwtAccessTtl },
      ),
      this.jwtService.signAsync(
        { sub: userId },
        { expiresIn: this.auth.jwtRefreshTtl, jwtid: jti },
      ),
    ]);

    const entity = manager.create(RefreshToken, {
      userId,
      jti,
      familyId,
      expiresAt,
    });
    const saved = await manager.save(RefreshToken, entity);

    if (replacedId) {
      await manager.update(RefreshToken, replacedId, {
        revokedAt: new Date(),
        replacedById: saved.id,
      });
    }

    return { accessToken, refreshToken };
  }

  private async revokeWhere(
    manager: EntityManager,
    column: 'family_id' | 'user_id',
    value: string,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where(`${column} = :value`, { value })
      .andWhere('revoked_at IS NULL')
      .execute();
  }
}
