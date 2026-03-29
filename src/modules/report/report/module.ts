import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entity';
import { ReportReportController } from './controller';
import { ReportService } from '../../report/report.service';
import { Filial } from '../../filial/filial.entity';
import { Kassa } from '../../kassa/kassa.entity';
import { KassaModule } from '../../kassa/kassa.module';
import { FilialModule } from '../../filial/filial.module';
import { Cashflow } from '../../cashflow/cashflow.entity';
import { ActionModule } from '@modules/action/action.module';
import { User } from '@modules/user/user.entity';
import { PackageTransfer } from '@modules/package-transfer/package-transfer.entity';
import { Order } from '@modules/order/order.entity';
import { RedisProvider } from '../../../redis/redis.provider';
import { Product } from '@modules/product/product.entity';
import { Transfer } from '@modules/transfer/transfer.entity';
import { PlanYearModule } from '@modules/plan-year/plan-year.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Kassa, Filial, Cashflow, User, PackageTransfer, Order, Product, Transfer]),
    ActionModule,
    PlanYearModule,
    forwardRef(() => KassaModule),
    forwardRef(() => FilialModule),
  ],
  controllers: [ReportReportController],
  providers: [ReportService, RedisProvider],
  exports: [ReportService],
})
export class ReportReportModule {}
