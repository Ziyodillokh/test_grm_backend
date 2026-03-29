// debt.controller.ts
import { Controller, Post, Body, Request, Get, Param, Patch, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DebtService } from './debt.service';
import { DebtTransactionDto } from './dto/amount-debt-dto';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';

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

  @Get(':id/balance')
  @ApiOperation({ summary: 'Get debt balance' })
  async getBalance(@Param('id') id: string) {
    return this.debtService.getDebtBalance(id);
  }

  // Faqat bitta transaction API
  @Post('transaction')
  @ApiOperation({ summary: 'Process debt transaction (add or return debt based on transactionType)' })
  async processTransaction(@Body() dto: DebtTransactionDto, @Request() req) {
    return this.debtService.handleTransaction(dto, req.user.id);
  }
}
