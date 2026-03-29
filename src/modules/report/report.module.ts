import { Module } from '@nestjs/common';
import { ReportReportModule } from './report/module';
import { ReportSellerReportModule } from './seller-report/module';
import { ReportSellerReportItemModule } from './seller-report-item/module';
import { ReportBossReportModule } from './boss-report/module';
import { ReportFilialReportModule } from './filial-report/module';
import { ReportCollectionReportItemModule } from './collection-report-item/module';
import { ReportFactoryReportItemModule } from './factory-report-item/module';
import { ReportCountryReportItemModule } from './country-report-item/module';

@Module({
  imports: [
    ReportReportModule,
    ReportSellerReportModule,
    ReportSellerReportItemModule,
    ReportBossReportModule,
    ReportFilialReportModule,
    ReportCollectionReportItemModule,
    ReportFactoryReportItemModule,
    ReportCountryReportItemModule,
  ],
  exports: [
    ReportReportModule,
    ReportSellerReportModule,
    ReportSellerReportItemModule,
    ReportBossReportModule,
    ReportFilialReportModule,
    ReportCollectionReportItemModule,
    ReportFactoryReportItemModule,
    ReportCountryReportItemModule,
  ],
})
export class ReportsModule {}
