import { Module } from '@nestjs/common';
import { CountryReportItemModule as OriginalModule } from '../../country-report-item/country-report-item.module';

@Module({
  imports: [OriginalModule],
  exports: [OriginalModule],
})
export class ReportCountryReportItemModule {}
