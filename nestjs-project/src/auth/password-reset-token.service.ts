import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { AuthConfig } from '../config/auth.config';
import { InvalidTokenException } from '../common/exceptions/invalid-token.exception';
import { parseTtlToMs } from '../common/utils/parse-ttl';

/**
 * Manages opaque password-reset tokens: generation, single-use consumption,
 * and bulk invalidation. The raw token is returned only at issue time and
 * never stored — only its SHA-256 hash is persisted.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Injectable()
export class PasswordResetTokenService {
  private readonly resetTtlMs: number;

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepo: Repository<PasswordResetToken>,
    private readonly configService: ConfigService,
  ) {
    const resetTokenTtl = this.configService.get<AuthConfig['resetTokenTtl']>('auth.resetTokenTtl');
    this.resetTtlMs = parseTtlToMs(resetTokenTtl ?? '1h');
  }

  /**
   * Generates a 32-byte random opaque token, persists only its SHA-256 hash,
   * and returns the raw token in hex (returned once, never stored).
   *
   * @param userId - The user requesting a password reset
   * @returns The raw token in hex — pass this in the reset e-mail link
   */
  async issue(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + this.resetTtlMs);

    const entity = this.resetTokenRepo.create({ userId, tokenHash, expiresAt });
    await this.resetTokenRepo.save(entity);

    return rawToken;
  }

  /**
   * Validates the raw token, marks it as used, and returns the associated userId.
   * Rejects tokens that are absent, expired, or already used.
   *
   * @param rawToken - The hex token from the reset link
   * @returns The userId the token was issued for
   * @throws InvalidTokenException if the token is invalid, expired, or already used
   */
  async consume(rawToken: string): Promise<string> {
    const now = new Date();
    const tokenHash = sha256(rawToken);
    const record = await this.resetTokenRepo.findOne({ where: { tokenHash } });

    if (!record || record.usedAt !== null || record.expiresAt < now) {
      throw new InvalidTokenException();
    }

    await this.resetTokenRepo.update(record.id, { usedAt: now });

    return record.userId;
  }

  /**
   * Marks all unused (pending) reset tokens for the given user as used,
   * preventing them from being consumed after a new token is issued or
   * a reset is completed.
   *
   * @param userId - The user whose pending tokens should be invalidated
   */
  async invalidateAll(userId: string): Promise<void> {
    await this.resetTokenRepo
      .createQueryBuilder()
      .update(PasswordResetToken)
      .set({ usedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('used_at IS NULL')
      .execute();
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
