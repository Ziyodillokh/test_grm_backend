import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '@modules/product/product.entity';
import { ProductReportService } from '@modules/product-report/product-report.service';
import { ProductReportController } from '@modules/product-report/product-report.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  providers: [ProductReportService],
  controllers: [ProductReportController],
})
export class ProductReportModule {
}