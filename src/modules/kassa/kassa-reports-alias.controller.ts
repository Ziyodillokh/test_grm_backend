import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { KassaService } from './kassa.service';
import { ReportService } from '../report/report.service';

/**
 * Ежемесячный отчет:
 * - GET /kassa-reports/total → Report totallari (yuqori qism)
 * - GET /kassa-reports → Kassa ro'yxati (pastdagi jadval)
 */
@ApiTags('Kassa Reports (Alias)')
@Controller('kassa-reports')
export class KassaReportsAliasController {
  constructor(
    private readonly kassaService: KassaService,
    private readonly reportService: ReportService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Kassa list by filial (monthly report table)' })
  @HttpCode(HttpStatus.OK)
  async getAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('year') year: string,
    @Query('filialId') filialId: string,
    @Req() req,
  ) {
    const user = req['user'];
    if (!user?.filial?.id) return { items: [], meta: { totalItems: 0 } };
    const where = {
      ...(req.where || {}),
      ...(year && { year: +year }),
      ...(filialId && { filial: { id: filialId } }),
    };
    return this.kassaService.getReport({ page, limit }, user, where);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current month kassa' })
  @HttpCode(HttpStatus.OK)
  async getCurrent(@Req() req) {
    const user = req['user'];
    if (!user?.filial?.id) return null;
    const now = new Date();
    return this.kassaService.getOrCreateKassaForFilial(
      user.filial.id,
      now.getFullYear(),
      now.getMonth() + 1,
    );
  }

  @Get('total')
  @ApiOperation({ summary: 'Report totals for filial (top cards)' })
  @HttpCode(HttpStatus.OK)
  async getTotal(@Query('filialId') filialId: string, @Req() req) {
    const user = req['user'];
    const fId = filialId || user?.filial?.id;
    if (!fId) return {};
    return this.reportService.getReportTotalsByFilial(fId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single kassa by id' })
  @HttpCode(HttpStatus.OK)
  async getOne(@Param('id') id: string) {
    return this.kassaService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Close/confirm kassa' })
  @HttpCode(HttpStatus.OK)
  async close(@Param('id') id: string, @Req() req) {
    return this.kassaService.closeKassa(id, req.user);
  }
}
