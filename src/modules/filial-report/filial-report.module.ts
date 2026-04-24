import { forwardRef, Module } from '@nestjs/common';
import { FilialReportService } from './filial-report.service';
import { FilialReportController } from './filial-report.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilialReport } from './filial-report.entity';
import { FilialModule } from '../filial/filial.module';
import { Transfer } from '@modules/transfer/transfer.entity';
import { Product } from '@modules/product/product.entity';
import { Order } from '@modules/order/order.entity';
import { OrderBasket } from '@modules/order-basket/order-basket.entity';
import { ReInventoryModule } from '@modules/re-inventory/re-inventory.module';
import { PackageTransfer } from '@modules/package-transfer/package-transfer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    FilialReport,
    Transfer,
    Product,
    Order,
    OrderBasket,
    PackageTransfer,
  ]), forwardRef(() => FilialModule), forwardRef(() => ReInventoryModule)],
  providers: [FilialReportService],
  controllers: [FilialReportController],
  exports: [FilialReportService],
})
export class FilialReportModule {
}
