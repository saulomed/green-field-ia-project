import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ChannelsModule } from '../channels/channels.module';

/**
 * Domain module for user accounts.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Module({
  imports: [TypeOrmModule.forFeature([User]), ChannelsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
