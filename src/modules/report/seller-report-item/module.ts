import { Module } from '@nestjs/common';
import { SellerReportItemModule as OriginalModule } from '../../seller-report-item/seller-report-item.module';

@Module({
  imports: [OriginalModule],
  exports: [OriginalModule],
})
export class ReportSellerReportItemModule {}
