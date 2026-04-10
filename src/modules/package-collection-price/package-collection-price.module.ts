import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PackageCollectionPrice } from './package-collection-price.entity';
import { PackageCollectionPriceService } from './package-collection-price.service';
import { PackageCollectionPriceController } from './package-collection-price.controller';
import { PackageTransfer } from '../package-transfer/package-transfer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PackageCollectionPrice, PackageTransfer])],
  controllers: [PackageCollectionPriceController],
  providers: [PackageCollectionPriceService],
  exports: [PackageCollectionPriceService],
})
export class PackageCollectionPriceModule {}
