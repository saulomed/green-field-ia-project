import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Channel } from './entities/channel.entity';
import { User } from '../users/entities/user.entity';

/**
 * Creates and manages user channels, deriving nickname from the email prefix.
 * Owns all persistence for the channels table.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Injectable()
export class ChannelService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
  ) {}

  /**
   * Creates a channel for the given user. The nickname is derived from the
   * email prefix (normalized to [a-z0-9]); collisions are resolved by appending
   * a 4-character random alphanumeric suffix.
   *
   * @param user - The owning user
   * @param manager - Optional EntityManager to join the caller's transaction
   * @returns The persisted Channel entity
   */
  async createForUser(user: User, manager?: EntityManager): Promise<Channel> {
    const repository = this.resolveRepository(manager);
    const base = this.normalizePrefix(user.email);
    const nickname = await this.resolveNickname(base, repository);

    const channel = repository.create({
      userId: user.id,
      nickname,
      name: base,
      description: null,
    });

    return repository.save(channel);
  }

  /**
   * @param userId - Owning user id
   * @returns The user's channel, or null when the user has none
   */
  async findByUserId(userId: string): Promise<Channel | null> {
    return this.channelRepository.findOneBy({ userId });
  }

  /**
   * @param email - Full email address
   * @returns Lowercase alphanumeric prefix extracted before the '@'
   */
  normalizePrefix(email: string): string {
    const prefix = email.split('@')[0];
    return prefix.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * A transactional manager owns its own repository instances; the injected one
   * would run outside the caller's transaction.
   */
  private resolveRepository(manager?: EntityManager): Repository<Channel> {
    return manager ? manager.getRepository(Channel) : this.channelRepository;
  }

  private async resolveNickname(
    base: string,
    repository: Repository<Channel>,
  ): Promise<string> {
    let candidate = base;

    while (await repository.exists({ where: { nickname: candidate } })) {
      candidate = `${base}-${this.randomSuffix()}`;
    }

    return candidate;
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
