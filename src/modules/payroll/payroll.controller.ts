import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto, PaginationPayrollDto, UpdatePayrollDto } from './dto';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PayrollStatus } from './payroll.entity';

@ApiTags('Payroll')
@Controller('payrolls')
export class PayrollController {
  constructor(private readonly service: PayrollService) {}

  @Post()
  @ApiOperation({ summary: 'Create payroll record' })
  async create(@Body() dto: CreatePayrollDto) {
    return await this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all payrolls with filters' })
  async findAll(@Query() query: PaginationPayrollDto) {
    return await this.service.findAll(query);
  }

  @Get('get-for-managers')
  @ApiOperation({ summary: 'Oylik payroll olish (manual validation)' })
  @ApiQuery({ name: 'month', description: 'Oy raqami (1-12)' })
  @ApiQuery({ name: 'year', required: false, description: 'Yil' })
  async getMonthlyPayrollManual(@Query('month') monthStr: string, @Query('year') yearStr?: string) {
    const month = parseInt(monthStr);

    let year = new Date().getFullYear();
    if (yearStr) {
      year = parseInt(yearStr);
    }

    const payroll = await this.service.getMonthlyPayroll(month, year);

    return {
      success: true,
      data: payroll,
      period: { month, year },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payroll by ID' })
  async findOne(@Param('id') id: string) {
    return await this.service.findOne(id);
  }

  @Patch(':id/close-payroll')
  async closeDealerReport(@Param('id') id: string, @Req() req) {
    return this.service.closePayroll(id, req.user);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject payroll by ID' })
  async rejectPayroll(@Param('id') id: string) {
    return await this.service.rejectPayroll(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update payroll by ID' })
  async update(@Param('id') id: string, @Body() dto: UpdatePayrollDto) {
    return await this.service.update(id, dto);
  }

  @Patch('change-status/:id/:status')
  @ApiOperation({ summary: 'Change payroll status by ID' })
  @ApiParam({ name: 'id', type: String })
  async updateStatus(@Param('id') id: string) {
    return await this.service.changeStatus(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete payroll by ID' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
