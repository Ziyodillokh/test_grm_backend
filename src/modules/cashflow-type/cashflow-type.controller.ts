import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CashflowTypeService } from './cashflow-type.service';
import { CreateCashflowTypeDto, UpdateCashflowTypeDto } from './dto';
import { CashflowType } from './cashflow-type.entity';
import createCashflowTypeDto from './dto/create-cashflow-type.dto';
import CashflowTypeEnum from '../../infra/shared/enum/cashflow/cashflow-type.enum';

@ApiTags('Cashflow Types')
@Controller('cashflow-types')
export class CashflowTypeController {
  constructor(private readonly cashflowTypeService: CashflowTypeService) {}

  @ApiOperation({ summary: 'Get all cashflow types (paginated)' })
  @ApiQuery({ name: 'type', required: false, type: String, enum: CashflowTypeEnum })
  @ApiResponse({ status: 200, description: 'List of cashflow types', type: [createCashflowTypeDto] })
  @Get()
  async getAll(@Query('type') query: CashflowTypeEnum, @Req() req) {
    return this.cashflowTypeService.getAll(query, req.user);
  }

  @ApiResponse({ status: 200, description: 'List of cashflow types', type: createCashflowTypeDto })
  @ApiQuery({ name: 'type', type: String, enum: CashflowTypeEnum })
  @Get('/for/cashier')
  async getAllForCashier(@Query('type') type: CashflowTypeEnum): Promise<CashflowType[]> {
    return this.cashflowTypeService.getForSeller(type);
  }

  @ApiResponse({ status: 200, description: 'List of cashflow types', type: createCashflowTypeDto })
  @ApiQuery({ name: 'type', type: String, enum: CashflowTypeEnum })
  @Get('/for/f-manager')
  async getAllForFilialManager(@Query('type') type: CashflowTypeEnum): Promise<CashflowType[]> {
    return this.cashflowTypeService.getForFilialManager(type);
  }

  @ApiResponse({ status: 200, description: 'List of cashflow types', type: createCashflowTypeDto })
  @ApiQuery({ name: 'type', type: String, enum: CashflowTypeEnum, required: false })
  @Get('/by/managers/:id')
  async getAllByManagerId(@Query('type') type: CashflowTypeEnum, @Param('id') id: string): Promise<CashflowType[]> {
    return this.cashflowTypeService.getById(type, id);
  }

  @ApiOperation({ summary: 'Get a single cashflow type by ID' })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Returns a cashflow type', type: CashflowType })
  @ApiResponse({ status: 404, description: 'Cashflow type not found' })
  @Get(':id')
  async getOne(@Param('id') id: string): Promise<CashflowType> {
    const cashflowType = await this.cashflowTypeService.getOne(id);
    if (!cashflowType) throw new NotFoundException('Cashflow type not found');
    return cashflowType;
  }

  @ApiOperation({ summary: 'Get a cashflow type by slug' })
  @ApiParam({ name: 'slug', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Returns a cashflow type', type: CashflowType })
  @ApiResponse({ status: 404, description: 'Cashflow type not found' })
  @Get('slug/:slug')
  async getOneBySlug(@Param('slug') slug: string): Promise<CashflowType> {
    return this.cashflowTypeService.getOneBySlug(slug);
  }

  @ApiOperation({ summary: 'Create a new cashflow type' })
  @ApiResponse({ status: 201, description: 'Cashflow type created successfully', type: CashflowType })
  @Post()
  async create(@Body() dto: CreateCashflowTypeDto): Promise<CashflowType> {
    return this.cashflowTypeService.create(dto);
  }

  @ApiParam({ name: 'id', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Restore Cashflow type deleted successfully' })
  @ApiResponse({ status: 404, description: 'Cashflow type not found' })
  @Patch('restore/:id')
  async restore(@Param('id') id: string): Promise<void> {
    await this.cashflowTypeService.restore(id);
  }

  @ApiOperation({ summary: 'Update an existing cashflow type' })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Cashflow type updated successfully' })
  @ApiResponse({ status: 404, description: 'Cashflow type not found' })
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCashflowTypeDto): Promise<void> {
    await this.cashflowTypeService.change(dto, id);
  }

  @ApiOperation({ summary: 'Delete a cashflow type by ID' })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Cashflow type deleted successfully' })
  @ApiResponse({ status: 404, description: 'Cashflow type not found' })
  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.cashflowTypeService.deleteOne(id);
  }
}
