import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Cashflow } from './cashflow.entity';
import { CashflowService } from './cashflow.service';
import { CashflowController } from './cashflow.controller';
import { KassaModule } from '../kassa/kassa.module';
import { ActionModule } from '../action/action.module';
import { GrmSocketModule } from '../web-socket/web-socket.module';
import { DebtModule } from '../debt/debt.module';
import { CashflowTypeModule } from '../cashflow-type/cashflow-type.module';
import { ReportsModule } from '../report/report.module';
import { SellerReportItem } from '../seller-report-item/seller-report-item.entity';
import { User } from '../user/user.entity';
import { CollectionReportItem } from '../collection-report-item/collection-report-item.entity';
import { Filial } from '../filial/filial.entity';
import { FactoryReportItem } from '../factory-report-item/factory-report-item.entity';
import { CountryReportItem } from '../country-report-item/country-report-item.entity';
import { SellerReport } from '../seller-report/seller-report.entity';
import { Discount } from '../discount/discount.entity';
import { Order } from '@modules/order/order.entity';
import { ClientModule } from '@modules/client/client.module';
import { CashflowType } from '@modules/cashflow-type/cashflow-type.entity';
import { Kassa } from '@modules/kassa/kassa.entity';
import { OrderModule } from '@modules/order/order.module';
import { Report } from '@modules/report/report.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cashflow,
      SellerReportItem,
      SellerReport,
      User,
      CollectionReportItem,
      FactoryReportItem,
      CountryReportItem,
      Filial,
      Discount,
      Order,
      CashflowType,
      Kassa,
      Report,
    ]),
    forwardRef(() => KassaModule),
    ActionModule,
    forwardRef(() => ClientModule),
    forwardRef(() => ReportsModule),
    forwardRef(() => OrderModule),
    forwardRef(() => CashflowTypeModule),
    forwardRef(() => DebtModule), // bu yerda forwardRef qo‘shildi
    forwardRef(() => GrmSocketModule),
  ],
  controllers: [CashflowController],
  providers: [CashflowService],
  exports: [CashflowService],
})
export class CashflowModule {}
