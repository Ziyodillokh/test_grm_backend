import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Size } from './size.entity';
import { SizeService } from './size.service';
import { SizeController } from './size.controller';
import { Product } from '@modules/product/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Size, Product]),],
  controllers: [SizeController],
  providers: [SizeService],
  exports: [SizeService],
})
export class SizeModule {}
