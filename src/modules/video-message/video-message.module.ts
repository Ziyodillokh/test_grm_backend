import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VideoMessage } from './video-message.entity';
import { VideoMessageService } from './video-message.service';
import { VideoMessageController } from './video-message.controller';
import { User } from '../user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VideoMessage, User])],
  controllers: [VideoMessageController],
  providers: [VideoMessageService],
  exports: [VideoMessageService],
})
export class VideoMessageModule {}
