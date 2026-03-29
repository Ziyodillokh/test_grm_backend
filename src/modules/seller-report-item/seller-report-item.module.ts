import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerReportItem } from './seller-report-item.entity';
import { SellerReportItemController } from './seller-report-item.controller';
import { SellerReportItemService } from './seller-report-item.service';
import { Order } from '../order/order.entity';
import { User } from '../user/user.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Filial } from '../filial/filial.entity';
import { SellerReport } from '../seller-report/seller-report.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SellerReportItem, Order, User, Filial, SellerReport])],
  controllers: [SellerReportItemController],
  providers: [SellerReportItemService],
  exports: [SellerReportItemService],
})
export class SellerReportItemModule {}
