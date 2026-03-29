import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Media } from './media.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { MinioClientModule } from '../minio-client/minio-client.module';

@Module({
  imports: [TypeOrmModule.forFeature([Media]), MinioClientModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {
}
