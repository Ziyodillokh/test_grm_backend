import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductHistory } from './product-history.entity';
import { Product } from '../product/product.entity';
import { ProductHistoryService } from './product-history.service';
import { ProductHistoryController } from './product-history.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductHistory, Product])],
  providers: [ProductHistoryService],
  controllers: [ProductHistoryController],
})
export class ProductHistoryModule {}