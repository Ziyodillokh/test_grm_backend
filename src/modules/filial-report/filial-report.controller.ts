import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FilialReportService } from './filial-report.service';
import { FilialReportStatusEnum } from '../../infra/shared/enum';
import { FilialReport } from './filial-report.entity';
import { CreateFilialReportDto } from './dto';

@ApiTags('Filial Report')
@Controller('filial-report')
export class FilialReportController {
  constructor(private readonly filialReportService: FilialReportService) {
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
}