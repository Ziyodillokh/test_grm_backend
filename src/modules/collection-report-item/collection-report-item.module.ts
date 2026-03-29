import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionReportItem } from './collection-report-item.entity';
import { CollectionReportController } from './collection-report-item.controller';
import { CollectionReportService } from './collection-report-item.service';
import { Order } from '../order/order.entity';
import { Product } from '../product/product.entity';
import { Collection } from '@modules/collection/collection.entity';
import { ReportsModule } from '@modules/report/report.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollectionReportItem, Order, Product, Collection]),
    forwardRef(() => ReportsModule)
  ],
  controllers: [CollectionReportController],
  providers: [CollectionReportService],
  exports: [CollectionReportService],
})
export class CollectionReportItemModule {}
