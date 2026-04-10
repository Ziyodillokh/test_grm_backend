import { Module } from '@nestjs/common';

import { InventoryReportService } from './inventory-report.service';
import { InventoryReportController } from './inventory-report.controller';

@Module({
  controllers: [InventoryReportController],
  providers: [InventoryReportService],
})
export class InventoryReportModule {}
