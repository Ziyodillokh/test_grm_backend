// debt.controller.ts
import { Controller, Post, Body, Request, Get, Param, Patch, Delete, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { DebtService } from './debt.service';
import { DebtTransactionDto } from './dto/amount-debt-dto';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { DebtReportQueryDto } from './dto/debt-report-query.dto';
import { DebtDetailQueryDto } from './dto/debt-detail-query.dto';
import { DebtExcelQueryDto } from './dto/debt-excel-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@infra/shared/enum';

@ApiTags('Debt')
@Controller('debt')
export class DebtController {
  constructor(private readonly debtService: DebtService) {}

  @Get()
  @ApiOperation({ summary: 'Get all debts with pagination' })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.debtService.findAll({
      page,
      limit,
    });
  }

  @Get('report')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Kent report with year/month filtering' })
  async getReport(@Query() dto: DebtReportQueryDto) {
    return this.debtService.getDebtReport(dto);
  }

  @Get('report/excel')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Export kent report to Excel' })
  async exportExcel(@Query() dto: DebtExcelQueryDto, @Res() res: Response) {
    const buffer = await this.debtService.generateDebtExcel(dto);

    const fileName = `Kent_hisobot_${dto.year || new Date().getFullYear()}_${dto.month || new Date().getMonth() + 1}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.byteLength);
    res.end(buffer);
  }

  @Get('next-number')
  @ApiOperation({ summary: 'Get next debt number' })
  async getNextNumber() {
    return { number: await this.debtService.getNextNumber() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get debt by ID' })
  async findOne(@Param('id') id: string) {
    return this.debtService.findOne(id);
  }

  @Get(':id/report')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Kent detail cashflows with year/month filtering' })
  async getDetailReport(@Param('id') id: string, @Query() dto: DebtDetailQueryDto) {
    return this.debtService.getDebtDetailReport(id, dto);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Get debt balance' })
  async getBalance(@Param('id') id: string) {
    return this.debtService.getDebtBalance(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new debt' })
  async create(@Body() createDebtDto: CreateDebtDto) {
    return this.debtService.create(createDebtDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a debt' })
  async update(@Param('id') id: string, @Body() updateDebtDto: UpdateDebtDto) {
    return this.debtService.update(id, updateDebtDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a debt' })
  async remove(@Param('id') id: string) {
    return this.debtService.remove(id);
  }

  // Faqat bitta transaction API
  @Post('transaction')
  @ApiOperation({ summary: 'Process debt transaction (add or return debt based on transactionType)' })
  async processTransaction(@Body() dto: DebtTransactionDto, @Request() req) {
    return this.debtService.handleTransaction(dto, req.user.id);
  }
}
