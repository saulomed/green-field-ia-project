import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from './entities/channel.entity';
import { ChannelService } from './channel.service';

/**
 * Domain module for video channels.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
@Module({
  imports: [TypeOrmModule.forFeature([Channel])],
  providers: [ChannelService],
  exports: [TypeOrmModule, ChannelService],
})
export class ChannelsModule {}
