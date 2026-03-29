import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PayrollItemsService } from './payroll-items.service';
import { CreatePayrollItemDto, FilterPayrollItemDto, UpdatePayrollItemDto } from './dto';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IPaginationOptions } from 'nestjs-typeorm-paginate';

@ApiTags('Payroll-Items')
@Controller('payroll-items')
export class PayrollItemsController {
  constructor(private readonly service: PayrollItemsService) {}

  @Post()
  @ApiOperation({ summary: 'Crete payroll item' })
  create(@Body() dto: CreatePayrollItemDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all payroll items with filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'payrollId', required: false, type: String }) // optional: filter
  @ApiQuery({ name: 'filialId', required: false, type: String }) // optional: filter
  findAll(@Query() query: FilterPayrollItemDto & IPaginationOptions) {
    return this.service.findAll(query);
  }
  @Get(':id')
  @ApiOperation({ summary: 'List one payroll item' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update payroll item' })
  update(@Param('id') id: string, @Body() dto: UpdatePayrollItemDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'delete payroll item' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
