import { Controller, Post, Body, Get, Param, Patch, Delete, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { CustomsService } from './customs.service';
import { CreateCustomsDto } from './dto/create-customs.dto';
import { UpdateCustomsDto } from './dto/update-customs.dto';
import { CustomsReportQueryDto } from './dto/customs-report-query.dto';
import { CustomsDetailQueryDto } from './dto/customs-detail-query.dto';
import { CustomsExcelQueryDto } from './dto/customs-excel-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@infra/shared/enum';

@ApiTags('Customs')
@Controller('bojxona')
export class CustomsController {
  constructor(private readonly customsService: CustomsService) {}

  @Get()
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Get all customs with pagination' })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.customsService.findAll({ page, limit });
  }

  @Get('report')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Customs report with year/month filtering' })
  async getReport(@Query() dto: CustomsReportQueryDto) {
    return this.customsService.getCustomsReport(dto);
  }

  @Get('report/excel')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Export customs report to Excel' })
  async exportExcel(@Query() dto: CustomsExcelQueryDto, @Res() res: Response) {
    const buffer = await this.customsService.generateCustomsExcel(dto);

    const fileName = `Bojxona_hisobot_${dto.year || new Date().getFullYear()}_${dto.month || new Date().getMonth() + 1}.xlsx`;

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
  @ApiOperation({ summary: 'Get customs by ID' })
  async findOne(@Param('id') id: string) {
    return this.customsService.findOne(id);
  }

  @Get(':id/report')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Customs detail cashflows with year/month filtering' })
  async getDetailReport(@Param('id') id: string, @Query() dto: CustomsDetailQueryDto) {
    return this.customsService.getCustomsDetailReport(id, dto);
  }

  @Post()
  @Roles(UserRoleEnum.M_MANAGER)
  @ApiOperation({ summary: 'Create a new customs company' })
  async create(@Body() dto: CreateCustomsDto) {
    return this.customsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.M_MANAGER)
  @ApiOperation({ summary: 'Update a customs company' })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomsDto) {
    return this.customsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRoleEnum.M_MANAGER)
  @ApiOperation({ summary: 'Delete a customs company' })
  async remove(@Param('id') id: string) {
    return this.customsService.remove(id);
  }
}
