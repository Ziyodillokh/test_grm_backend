import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { SellerReportService } from './seller-report.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GenerateReportDto, QueryReportDto } from './dto';
import { Request } from 'express';
import { User } from '../user/user.entity';
import { Pagination } from 'nestjs-typeorm-paginate';
import { SellerReport } from './seller-report.entity';

@ApiTags('Seller Reports')
@ApiBearerAuth()
@Controller('seller-reports')
export class SellerReportController {
  constructor(private readonly reportService: SellerReportService) {}

  @Get('paginate')
  async paginate(@Query() query: any): Promise<Pagination<SellerReport>> {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    return this.reportService.paginateReports({ page, limit });
  }

  @Get('current')
  async getCurrent(@Req() req: Request) {
    const user = req['user'] as User;
    return this.reportService.getCurrentReport(user);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'month', required: false, type: Number })
  async getFilteredReports(@Query() query: QueryReportDto) {
    return this.reportService.getReportsFiltered(query);
  }

  @Get('total')
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async totalReports(@Query() query: QueryReportDto) {
    return this.reportService.getTotalReports(query);
  }
  @Get('monthly-report/:reportId/items')
  @ApiOperation({ summary: 'Oylik hisobot elementlarini olish' })
  @ApiParam({ name: 'reportId', type: 'string', description: 'Report ID si' })
  @ApiQuery({ name: 'startDay', type: 'number', description: 'Boshlanish kuni (1-31)', example: 1, required: false })
  @ApiQuery({ name: 'endDay', type: 'number', description: 'Tugash kuni (1-31)', example: 31, required: false })
  @ApiResponse({ status: 200, description: 'Muvaffaqiyatli' })
  @ApiResponse({ status: 404, description: 'Report topilmadi' })
  async getItemsByMonthlyReport(
    @Param('reportId') reportId: string,
    @Query('startDay') startDay?: number,
    @Query('endDay') endDay?: number,
  ) {
    return await this.reportService.getItemsByMonthlyReport(reportId, startDay, endDay);
  }
  @Post('generate-monthly')
  generateMonthlyReport(@Body() body: GenerateReportDto) {
    const year = body.year ?? new Date().getFullYear();
    const month = body.month ?? new Date().getMonth() + 1;
    return this.reportService.generateMonthlyReport(year, month);
  }
  @Patch('aggregate')
  async aggregateSellerReports() {
    return this.reportService.aggregateSellerReportValues();
  }
}
