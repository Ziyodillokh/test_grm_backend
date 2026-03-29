import { Module } from '@nestjs/common';
import { CollectionReportItemModule as OriginalModule } from '../../collection-report-item/collection-report-item.module';

@Module({
  imports: [OriginalModule],
  exports: [OriginalModule],
})
export class ReportCollectionReportItemModule {}
