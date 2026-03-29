// storage.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BackupService } from './backup.service';
import { BackupCron } from './backup.cron';
import { BackupController } from './backup.controller';
import { MinioClientModule } from '../minio-client/minio-client.module'; // ✅ updated

@Module({
  controllers: [BackupController],
  imports: [
    ScheduleModule.forRoot(),
    MinioClientModule, // ✅ use this instead of MinioModule directly
  ],
  providers: [BackupService, BackupCron],
})
export class StorageModule {}
