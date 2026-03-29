import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProductHistoryService } from './product-history.service';
import { CreateProductHistoryDto } from './dto/create-product-history.dto';
import { ProductHistory } from './product-history.entity';

@ApiTags('Product History')
@Controller('product-history')
export class ProductHistoryController {
  constructor(private readonly service: ProductHistoryService) {
  }

  @Post()
  @ApiOperation({ summary: 'Create a product history record' })
  @ApiResponse({ status: 201, description: 'History record created', type: ProductHistory })
  create(@Body() dto: CreateProductHistoryDto) {
    return this.service.create(dto);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get history by product ID' })
  @ApiParam({ name: 'productId', type: String })
  @ApiResponse({ status: 200, description: 'List of product history', type: [ProductHistory] })
  findByProduct(@Param('productId') productId: string) {
    return this.service.findByProduct(productId);
  }
}
