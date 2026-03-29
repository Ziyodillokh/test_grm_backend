import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReInventory } from '@modules/re-inventory/re-inventory.entity';
import { ReInventoryService } from '@modules/re-inventory/re-inventory.service';
import { ReInventoryController } from '@modules/re-inventory/re-inventory.controller';
import { FilialReport } from '@modules/filial-report/filial-report.entity';
import { QrBase } from '@modules/qr-base/qr-base.entity';
import { Product } from '@modules/product/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReInventory, FilialReport, QrBase, Product]),
  ],
  controllers: [ReInventoryController],
  providers: [ReInventoryService],
  exports: [ReInventoryService],
})

export class ReInventoryModule {
}