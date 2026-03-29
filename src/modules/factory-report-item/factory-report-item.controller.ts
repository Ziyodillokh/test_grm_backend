import { Controller, Get, Query } from '@nestjs/common';
import { FactoryReportService } from './factory-report-item.service';
import { FilterFactoryReportDto, FilterMonthlyFactoryReportDto } from './dto/filter-factory-report.dto';
import { ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Factory-report')
@Controller('factory-report')
export class FactoryReportController {
  constructor(private readonly service: FactoryReportService) {}

  @Get()
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'factoryId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async findAllReports(@Query() dto: FilterFactoryReportDto) {
    return this.service.findAllReports(dto);
  }

  @Get('monthly')
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2025 })
  @ApiQuery({ name: 'month', required: false, type: Number, example: 6 })
  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'factoryId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'country', required: false, type: String })
  async findMonthlyFactoryReports(@Query() dto: FilterMonthlyFactoryReportDto) {
    return this.service.getFactoriesReport(Number(dto?.page || 1), Number(dto.limit || 10), dto.filialId, dto.country, dto.month, dto.year);
  }

  @Get('order/monthly')
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2025 })
  @ApiQuery({ name: 'month', required: false, type: Number, example: 6 })
  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'factoryId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'country', required: false, type: String })
  async findMonthlyFactoriesOrderReports(@Query() dto: FilterMonthlyFactoryReportDto) {
    return this.service.getFactoriesOrderReport(Number(dto?.page || 1), Number(dto.limit || 10), dto.filialId, dto.country, dto.month, dto.year);
  }

  @Get('seed-history')
  async seedHistorical() {
    return this.service.seedHistorical();
  }
}
