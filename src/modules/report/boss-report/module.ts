import { Module } from '@nestjs/common';
import { BossReportModule as OriginalModule } from '../../boss-report/boss-report.module';

@Module({
  imports: [OriginalModule],
  exports: [OriginalModule],
})
export class ReportBossReportModule {}
