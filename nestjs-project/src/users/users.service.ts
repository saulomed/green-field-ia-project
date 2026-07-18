import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { UserNotFoundException } from '../common/exceptions/user-not-found.exception';
import { ChannelService } from '../channels/channel.service';

/**
 * Payload for creating a user account. The password must already be hashed —
 * hashing is the auth domain's responsibility, not this service's.
 */
export interface CreateUserInput {
  email: string;
  passwordHash: string;
}

/**
 * Owns all persistence for the users table.
 *
 * @author Saulo Santos
 * @date 17/07/2026
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly channelService: ChannelService,
  ) {}

  /**
   * @param email - E-mail address to look up
   * @param manager - Optional EntityManager to join the caller's transaction
   * @returns Whether an account already exists for the e-mail
   */
  async existsByEmail(email: string, manager?: EntityManager): Promise<boolean> {
    return this.resolveRepository(manager).exists({ where: { email } });
  }

  /**
   * Persists a new, unconfirmed user account.
   *
   * @param input - E-mail and already-hashed password
   * @param manager - Optional EntityManager to join the caller's transaction
   * @returns The persisted User entity
   */
  async create(
    input: CreateUserInput,
    manager?: EntityManager,
  ): Promise<User> {
    const repository = this.resolveRepository(manager);
    const user = repository.create({
      email: input.email,
      passwordHash: input.passwordHash,
      isConfirmed: false,
    });

    return repository.save(user);
  }

  /**
   * @param email - E-mail address to look up
   * @returns The matching user, or null when the e-mail is unknown
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOneBy({ email });
  }

  /**
   * @param id - User id to look up
   * @returns The matching user, or null when the id is unknown
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }

  /**
   * Loads the authenticated user's public profile, including its channel.
   * Channel data comes from ChannelService, keeping this service off the
   * channel columns and off the User.channel relation.
   *
   * @param userId - Id extracted from the access token
   * @returns The profile without sensitive fields
   * @throws UserNotFoundException when the id has no matching account
   */
  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId);
    }

    const channel = await this.channelService.findByUserId(userId);

    return {
      id: user.id,
      email: user.email,
      isConfirmed: user.isConfirmed,
      createdAt: user.createdAt,
      channel: {
        nickname: channel!.nickname,
        name: channel!.name,
      },
    };
  }

  /**
   * Marks the account as having a confirmed e-mail address.
   *
   * @param userId - User to confirm
   */
  async markConfirmed(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isConfirmed: true });
  }

  /**
   * Replaces the account's password.
   *
   * @param userId - User whose password changes
   * @param passwordHash - The already-hashed new password
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.userRepository.update(userId, { passwordHash });
  }

  /**
   * A transactional manager owns its own repository instances; the injected one
   * would run outside the caller's transaction.
   */
  private resolveRepository(manager?: EntityManager): Repository<User> {
    return manager ? manager.getRepository(User) : this.userRepository;
  }
}
