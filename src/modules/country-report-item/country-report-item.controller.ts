import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { CountryReportService } from './country-report-item.service';
import { FilterCountryReportDto, FilterMonthlyCountryReportDto } from './dto/filter-country-report.dto';

@ApiTags('Country-report')
@Controller('country-report')
export class CountryReportController {
  constructor(private readonly service: CountryReportService) {}

  @Get()
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'countryId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async findAllReports(@Query() dto: FilterCountryReportDto) {
    return this.service.findAllReports(dto);
  }

  @Get('monthly')
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2025 })
  @ApiQuery({ name: 'month', required: false, type: Number, example: 6 })
  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async findMonthlyCountryReports(@Query() dto: FilterMonthlyCountryReportDto) {
    return this.service.getCountriesReport(Number(dto?.page || 1), Number(dto?.limit || 10), dto.filialId, dto.month, dto.year);
  }

  @Get('order/monthly')
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2025 })
  @ApiQuery({ name: 'month', required: false, type: Number, example: 6 })
  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async findMonthlyCountriesOrderReports(@Query() dto: FilterMonthlyCountryReportDto) {
    return this.service.getCountriesOrderReport(Number(dto?.page || 1), Number(dto?.limit || 10), dto.filialId, dto.month, dto.year);
  }

  @Get('seed-history')
  async seedHistorical() {
    return this.service.seedHistorical();
  }
}
