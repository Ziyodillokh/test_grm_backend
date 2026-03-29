import { forwardRef, MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from './order.entity';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { ProductModule } from '../product/product.module';
import { KassaModule } from '../kassa/kassa.module';
import { ActionModule } from '../action/action.module';
import { CashflowModule } from '../cashflow/cashflow.module';
import { GrmSocketModule } from '../web-socket/web-socket.module';
import { OrderQueryParserMiddleware } from 'src/infra/middleware';
import { FilialModule } from '../filial/filial.module';
import { OrderBasketModule } from '../order-basket/order-basket.module';
import { TransferModule } from '../transfer/transfer.module';
import { CashflowTypeModule } from '../cashflow-type/cashflow-type.module';
import { SellerReportModule } from '../seller-report/seller-report.module';
import { ClientModule } from '../client/client.module';
import { Client } from '@modules/client/client.entity';
import { Cashflow } from '@modules/cashflow/cashflow.entity';
import { Kassa } from '@modules/kassa/kassa.entity';
import { Product } from '@modules/product/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Client, Cashflow, Kassa, Product]),
    forwardRef(() => GrmSocketModule),
    ProductModule,
    KassaModule,
    ActionModule,
    forwardRef(() => CashflowModule),
    FilialModule,
    OrderBasketModule,
    TransferModule,
    CashflowTypeModule,
    SellerReportModule,
    ClientModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(OrderQueryParserMiddleware)
      .forRoutes(
        { path: '/order', method: RequestMethod.GET },
        { path: '/order/order-by-kassa/:id', method: RequestMethod.GET },
        { path: '/order/discount/by/order', method: RequestMethod.GET },
        { path: '/order/selling/counts', method: RequestMethod.GET },
      );
  }
}
