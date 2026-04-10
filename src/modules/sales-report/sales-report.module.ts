import { Module } from '@nestjs/common';

import { SalesReportService } from './sales-report.service';
import { SalesReportController } from './sales-report.controller';

@Module({
  controllers: [SalesReportController],
  providers: [SalesReportService],
})
export class SalesReportModule {}
