import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { OrderBasketService } from './order-basket.service';
import { OrderBasket } from './order-basket.entity';
import { createOrderBasketDto, orderBasketQueryDto, orderBasketUpdateDto } from './dto';
import { DeleteResult, InsertResult, UpdateResult } from 'typeorm';
import { Pagination } from 'nestjs-typeorm-paginate';
import { Patch, Put } from '@nestjs/common/decorators';
import { isBooleanString } from 'class-validator';

@ApiTags('Order-Basket')
@Controller('order-basket')
export class OrderBasketController {
  constructor(private readonly orderBasketService: OrderBasketService) {}

  @Get('/')
  @ApiOperation({ summary: 'Method: returns all order baskets' })
  @ApiOkResponse({
    description: 'The order baskets were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async get(@Req() request: Request, @Query() query: orderBasketQueryDto): Promise<Pagination<OrderBasket>> {
    return await this.orderBasketService.find(request['user'], query, {
      is_transfer: query?.is_transfer,
      filial: query.filial,
    });
  }

  @Get('/counts')
  @ApiOperation({ summary: 'Method: returns all order baskets' })
  @ApiOkResponse({
    description: 'The order baskets were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getCounts(@Req() request): Promise<{ order: number, transfer: number }> {
    return await this.orderBasketService.getCountsByUser(request.user);
  }

  @Get('/bookings')
  @ApiOperation({ summary: 'Method: returns all order baskets' })
  @ApiOkResponse({
    description: 'The order baskets were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getBooking(@Query() query: orderBasketQueryDto): Promise<Pagination<OrderBasket>> {
    const where = {
      ...(query.filial && { product: { id: query.product, filial: { id: query.filial } } }),
      ...(query.product && { product: { id: query.product, ...(query.filial && { filial: { id: query.filial } }) } }),
      ...(isBooleanString(query.is_transfer) && { is_transfer: JSON.parse(query.is_transfer) }),
    };
    return await this.orderBasketService.findForBookings({ limit: query.limit, page: query.page }, where);
  }

  @Get('/product-price')
  @ApiOperation({ summary: 'Method: returns all order baskets' })
  @ApiOkResponse({
    description: 'The order baskets were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getProdPrice(@Req() request: Request): Promise<number> {
    return await this.orderBasketService.calcProduct(request['user']);
  }

  @Post('/')
  @ApiOperation({ summary: 'Method: create new order basket.' })
  @ApiOkResponse({ description: 'The order baskets were returned successfully' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() values: createOrderBasketDto, @Req() request: Request): Promise<InsertResult> {
    console.log('yes');

    return { generatedMaps: [], identifiers: [], raw: await this.orderBasketService.create(values, request['user']) };
  }

  @Post('/multiple')
  @ApiOperation({ summary: 'Method: create new order basket.' })
  @ApiOkResponse({ description: 'The order baskets were returned successfully' })
  @HttpCode(HttpStatus.CREATED)
  async createMultiple(@Body() values: createOrderBasketDto[], @Req() request: Request): Promise<InsertResult> {
    console.log('yes');

    return {
      generatedMaps: [],
      identifiers: [],
      raw: await this.orderBasketService.createMultiple(values, request['user']),
    };
  }

  @Post('/calc-discount')
  @ApiOperation({ summary: 'Method: create new order basket.' })
  @ApiOkResponse({ description: 'The order baskets were returned successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        price: { type: 'number' },
      },
    },
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async CalcDiscount(@Body() values: { price: number }, @Req() request: Request): Promise<string> {
    return await this.orderBasketService.calcDiscount(values.price, request['user']);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: delete order basket.' })
  @ApiOkResponse({ description: 'The order baskets were deleted successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<DeleteResult> {
    return await this.orderBasketService.delete(id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Method: restore order basket.' })
  @ApiOkResponse({ description: 'The order baskets were restored successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async restore(@Param('id') id: string): Promise<DeleteResult> {
    return await this.orderBasketService.restore(id);
  }

  @Put('/:id')
  @ApiOperation({ summary: 'Method: update new order basket.' })
  @ApiOkResponse({ description: 'The order baskets were updated successfully' })
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() body: orderBasketUpdateDto): Promise<UpdateResult> {
    return await this.orderBasketService.update(id, body);
  }
}
