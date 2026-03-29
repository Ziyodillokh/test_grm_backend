import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Action } from './action.entity';
import { ActionRepository } from './action.repository';
import { ActionService } from './action.service';
import { ActionController } from './action.controller';
import { Order } from '../order/order.entity';
import { Cashflow } from '../cashflow/cashflow.entity';
import { Kassa } from '../kassa/kassa.entity';
import { QrBase } from '../qr-base/qr-base.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Action, Order, Cashflow, Kassa, QrBase])],
  controllers: [ActionController],
  providers: [ActionService, ActionRepository],
  exports: [ActionService, ActionRepository],
})
export class ActionModule {}
