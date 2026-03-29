import { Module } from '@nestjs/common';
import { MinioClientService } from './minio-client.service';
import { MinioModule } from 'nestjs-minio-client';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MinioModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const MinIO = configService.getOrThrow('minIO');
        return {
          endPoint: MinIO.ENDPOINT,
          accessKey: MinIO.ACCESSKEY,
          secretKey: MinIO.SECRETKEY,
        };
      },
    }),
  ],
  providers: [MinioClientService],
  exports: [MinioClientService],
})
export class MinioClientModule {}
