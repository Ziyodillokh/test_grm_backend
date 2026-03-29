import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/order.entity';
import { Product } from '../product/product.entity';
import { FactoryReportItem } from './factory-report-item.entity';
import { FactoryReportController } from './factory-report-item.controller';
import { FactoryReportService } from './factory-report-item.service';
import { Factory } from '@modules/factory/factory.entity';
import { ReportsModule } from '@modules/report/report.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FactoryReportItem, Order, Product, Factory]),
    forwardRef(() => ReportsModule)
  ],
  controllers: [FactoryReportController],
  providers: [FactoryReportService],
  exports: [FactoryReportService],
})
export class FactoryReportItemModule {}
