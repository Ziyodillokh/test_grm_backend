import {
  BadRequestException,
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
} from '@nestjs/common';
import { InsertResult, UpdateResult } from 'typeorm';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CreateModelDto, ModelQueryDto, UpdateModelDto } from './dto';
import { Model } from './model.entity';
import { ModelService } from './model.service';
import { Route } from '../../infra/shared/decorators/route.decorator';
import { Public } from '@modules/auth/decorators/public.decorator';

@ApiTags('Model')
@Controller('model')
export class ModelController {
  constructor(private readonly modelService: ModelService) {}

  @Get('/')
  @ApiOperation({ summary: 'Method: returns all Models' })
  @ApiOkResponse({
    description: 'The models were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getData(@Route() route: string, @Query() query: ModelQueryDto) {
    return await this.modelService.getAll({ ...query, route }, {title: query.search});
  }

  @Get('/with-counts')
  async getAllWithCounts(@Query() query: ModelQueryDto) {
    return this.modelService.getAllWithCounts(query, { title: query.search });
  }

  @Get('/models-report')
  @ApiOperation({ summary: 'Get models with aggregation data' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'filial', required: false, type: String })
  async getModels(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('filial') filial: string,
    @Query('collectionId') collectionId: string,
    @Query('factory') factory: string,
    @Query('country') country: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.modelService.getModels(collectionId, page, limit, filial, factory, country, year, month);
  }

  @Get('order/models-report')
  @ApiOperation({ summary: 'Get models with aggregation data' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'filial', required: false, type: String })
  async getModelsOrderReport(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('filial') filial: string,
    @Query('collectionId') collectionId: string,
    @Query('factory') factory: string,
    @Query('country') country: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.modelService.getModelsReport(collectionId, page, limit, filial, factory, country, year, month);
  }

  @Get('/by-collection/:id')
  @ApiOperation({ summary: 'Method: returns all Models' })
  @ApiOkResponse({
    description: 'The models were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getDataByCollection(@Route() route: string, @Query() query: ModelQueryDto, @Param('id') id: string) {
    return await this.modelService.getAll({ ...query, route }, { collection: { id }, title: query.search });
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single model by id' })
  @ApiOkResponse({
    description: 'The model was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getMe(@Param('id') id: string): Promise<Model> {
    return this.modelService.getOne(id);
  }

  // @Roles(userRoles.ADMIN, userRoles.SUPER_ADMIN)
  @Post('/')
  @ApiOperation({ summary: 'Method: creates new Model' })
  @ApiCreatedResponse({
    description: 'The model was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateModelDto): Promise<BadRequestException | InsertResult> {
    return await this.modelService.create(data);
  }

  // @Roles(userRoles.ADMIN, userRoles.SUPER_ADMIN)
  @Patch('/:id')
  @ApiOperation({ summary: 'Method: updating model' })
  @ApiOkResponse({
    description: 'Model was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeData(
    @Body() ModelData: UpdateModelDto,
    @Param('id') id: string,
  ): Promise<UpdateResult> {
    return await this.modelService.change(ModelData, id);
  }

  // @Roles(userRoles.ADMIN, userRoles.SUPER_ADMIN)
  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting model' })
  @ApiOkResponse({
    description: 'Model was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    return await this.modelService.deleteOne(id);
  }
}
