import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientOrderItem } from './client-order-item.entity';
import { ClientOrderItemService } from './client-order-item.service';
import { ClientOrderItemController } from './client-order-item.controller';
import { Product } from '@modules/product/product.entity';
import { ClientOrder } from '@modules/client-order/client-order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClientOrderItem, Product, ClientOrder])],
  providers: [ClientOrderItemService],
  controllers: [ClientOrderItemController],
  exports: [ClientOrderItemService],
})
export class ClientOrderItemModule {}
