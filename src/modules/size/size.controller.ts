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
} from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CreateSizeDto, SizeQueryDto, UpdateSizeDto } from './dto';
import { Size } from './size.entity';
import { SizeService } from './size.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from 'src/infra/shared/enum';
import { Pagination } from 'nestjs-typeorm-paginate';
import { Public } from '@modules/auth/decorators/public.decorator';

@ApiTags('Size')
@Controller('size')
export class SizeController {
  constructor(private readonly sizeService: SizeService) {}

  @Public()
  @Get('/')
  @ApiOperation({ summary: 'Method: returns single size by id' })
  @ApiOkResponse({
    description: 'The size was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getAll(@Query() query: SizeQueryDto): Promise<Pagination<Size>> {
    return this.sizeService.getAll(query, {title: query.search});
  }

  @Get('/reports')
  @ApiOperation({ summary: 'Method: returns single size by id' })
  @ApiOkResponse({
    description: 'The size was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'filial', required: false, type: String })
  @ApiQuery({ name: 'model', required: false, type: String })
  @ApiQuery({ name: 'factory', required: false, type: String })
  @ApiQuery({ name: 'collection', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  async getSizesReport(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('filial') filial?: string,
    @Query('model') model?: string,
    @Query('factory') factory?: string,
    @Query('collection') collection?: string,
    @Query('country') country?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return await this.sizeService.sizesReport(page, limit, filial, model, factory, collection, country, year, month);
  }

  @Get('order/reports')
  @ApiOperation({ summary: 'Method: returns single size by id' })
  @ApiOkResponse({
    description: 'The size was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'filial', required: false, type: String })
  @ApiQuery({ name: 'model', required: false, type: String })
  @ApiQuery({ name: 'factory', required: false, type: String })
  @ApiQuery({ name: 'collection', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  async getSizesReportOrder(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('filial') filial?: string,
    @Query('model') model?: string,
    @Query('factory') factory?: string,
    @Query('collection') collection?: string,
    @Query('country') country?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return await this.sizeService.sizesReportOrder(page, limit, filial, model, factory, collection, country, year, month);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single size by id' })
  @ApiOkResponse({
    description: 'The size was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getMe(@Param('id') id: string): Promise<Size> {
    return this.sizeService.getOne(id);
  }

  @Post('/')
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.W_MANAGER, UserRoleEnum.F_MANAGER, UserRoleEnum.DEALER)
  @ApiOperation({ summary: 'Method: creates new size' })
  @ApiCreatedResponse({
    description: 'The size was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateSizeDto): Promise<Size> {
    return await this.sizeService.create(data);
  }

  @Patch('/merge/:id')
  @ApiOperation({ summary: 'Method: updating size' })
  @ApiOkResponse({
    description: 'Size was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeDataMerge(
    @Body() data: UpdateSizeDto,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return await this.sizeService.mergeSizeReferences(id, data.title);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Method: updating size' })
  @ApiOkResponse({
    description: 'Size was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeData(
    @Body() CollectionData: UpdateSizeDto,
    @Param('id') id: string,
  ): Promise<UpdateResult> {
    return await this.sizeService.change(CollectionData, id);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting size' })
  @ApiOkResponse({
    description: 'Size was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    return await this.sizeService.deleteOne(id);
  }
}
