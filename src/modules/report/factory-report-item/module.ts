import { Module } from '@nestjs/common';
import { FactoryReportItemModule as OriginalModule } from '../../factory-report-item/factory-report-item.module';

@Module({
  imports: [OriginalModule],
  exports: [OriginalModule],
})
export class ReportFactoryReportItemModule {}
