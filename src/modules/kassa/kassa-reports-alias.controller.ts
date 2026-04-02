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
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { KassaService } from './kassa.service';

/**
 * Alias controller — frontend eski `/kassa-reports` endpointlarini
 * yangi Kassa servisga yo'naltiradi. KassaReport entity o'chirilgan,
 * lekin frontend hali eski URL lardan foydalanadi.
 */
@ApiTags('Kassa Reports (Alias)')
@Controller('kassa-reports')
export class KassaReportsAliasController {
  constructor(private readonly kassaService: KassaService) {}

  @Get()
  @ApiOperation({ summary: 'Alias: get kassas filtered (was kassa-reports)' })
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
  @ApiOperation({ summary: 'Alias: get current month kassa (was kassa-reports/current)' })
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
  @ApiOperation({ summary: 'Alias: get kassa totals (was kassa-reports/total)' })
  @HttpCode(HttpStatus.OK)
  async getTotal(@Query('filialId') filialId: string, @Req() req) {
    const user = req['user'];
    const fId = filialId || user?.filial?.id;
    if (!fId) return {};
    return this.kassaService.getReportTotals(fId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Alias: get single kassa (was kassa-reports/:id)' })
  @HttpCode(HttpStatus.OK)
  async getOne(@Param('id') id: string) {
    return this.kassaService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Alias: confirm/close kassa (was kassa-reports/:id PATCH)' })
  @HttpCode(HttpStatus.OK)
  async close(@Param('id') id: string, @Req() req) {
    return this.kassaService.closeKassa(id, req.user);
  }
}
