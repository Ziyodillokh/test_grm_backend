import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VideoMessage } from './video-message.entity';
import { VideoMessageService } from './video-message.service';
import { VideoMessageController } from './video-message.controller';
import { User } from '../user/user.entity';
import { MinioClientModule } from '../minio-client/minio-client.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VideoMessage, User]),
    MinioClientModule,
  ],
  controllers: [VideoMessageController],
  providers: [VideoMessageService],
  exports: [VideoMessageService],
})
export class VideoMessageModule {}
