import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerReport } from './seller-report.entity';
import { SellerReportController } from './seller-report.controller';
import { SellerReportService } from './seller-report.service';
import { User } from '../user/user.entity';
import { SellerReportItem } from '../seller-report-item/seller-report-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SellerReport, User, SellerReportItem])],
  controllers: [SellerReportController],
  providers: [SellerReportService],
  exports: [SellerReportService],
})
export class SellerReportModule {}
