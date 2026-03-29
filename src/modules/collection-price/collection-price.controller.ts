import { CollectionPriceService } from './collection-price.service';
import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateCollectionPriceDto, UpdateCollectionPriceDto } from './dto';
import { Patch, Put } from '@nestjs/common/decorators';
import { Roles } from '../auth/decorators/roles.decorator';
import { SetDiscountDto } from './dto/update-collection-price.dto';
import { UserRoleEnum } from '@infra/shared/enum';

@ApiTags('Collection Prices')
@Controller('collection-prices')
export class CollectionPriceController {
  constructor(private readonly collectionPriceService: CollectionPriceService) {}

  @Get()
  @ApiOperation({ summary: 'Get all collection prices' })
  @ApiResponse({ status: 200, description: 'List of collection prices' })
  findAll() {
    return this.collectionPriceService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a collection price by ID' })
  @ApiResponse({ status: 200, description: 'Collection price found' })
  @ApiResponse({ status: 404, description: 'Collection price not found' })
  findOne(@Param('id') id: string) {
    return this.collectionPriceService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new collection price' })
  @ApiResponse({ status: 201, description: 'Collection price created' })
  create(@Body() data: CreateCollectionPriceDto, @Req() req) {
    return this.collectionPriceService.create(data, req.user);
  }

  @Roles(UserRoleEnum.DEALER, UserRoleEnum.M_MANAGER, UserRoleEnum.DEALER, UserRoleEnum.I_MANAGER)
  @Post('/multiple')
  @ApiOperation({ summary: 'Create a new collection price' })
  @ApiResponse({ status: 201, description: 'Collection price created' })
  @ApiBody({
    type: CreateCollectionPriceDto,
    description: 'Array of collection prices',
    isArray: true,
  })
  @ApiQuery({ name: 'dealer', required: false, description: 'Optional dealer ID' })
  async create_multiple(@Body() data: CreateCollectionPriceDto[], @Req() req, @Query('dealer') dealer?: string) {
    return this.collectionPriceService.createOrUpdatePrice(data, req.user, dealer);
  }
  @Roles(UserRoleEnum.M_MANAGER)
  @Patch('collection-price/:collectionPriceId/discount/:discountId')
  @ApiBody({ type: SetDiscountDto })
  async setDiscount(
    @Param('collectionPriceId') collectionPriceId: string,
    @Param('discountId') discountId: string,
    @Body() body: SetDiscountDto,
  ) {
    return await this.collectionPriceService.setDiscountToCollectionPrice(collectionPriceId, discountId, body.isAdd);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a collection price' })
  @ApiResponse({ status: 200, description: 'Collection price updated' })
  update(@Param('id') id: string, @Body() data: UpdateCollectionPriceDto) {
    return this.collectionPriceService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a collection price' })
  @ApiResponse({ status: 204, description: 'Collection price deleted' })
  remove(@Param('id') id: string) {
    return this.collectionPriceService.remove(id);
  }
}
