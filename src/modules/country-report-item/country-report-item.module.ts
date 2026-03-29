import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/order.entity';
import { Product } from '../product/product.entity';
import { CountryReportItem } from './country-report-item.entity';
import { CountryReportController } from './country-report-item.controller';
import { CountryReportService } from './country-report-item.service';
import { Country } from '@modules/country/country.entity';
import { ReportsModule } from '@modules/report/report.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CountryReportItem, Order, Product, Country]),
    forwardRef(() => ReportsModule)
  ],
  controllers: [CountryReportController],
  providers: [CountryReportService],
  exports: [CountryReportService],
})
export class CountryReportItemModule {}
