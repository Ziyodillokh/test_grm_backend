import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientOrderItemService } from './client-order-item.service';
import { CreateClientOrderItemDto, UpdateClientOrderItemDto } from './dto';
import { ClientOrderItem } from './client-order-item.entity';

@ApiTags('ClientOrderItem')
@Controller('client-order-items')
export class ClientOrderItemController {
  constructor(private readonly service: ClientOrderItemService) {}

  @Post(':clientOrderId')
  @ApiOperation({ summary: 'Create a client order item' })
  @ApiResponse({ status: 201, type: ClientOrderItem })
  create(
    @Param('clientOrderId') clientOrderId: string,
    @Body() dto: CreateClientOrderItemDto,
  ) {
    return this.service.create(dto, clientOrderId);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get all client order items' })
  findAllByOrderId(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    page = Number(page);
    limit = Number(limit);
    return this.service.findAll(id, { page, limit });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update client order item' })
  update(@Param('id') id: string, @Body() dto: UpdateClientOrderItemDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete client order item' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
