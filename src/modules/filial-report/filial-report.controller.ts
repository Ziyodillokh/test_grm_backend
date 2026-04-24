import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FilialReportService } from './filial-report.service';
import { FilialReportStatusEnum } from '../../infra/shared/enum';
import { FilialReport } from './filial-report.entity';
import { CreateFilialReportDto } from './dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@ApiTags('Filial Report')
@Controller('filial-report')
export class FilialReportController {
  constructor(private readonly filialReportService: FilialReportService) {
  }

  @Get('/all-filials')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getAllFilialsWithLatestReport(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 100,
    @Query('search') search?: string,
  ) {
    return this.filialReportService.findAllFilialsWithLatestReport(+page, +limit, search);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'filialId', required: false, type: String })
  async getFilialReports(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('filialId') filialId: string | null,
  ) {
    return this.filialReportService.findAll(page, limit, filialId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.filialReportService.getOne(id);
  }

  @Get('status')
  @ApiQuery({ name: 'status', required: true, enum: FilialReportStatusEnum })
  async getByStatus(@Query('status') status: FilialReportStatusEnum) {
    return this.filialReportService.findByStatus(status);
  }

  @Post()
  @ApiBody({ type: CreateFilialReportDto })
  async create(@Body() report: CreateFilialReportDto) {
    return this.filialReportService.create(report);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: Partial<FilialReport>) {
    return this.filialReportService.update(id, updateData);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.filialReportService.delete(id);
  }

  @Post(':id/close')
  async close(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.filialReportService.closeByFmanager(id, userId);
  }

  @Post(':id/accept')
  async accept(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.filialReportService.acceptByMmanager(id, userId);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.filialReportService.rejectByMmanager(id, userId);
  }
}