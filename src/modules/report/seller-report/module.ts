import { Module } from '@nestjs/common';
import { SellerReportModule as OriginalSellerReportModule } from '../../seller-report/seller-report.module';

@Module({
  imports: [OriginalSellerReportModule],
  exports: [OriginalSellerReportModule],
})
export class ReportSellerReportModule {}
