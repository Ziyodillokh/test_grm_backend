import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { DiscountService } from './discount.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { PaginationDto } from '../../infra/shared/dto';

@ApiTags('Discount')
@Controller('discount')
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new discount' })
  @ApiBody({ type: CreateDiscountDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Discount created successfully',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Discount with this title already exists',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async create(@Body() createDiscountDto: CreateDiscountDto) {
    return await this.discountService.create(createDiscountDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all discounts' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all discounts',
  })
  async findAll(@Query() query: PaginationDto) {
    return await this.discountService.findAll(query);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: 'Get order discounts' })
  @ApiResponse({
    status: HttpStatus.OK,
  })
  async getOrderByDiscount(@Param('id', ParseUUIDPipe) id: string) {
    return await this.discountService.getOrderByDiscount(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get discount by ID' })
  @ApiParam({
    name: 'id',
    description: 'Discount ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Discount found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Discount not found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.discountService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update discount' })
  @ApiParam({
    name: 'id',
    description: 'Discount ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateDiscountDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Discount updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Discount not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Discount with this title already exists',
  })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateDiscountDto: UpdateDiscountDto) {
    return await this.discountService.update(id, updateDiscountDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete discount' })
  @ApiParam({
    name: 'id',
    description: 'Discount ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Discount deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Discount not found',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.discountService.remove(id);
  }
}
