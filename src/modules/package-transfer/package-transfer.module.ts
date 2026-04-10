import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackageTransfer } from '@modules/package-transfer/package-transfer.entity';
import { PackageTransferController } from '@modules/package-transfer/package-transfer.controller';
import { PackageTransferService } from '@modules/package-transfer/package-transfer.service';
import { Transfer } from '@modules/transfer/transfer.entity';
import { Product } from '@modules/product/product.entity';
import { Filial } from '@modules/filial/filial.entity';
import { PackageCollectionPrice } from '@modules/package-collection-price/package-collection-price.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PackageTransfer,
      Transfer,
      Product,
      Filial,
      PackageCollectionPrice,
    ]),
  ],
  controllers: [PackageTransferController],
  providers: [PackageTransferService],
  exports: [PackageTransferService]
})
export class PackageTransferModule {
}
