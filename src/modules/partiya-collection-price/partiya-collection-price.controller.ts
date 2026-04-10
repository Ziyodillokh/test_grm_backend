import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PartiyaCollectionPriceService } from './partiya-collection-price.service';
import { UpsertPartiyaCollectionPriceDto } from './dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@infra/shared/enum';

@ApiTags('Partiya Collection Price')
@Controller('partiya-collection-price')
export class PartiyaCollectionPriceController {
  constructor(private readonly service: PartiyaCollectionPriceService) {}

  @Get('partiya/:partiyaId')
  @ApiOperation({ summary: 'List per-collection prices for a partiya' })
  getByPartiya(@Param('partiyaId') partiyaId: string) {
    return this.service.getByPartiya(partiyaId);
  }

  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.BOSS)
  @Post()
  @ApiOperation({ summary: 'Bulk upsert per-collection prices for a partiya' })
  upsertMany(@Body() dto: UpsertPartiyaCollectionPriceDto) {
    return this.service.upsertMany(dto);
  }

  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.BOSS)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a PartiyaCollectionPrice row' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
