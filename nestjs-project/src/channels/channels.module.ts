import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from './entities/channel.entity';

/**
 * Domain module for video channels.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Module({
  imports: [TypeOrmModule.forFeature([Channel])],
  exports: [TypeOrmModule],
})
export class ChannelsModule {}
