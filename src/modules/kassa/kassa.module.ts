import { forwardRef, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Kassa } from './kassa.entity';
import { KassaService } from './kassa.service';
import { KassaController } from './kassa.controller';
import { KassaQueryParserMiddleware } from '../../infra/middleware';
import { FilialModule } from '../filial/filial.module';
import { ActionModule } from '../action/action.module';
import { ReportsModule } from '../report/report.module';
import { Report } from '../report/report.entity';
import { Order } from '../order/order.entity';
import { Filial } from '../filial/filial.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { User } from '../user/user.entity';
import { CashflowType } from '../cashflow-type/cashflow-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Kassa, Report, Order, Filial, Cashflow, User, CashflowType]),
    ActionModule,
    forwardRef(() => FilialModule),
    forwardRef(() => ReportsModule),
  ],
  controllers: [KassaController],
  providers: [KassaService],
  exports: [KassaService],
})
export class KassaModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(KassaQueryParserMiddleware).forRoutes({
      path: '/kassa',
      method: RequestMethod.GET,
    });
  }
}
