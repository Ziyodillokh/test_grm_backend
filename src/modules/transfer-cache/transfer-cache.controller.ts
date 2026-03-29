// transfer-cache.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TransferCacheService } from './transfer-cache.service';
import { CreateTransferCacheDto } from './dto/create-transfer-cache.dto';
import { UpdateTransferCacheDto } from './dto/update-transfer-cache.dto';

@ApiTags('Transfer Cache')
@Controller('transfer-cache')
export class TransferCacheController {
  constructor(private readonly service: TransferCacheService) {}

  @Post()
  @ApiOperation({ summary: 'Create transfer cache' })
  create(@Body() dto: CreateTransferCacheDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all transfer cache' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transfer cache by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update transfer cache by id' })
  update(@Param('id') id: string, @Body() dto: UpdateTransferCacheDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete transfer cache by id' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Delete()
  @ApiOperation({ summary: 'Check and delete by product/user/count logic' })
  checkAndDelete(
    @Query('productId') productId: string,
    @Query('userId') userId: string,
    @Query('count') count: number,
  ) {
    return this.service.checkAndDelete(productId, userId, Number(count));
  }
}
