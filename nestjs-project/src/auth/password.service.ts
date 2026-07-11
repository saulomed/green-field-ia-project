import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AuthConfig } from '../config/auth.config';

/**
 * Encapsulates argon2id password hashing and timing-safe verification.
 * Single source for all hash/verify operations across auth flows.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Injectable()
export class PasswordService {
  private readonly argon2Options: argon2.Options;

  constructor(private readonly configService: ConfigService) {
    const argon2Cfg = this.configService.get<AuthConfig['argon2']>('auth.argon2');
    if (!argon2Cfg) {
      throw new Error('auth.argon2 config block is missing — ensure AuthModule imports authConfig');
    }
    const { memoryCost, timeCost, parallelism } = argon2Cfg;
    this.argon2Options = {
      type: argon2.argon2id,
      memoryCost,
      timeCost,
      parallelism,
    };
  }

  /**
   * Hashes a plaintext password with argon2id and a random salt.
   *
   * @param plain - Plaintext password
   * @returns PHC-encoded digest in the format `$argon2id$...`
   */
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.argon2Options);
  }

  /**
   * Verifies a plaintext password against a stored argon2id digest.
   * Returns `false` on mismatch without throwing.
   *
   * @param digest - Stored PHC-encoded hash
   * @param plain - Plaintext password to verify
   * @returns `true` if the password matches, `false` otherwise
   */
  async verify(digest: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(digest, plain);
    } catch {
      return false;
    }
  }
}
