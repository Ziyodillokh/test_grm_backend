import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  HomePageCurrLeft,
  HomePageCurrLeftKents,
  HomePageCurrMonth,
  HomePageCurrMonthExpense,
  HomePageCurrMonthManagers,
  HomePageCurrMonthProdaja,
  reportCorrect,
  ReportMonthlyV2,
  ReportQueryDto,
} from './dto';
import { Request } from 'express';
import { User } from '../user/user.entity';
import { IPaginationOptions, Pagination } from 'nestjs-typeorm-paginate';
import { ReportService } from './report.service';
import { Report } from './report.entity';
import { CancelReportDto } from './dto/update-report.dto';
import { FilialTypeEnum } from 'src/infra/shared/enum';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  @ApiQuery({ name: 'filialType', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async filterReports(@Query() query: ReportQueryDto, @Req() req: Request): Promise<Pagination<Report>> {
    const options: IPaginationOptions = {
      page: query.page || 1,
      limit: query.limit || 10,
    };
    const user = req['user'] as User;

    return this.reportService.getReportsFiltered(
      {
        year: query?.year ? +query.year : new Date().getFullYear(),
        filialType: query?.filialType?.toUpperCase() as FilialTypeEnum,
      },
      options,
      user,
    );
  }

  @Get('current')
  async getCurrent(@Req() req: Request) {
    const user = req['user'] as User;
    return this.reportService.getCurrentReport(user.filial);
  }

  @Get('total')
  @ApiQuery({ name: 'year', required: false })
  async totalReports(@Query() query: ReportQueryDto) {
    return this.reportService.getTotalReports({
      year: query?.year ? +query.year : undefined,
    });
  }

  @Get('aggregate')
  async aggregateReport(@Query('year', ParseIntPipe) year: number, @Query('month', ParseIntPipe) month: number) {
    if (!year || !month || month < 1 || month > 12) {
      throw new BadRequestException('Yil yoki oy noto‘g‘ri berilgan!');
    }

    const report = await this.reportService.aggregateAndSaveReport(year, month);
    return report;
  }

  @Get('aggregate-all')
  async aggregateAllCurrentYearReports() {
    const year = new Date().getFullYear();

    await this.reportService.createReportsForYear();
    return { message: `Yil ${year} uchun barcha oylar bo'yicha hisobotlar yaratildi` };
  }

  @Get('dealer/list/report')
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getDealerReport(
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reportService.getDealerReport({
      year: year ? +year : undefined,
      month: month ? +month : undefined,
      search: search || undefined,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('dealer/:dealerId')
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getDealerKassaDetail(
    @Param('dealerId') dealerId: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reportService.getDealerKassaDetail(dealerId, { year: +year, month: +month, page: +page, limit: +limit });
  }

  @Get('dealer/package/:packageId/collections')
  async getPackageCollections(@Param('packageId') packageId: string) {
    return this.reportService.getPackageCollections(packageId);
  }

  @Get('dealer-closed-by-d')
  async getDealerClosedByDReports(@Query('year') year: number, @Query('month') month: number) {
    return this.reportService.getDealerClosedByDReports(year, month);
  }

  @Get('move-to-next-month/:id')
  async moveToNextMonth(@Param('id') id: string) {
    const report = await this.reportService.findOne(id);
    if (!report) {
      return { message: 'Report not found' };
    }

    await this.reportService.moveToNextMonthDealerReport(report);
    return { message: 'Report moved to next month successfully' };
  }

  @Get('home-page/current-month')
  async currentBossReport(@Query() query: HomePageCurrMonth) {
    return await this.reportService.bossCurrentMonth(query);
  }

  @Get('home-page/current-month/prodaja')
  async currentBossReportProdaja(@Query() query: HomePageCurrMonthProdaja) {
    return await this.reportService.prodaja(query);
  }

  @Get('home-page/current-month/sell/debt')
  async currentBossReportSellDebt(@Query() query: HomePageCurrMonthProdaja) {
    return await this.reportService.prodajaVDolg(query);
  }

  @Get('home-page/current-left')
  async currentBossReportLeft(@Query() query: HomePageCurrLeft) {
    return await this.reportService.bossCurrLeft({ year: query.year, month: query.month, filialId: query.filial_id });
  }

  @Get('home-page/current-lef/kents')
  async currentBossReportLeftKents(@Query() query: HomePageCurrLeftKents) {
    return await this.reportService.kents(query);
  }

  @Get('home-page/current-month/expense')
  async currentBossReportExpense(@Query() query: HomePageCurrMonthExpense) {
    return await this.reportService.expense_cashflow(query);
  }

  @Get('home-page/current-month/managers')
  async currentBossReportManagers(@Query() query: HomePageCurrMonthManagers) {
    return await this.reportService.expense_managers(query);
  }

  @Get('/monthly/v2')
  async currentReportMonthlyV2(@Query() query: ReportMonthlyV2) {
    return this.reportService.bossMonthReport(query);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.reportService.findOne(id);
  }

  @Patch('restore/by/:month/:year')
  async restoringReport(@Param('month') month: string, @Param('year') year: string, @Query() query: reportCorrect) {
    return await this.reportService.calcReport(+month, +year, query.type);
  }

  @Patch('restore/:id')
  async restore(@Param('id') id: string): Promise<void> {
    await this.reportService.restoreOne(id);
  }

  @Patch(':id/close-dealer')
  async closeDealerReport(@Param('id') id: string, @Req() req) {
    return this.reportService.closeDealerReport(id, req.user);
  }

  @Patch(':id/close')
  async closeReport(@Param('id') id: string, @Req() req: Request) {
    const user = req['user'] as User;
    return await this.reportService.closeReport(id, user);
  }

  @Put(':id/cancel')
  async cancelUpdate(@Param('id') reportId: string, @Body() dto: CancelReportDto) {
    return this.reportService.cancelValueReport(dto, reportId);
  }

  @Post('generate/year')
  async generateReportsByYear() {
    return this.reportService.generateReportsByYear();
  }

  @Patch('generate/report/by/:year')
  @ApiProperty({ type: Number, example: 2026 })
  async generateReportsByYearNew(
    @Param('year') year: string,
  ) {
    return this.reportService.generateReportsByYearNew(Number(year));
  }

  @Post('generate-and-link')
  async generateAndLinkReportsByYear() {
    return this.reportService.generateAndLinkReportsByYear();
  }

  @Delete(':id')
  async deleteReport(@Param('id') id: string): Promise<void> {
    await this.reportService.deleteOne(id);
  }
}
