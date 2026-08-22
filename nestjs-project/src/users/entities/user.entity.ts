import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';

/**
 * Registered user account. Owns exactly one Channel created at registration time.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /**
   * The person's full name, as submitted at registration. Seeds the display
   * name of the Channel created alongside the account, but is not the same
   * value: renaming the channel later leaves this untouched.
   */
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'boolean', default: false, name: 'is_confirmed' })
  isConfirmed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => Channel, (channel) => channel.user)
  channel: Channel;
}
