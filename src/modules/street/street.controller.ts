import { Controller, Post, Body, Request, Get, Param, Patch, Delete, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { StreetService } from './street.service';
import { StreetTransactionDto } from './dto/amount-street-dto';
import { CreateStreetDto } from './dto/create-street.dto';
import { UpdateStreetDto } from './dto/update-street.dto';
import { StreetReportQueryDto } from './dto/street-report-query.dto';
import { StreetDetailQueryDto } from './dto/street-detail-query.dto';
import { StreetExcelQueryDto } from './dto/street-excel-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@infra/shared/enum';

@ApiTags('Street')
@Controller('street')
export class StreetController {
  constructor(private readonly streetService: StreetService) {}

  @Get()
  @ApiOperation({ summary: 'Get all streets with pagination' })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.streetService.findAll({
      page,
      limit,
    });
  }

  @Get('report')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: "Ko'cha report with year/month filtering" })
  async getReport(@Query() dto: StreetReportQueryDto) {
    return this.streetService.getStreetReport(dto);
  }

  @Get('report/excel')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: "Export Ko'cha report to Excel" })
  async exportExcel(@Query() dto: StreetExcelQueryDto, @Res() res: Response) {
    const buffer = await this.streetService.generateStreetExcel(dto);

    const fileName = `Kocha_hisobot_${dto.year || new Date().getFullYear()}_${dto.month || new Date().getMonth() + 1}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.byteLength);
    res.end(buffer);
  }

  @Get('next-number')
  @ApiOperation({ summary: 'Get next street number' })
  async getNextNumber() {
    return { number: await this.streetService.getNextNumber() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get street by ID' })
  async findOne(@Param('id') id: string) {
    return this.streetService.findOne(id);
  }

  @Get(':id/report')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: "Ko'cha detail cashflows with year/month filtering" })
  async getDetailReport(@Param('id') id: string, @Query() dto: StreetDetailQueryDto) {
    return this.streetService.getStreetDetailReport(id, dto);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Get street balance' })
  async getBalance(@Param('id') id: string) {
    return this.streetService.getStreetBalance(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new street' })
  async create(@Body() createStreetDto: CreateStreetDto) {
    return this.streetService.create(createStreetDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a street' })
  async update(@Param('id') id: string, @Body() updateStreetDto: UpdateStreetDto) {
    return this.streetService.update(id, updateStreetDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a street' })
  async remove(@Param('id') id: string) {
    return this.streetService.remove(id);
  }

  @Post('transaction')
  @ApiOperation({ summary: 'Process street transaction (add or return based on transactionType)' })
  async processTransaction(@Body() dto: StreetTransactionDto, @Request() req) {
    return this.streetService.handleTransaction(dto, req.user.id);
  }
}
