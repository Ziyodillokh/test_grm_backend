import { forwardRef, Module } from '@nestjs/common';
import { CollectionPriceController } from './collection-price.controller';
import { CollectionPriceService } from './collection-price.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionPrice } from './collection-price.entity';
import { ProductModule } from '../product/product.module';
import { Discount } from '../discount/discount.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CollectionPrice, Discount]), forwardRef(() => ProductModule)],
  controllers: [CollectionPriceController],
  providers: [CollectionPriceService],
  exports: [CollectionPriceService],
})
export class CollectionPriceModule {}
