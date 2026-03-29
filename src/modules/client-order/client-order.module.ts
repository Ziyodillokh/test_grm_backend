import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientOrder } from './client-order.entity';
import { ClientOrderItem } from '../client-order-item/client-order-item.entity';
import { ClientOrderService } from './client-order.service';
import { ClientOrderController } from './client-order.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClientOrder, ClientOrderItem])],
  controllers: [ClientOrderController],
  providers: [ClientOrderService],
  exports: [ClientOrderService],
})
export class ClientOrderModule {}
