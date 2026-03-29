import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Model } from './model.entity';
import { ModelService } from './model.service';
import { ModelController } from './model.controller';
import { Product } from '@modules/product/product.entity';
import { Order } from '@modules/order/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Model, Product, Order])],
  controllers: [ModelController],
  providers: [ModelService],
  exports: [ModelService],
})
export class ModelModule {}
