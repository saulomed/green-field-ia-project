import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Channel } from './entities/channel.entity';
import { User } from '../users/entities/user.entity';

/**
 * Creates and manages user channels, deriving nickname from the email prefix.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Injectable()
export class ChannelService {
  /**
   * Creates a channel for the given user within the provided transaction.
   * The nickname is derived from the email prefix (normalized to [a-z0-9]).
   * Collisions are resolved by appending a 4-character random alphanumeric suffix.
   *
   * @param user - The owning user
   * @param manager - EntityManager from the caller's transaction
   * @returns The persisted Channel entity
   */
  async createForUser(user: User, manager: EntityManager): Promise<Channel> {
    const base = this.normalizePrefix(user.email);
    const nickname = await this.resolveNickname(base, manager);

    const channel = manager.create(Channel, {
      userId: user.id,
      nickname,
      name: base,
      description: null,
    });

    return manager.save(Channel, channel);
  }

  /**
   * @param email - Full email address
   * @returns Lowercase alphanumeric prefix extracted before the '@'
   */
  normalizePrefix(email: string): string {
    const prefix = email.split('@')[0];
    return prefix.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private async resolveNickname(
    base: string,
    manager: EntityManager,
  ): Promise<string> {
    let candidate = base;

    while (await this.nicknameExists(candidate, manager)) {
      candidate = `${base}-${this.randomSuffix()}`;
    }

    return candidate;
  }

  private async nicknameExists(
    nickname: string,
    manager: EntityManager,
  ): Promise<boolean> {
    return manager.exists(Channel, { where: { nickname } });
  }

  private randomSuffix(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}
