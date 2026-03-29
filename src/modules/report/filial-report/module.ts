import { Module } from '@nestjs/common';
import { FilialReportModule as OriginalModule } from '../../filial-report/filial-report.module';

@Module({
  imports: [OriginalModule],
  exports: [OriginalModule],
})
export class ReportFilialReportModule {}
