import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountController } from './discount.controller';
import { DiscountService } from './discount.service';
import { Discount } from './discount.entity';
import { Order } from '../order/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Discount, Order])],
  controllers: [DiscountController],
  providers: [DiscountService],
  exports: [DiscountService],
})
export class DiscountModule {}
