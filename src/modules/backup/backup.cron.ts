import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BackupService } from './backup.service';
import * as dayjs from 'dayjs';

@Injectable()
export class BackupCron {
  constructor(private readonly backupService: BackupService) {}

  // Runs every day at 1:00 AM — logic inside decides if it's 1st, 15th, or last day
  @Cron('0 1 * * *') // every day at 1:00 AM
  async handleCron() {
    const today = dayjs();
    const day = today.date();
    const lastDay = today.endOf('month').date();

    if (day === 10 || day === 20 || day === lastDay) {
      await this.backupService.backupDatabase();
    }
  }
}
