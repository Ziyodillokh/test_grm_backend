import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BossReport } from './boss-report.entity';
import { BossReportController } from './boss-report.controller';
import { BossReportService } from './boss-report.service';
import { ReportsModule } from '../report/report.module';
import { Report } from '../report/report.entity';
import { Order } from '@modules/order/order.entity';
import { Cashflow } from '@modules/cashflow/cashflow.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BossReport, Report, Order, Cashflow]), forwardRef(() => ReportsModule)],
  controllers: [BossReportController],
  providers: [BossReportService],
  exports: [BossReportService],
})
export class BossReportModule {}
