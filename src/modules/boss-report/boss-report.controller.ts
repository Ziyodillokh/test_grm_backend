import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IPaginationOptions, Pagination } from 'nestjs-typeorm-paginate';

import { BossReportService } from './boss-report.service';
import { ReportQueryDto } from './dto';
import { User } from '../user/user.entity';
import { BossReport } from './boss-report.entity';
import { CancelReportDto } from './dto/update-report.dto';

@ApiTags('Boss Reports')
@ApiBearerAuth()
@Controller('boss-reports')
export class BossReportController {
  constructor(private readonly bossReportService: BossReportService) {}

  @Get()
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async filterReports(@Query() query: ReportQueryDto, @Req() req: Request): Promise<Pagination<BossReport>> {
    const options: IPaginationOptions = {
      page: query.page || 1,
      limit: query.limit || 10,
    };
    const user = req['user'] as User;
    return this.bossReportService.getReportsFiltered(query, options, user);
  }

  @Get('current')
  async getCurrent(@Req() req: Request) {
    const user = req['user'] as User;
    return this.bossReportService.getCurrentReport(user.filial);
  }

  @Get('total')
  @ApiQuery({ name: 'year', required: false })
  async total(@Query() query: ReportQueryDto) {
    return this.bossReportService.getTotalReports(query);
  }

  @Get('netProfitSum')
  @ApiQuery({ name: 'year', required: true, type: 'number', description: 'Year (e.g., 2024)' })
  @ApiQuery({ name: 'month', required: true, type: 'number', description: 'Month (1-12)' })
  async netProfit(@Query('year') year: string, @Query('month') month: string) {
    // String'dan number'ga o'girish
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    // Validatsiya
    if (isNaN(yearNum) || isNaN(monthNum)) {
      throw new BadRequestException('Year and month must be valid numbers');
    }

    return this.bossReportService.bossSumma(yearNum, monthNum);
  }

  @Get('expenses')
  @ApiQuery({ name: 'year', required: true, type: 'number', description: 'Year (e.g., 2024)' })
  @ApiQuery({ name: 'month', required: true, type: 'number', description: 'Month (1-12)' })
  @ApiQuery({ name: 'page', required: false, type: 'number', description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: 'number', description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'filter', required: false, enum: ['boss', 'biznes'], description: 'Filter by expense type' })
  async expenses(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('filter') filter?: 'boss' | 'biznes',
  ) {
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(yearNum) || isNaN(monthNum)) {
      throw new BadRequestException('Year and month must be valid numbers');
    }

    return this.bossReportService.expenses(yearNum, monthNum, pageNum, limitNum, filter);
  }

  @Get('aggregate')
  async aggregateCurrentMonthReport() {
    return this.bossReportService.aggregateAndSaveAnnualReports();
  }

  @Get('aggregate-all')
  async aggregateAllCurrentYearReports() {
    await this.bossReportService.createReportsForYear();
    return { message: 'Yil uchun barcha oylar bo‘yicha boss hisobotlar yaratildi' };
  }

  @Post('generate-and-link')
  async generateAndLinkBossReportsByYear() {
    return this.bossReportService.generateAndLinkBossReportByYear();
  }
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.bossReportService.findOne(id);
  }

  @Put(':id/cancel')
  async cancel(@Param('id') id: string, @Body() dto: CancelReportDto) {
    return this.bossReportService.cancelValueReport(dto, id);
  }
  @Post('generate/year')
  async generateBossReportsByYear() {
    return this.bossReportService.generateBossReportByYear();
  }

  @Post('test-create')
  async testCreate() {
    return this.bossReportService.testcreate();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReport(@Param('id') id: string) {
    return this.bossReportService.deleteReport(id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore deleted book and update product count' })
  @ApiParam({ name: 'id', required: true })
  async restore(@Param('id') id: string) {
    return this.bossReportService.restore(id);
  }
}
