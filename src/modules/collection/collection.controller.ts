import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
  CreateCollectionDto,
  QueryCollectionDto,
  TrCollectionDto,
  UpdateCollectionDto,
  UpdateCollectionInfosDto,
} from './dto';
import { Collection } from './collection.entity';
import { CollectionService } from './collection.service';
import { PaginationDto } from '../../infra/shared/dto';
import { Route } from '../../infra/shared/decorators/route.decorator';
import { Put } from '@nestjs/common/decorators';
import { User } from '../user/user.entity';
import { Public } from '@modules/auth/decorators/public.decorator';

@ApiTags('Collection')
@Controller('collection')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get('/')
  @ApiOperation({ summary: 'Method: returns all Collections' })
  @ApiOkResponse({
    description: 'The collections were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getData(@Route() route: string, @Query() query: QueryCollectionDto) {
    return await this.collectionService.getAll({ ...query, route }, { title: query.title || query.search });
  }

  @Get('/with-counts')
  async getAllWithCounts(@Query() query: QueryCollectionDto) {
    return this.collectionService.getAllWithCounts(query, { title: query.title || query.search });
  }

  @Get('/transfer-collection')
  @ApiOperation({ summary: 'Method: returns all Collections' })
  @ApiOkResponse({
    description: 'The collections were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getCollectionTransfer(@Route() route: string, @Query() query: TrCollectionDto, @Req() req: any) {
    return await this.collectionService.remainingProductsByCollectionTransfer({ ...query, _user: req.user });
  }

  @Get('/internet-shop')
  @ApiOperation({ summary: 'Method: returns all Collections' })
  @ApiOkResponse({
    description: 'The collections were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getDataInternetShop(@Route() route: string, @Query() query: PaginationDto) {
    return await this.collectionService.getAllInternetShop({ ...query, route });
  }

  @Get('/remaining-products')
  @ApiOperation({ summary: 'Method: returns all remaining products' })
  @ApiOkResponse({
    description: 'The remaining products were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getRemainingProductsByCollection(@Query() query) {
    return await this.collectionService.remainingProductsByCollection(query);
  }

  @Get('/remaining-factory')
  @ApiOperation({ summary: 'Method: returns remaining products by factory' })
  @ApiOkResponse({ description: 'Returned successfully' })
  @ApiQuery({ name: 'filial', required: false, type: String, description: 'Filial ID (UUID)' })
  @ApiQuery({ name: 'year', required: false, type: Number, description: 'Year (e.g. 2025)' })
  @ApiQuery({ name: 'month', required: false, type: Number, description: 'Month (1-12)' })
  @HttpCode(HttpStatus.OK)
  async remainingProductsByFactory(@Query() query) {
    return this.collectionService.remainingProductsByFactory(query);
  }

  @Get('/remaining-collections')
  @ApiOperation({ summary: 'Method: returns all remaining products' })
  @ApiOkResponse({
    description: 'The remaining products were returned successfully',
  })
  @ApiQuery({ name: 'filial', required: false, type: String, description: 'Filial ID (UUID)' })
  @ApiQuery({ name: 'year', required: false, type: Number, description: 'Yil (masalan: 2025)' })
  @ApiQuery({ name: 'month', required: false, type: Number, description: 'Oy (1-12)' })
  @HttpCode(HttpStatus.OK)
  async remainingCollections(
    @Req() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('filial') filial: string,
    @Query('year') year: number,
    @Query('month') month: number,
    @Query('search') search: string,
    @Query('country') country: string,
  ) {
    return await this.collectionService.remainingCollections({ limit, page }, req.user as User, country, filial, year, month, search);
  }

  @Public()
  @Get('/collections-report')
  @ApiQuery({ name: 'filial', required: false, type: String, description: 'Filial ID (UUID)' })
  async collectionReport(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('filial') filial: string,
  ) {
    return await this.collectionService.getCollections(page, limit, filial);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single collection by id' })
  @ApiOkResponse({
    description: 'The collection was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getMe(@Param('id') id: string): Promise<Collection> {
    return this.collectionService.getOne(id);
  }

  // collection create da factory qo'shish kerak. (create, update)
  @Post('/')
  @ApiOperation({ summary: 'Method: creates new Collection' })
  @ApiCreatedResponse({
    description: 'The collection was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateCollectionDto) {
    return await this.collectionService.create(data);
  }

  @Patch('/merge/:id')
  @ApiOperation({ summary: 'Method: updating Data' })
  @ApiOkResponse({
    description: 'Data was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeDataMerge(@Body() data: UpdateCollectionDto, @Param('id') id: string) {
    return await this.collectionService.change(data, id);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Method: updating collection' })
  @ApiOkResponse({
    description: 'Collection was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeData(@Body() CollectionData: UpdateCollectionDto, @Param('id') id: string) {
    return await this.collectionService.change(CollectionData, id);
  }

  @Patch('/change-infos/:id')
  @ApiOperation({ summary: 'Method: updating collection' })
  @ApiOkResponse({
    description: 'Collection was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeInfos(@Body() CollectionData: UpdateCollectionInfosDto, @Param('id') id: string): Promise<string> {
    return await this.collectionService.updateInfos(id, CollectionData);
  }

  @Put('/multiple')
  @ApiOperation({ summary: 'Method: updating collection' })
  @ApiOkResponse({
    description: 'Collection was changed',
  })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'abc123' },
          priceMeter: { type: 'string', example: '120.50' },
          comingPrice: { type: 'string', example: '100.00' },
          secondPrice: { type: 'string', example: '110.00' },
        },
        required: ['id'], // Only `id` required, adjust as needed
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async changeDatas(@Body() body): Promise<{ data: null; success: boolean }> {
    for (const bodyElement of body) {
      await this.collectionService.change(bodyElement.id, bodyElement);
    }

    return { data: null, success: true };
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting collection' })
  @ApiOkResponse({
    description: 'Collection was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    return await this.collectionService.deleteOne(id);
  }
}
