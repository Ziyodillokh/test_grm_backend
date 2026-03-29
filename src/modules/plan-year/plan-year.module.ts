import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanYear } from './plan-year.entity';
import { PlanYearController } from './plan-year.controller';
import { PlanYearService } from './plan-year.service';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Filial } from '../filial/filial.entity';
import { User } from '../user/user.entity';
import { SellerReportItem } from '../seller-report-item/seller-report-item.entity';
import { SellerReport } from '../seller-report/seller-report.entity';
import { FilialPlanService } from '@modules/filial-plan/filial-plan.service';
import { Order } from '@modules/order/order.entity';
import { Kassa } from '../kassa/kassa.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlanYear, Cashflow, Filial, User, SellerReportItem, SellerReport, Order, Kassa])],
  controllers: [PlanYearController],
  providers: [PlanYearService, FilialPlanService],
  exports: [PlanYearService],
})
export class PlanYearModule {}
