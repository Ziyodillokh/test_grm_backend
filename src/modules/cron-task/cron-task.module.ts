import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KassaModule } from '../kassa/kassa.module';
import { CronTaskService } from './cron-task.service';
import { ReportsModule } from '../report/report.module';
import { SellerReportItemModule } from '../seller-report-item/seller-report-item.module';
import { SellerReportModule } from '../seller-report/seller-report.module';
import { PlanYear } from '../plan-year/plan-year.entity';
import { CollectionReportItemModule } from '../collection-report-item/collection-report-item.module';
import { OrderModule } from '../order/order.module';
import { FactoryReportItemModule } from '../factory-report-item/factory-report-item.module';
import { CountryReportItemModule } from '../country-report-item/country-report-item.module';
import { PlanYearModule } from '../plan-year/plan-year.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlanYear]),
    KassaModule,
    forwardRef(() => ReportsModule),
    SellerReportItemModule,
    SellerReportModule,
    CollectionReportItemModule,
    FactoryReportItemModule,
    CountryReportItemModule,
    OrderModule,
    PlanYearModule,
  ],
  providers: [CronTaskService],
  exports: [CronTaskService],
})
export class CronTaskModule {}
