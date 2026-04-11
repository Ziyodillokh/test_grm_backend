import { Controller, Post, Body, Get, Param, Patch, Delete, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { LogisticsService } from './logistics.service';
import { CreateLogisticsDto } from './dto/create-logistics.dto';
import { UpdateLogisticsDto } from './dto/update-logistics.dto';
import { LogisticsReportQueryDto } from './dto/logistics-report-query.dto';
import { LogisticsDetailQueryDto } from './dto/logistics-detail-query.dto';
import { LogisticsExcelQueryDto } from './dto/logistics-excel-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@infra/shared/enum';

@ApiTags('Logistics')
@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Get()
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Get all logistics with pagination' })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.logisticsService.findAll({ page, limit });
  }

  @Get('report')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Logistics report with year/month filtering' })
  async getReport(@Query() dto: LogisticsReportQueryDto) {
    return this.logisticsService.getLogisticsReport(dto);
  }

  @Get('report/excel')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Export logistics report to Excel' })
  async exportExcel(@Query() dto: LogisticsExcelQueryDto, @Res() res: Response) {
    const buffer = await this.logisticsService.generateLogisticsExcel(dto);

    const fileName = `Logistika_hisobot_${dto.year || new Date().getFullYear()}_${dto.month || new Date().getMonth() + 1}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.byteLength);
    res.end(buffer);
  }

  @Get(':id')
  @Roles(UserRoleEnum.M_MANAGER)
  @ApiOperation({ summary: 'Get logistics by ID' })
  async findOne(@Param('id') id: string) {
    return this.logisticsService.findOne(id);
  }

  @Get(':id/report')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Logistics detail cashflows with year/month filtering' })
  async getDetailReport(@Param('id') id: string, @Query() dto: LogisticsDetailQueryDto) {
    return this.logisticsService.getLogisticsDetailReport(id, dto);
  }

  @Post()
  @Roles(UserRoleEnum.M_MANAGER)
  @ApiOperation({ summary: 'Create a new logistics company' })
  async create(@Body() dto: CreateLogisticsDto) {
    return this.logisticsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.M_MANAGER)
  @ApiOperation({ summary: 'Update a logistics company' })
  async update(@Param('id') id: string, @Body() dto: UpdateLogisticsDto) {
    return this.logisticsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRoleEnum.M_MANAGER)
  @ApiOperation({ summary: 'Delete a logistics company' })
  async remove(@Param('id') id: string) {
    return this.logisticsService.remove(id);
  }
}
