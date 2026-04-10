import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PartiyaCollectionPrice } from './partiya-collection-price.entity';
import { PartiyaCollectionPriceService } from './partiya-collection-price.service';
import { PartiyaCollectionPriceController } from './partiya-collection-price.controller';
import { Partiya } from '../partiya/partiya.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PartiyaCollectionPrice, Partiya])],
  controllers: [PartiyaCollectionPriceController],
  providers: [PartiyaCollectionPriceService],
  exports: [PartiyaCollectionPriceService],
})
export class PartiyaCollectionPriceModule {}
