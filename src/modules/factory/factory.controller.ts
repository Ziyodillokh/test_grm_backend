import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FactoryService } from './factory.service';
import { PaginationDto } from '../../infra/shared/dto';
import { Route } from '../../infra/shared/decorators/route.decorator';
import { Factory } from './factory.entity';
import { UpdateResult } from 'typeorm';
import { connectFactoriesToCountry, CreateFactoryDto, FactoryQueryDto, UpdateFactoryDto } from './dto';
import { Put } from '@nestjs/common/decorators';
import { Public } from '@modules/auth/decorators/public.decorator';

@ApiTags('Factory')
@Controller('factory')
export class FactoryController {
  constructor(
    private readonly service: FactoryService,
  ) {
  }

  @Get('/')
  @ApiOperation({ summary: 'Method: returns all data' })
  @ApiOkResponse({
    description: 'The data were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getData(@Query() query: FactoryQueryDto, @Route() route: string) {
    return await this.service.getAll({ limit: query.limit, page: query.page, route }, {title: query.search});
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single product by id' })
  @ApiOkResponse({
    description: 'The product was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getOne(@Param('id') id: string): Promise<Factory> {
    return await this.service.getOne(id);
  }


  @Post('/')
  @ApiOperation({ summary: 'Method: creates new data' })
  @ApiCreatedResponse({
    description: 'The data was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateFactoryDto): Promise<Factory> {
    return await this.service.create(data);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Method: updating data' })
  @ApiOkResponse({
    description: 'data was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeData(
    @Body() data: UpdateFactoryDto,
    @Param('id') id: string,
  ): Promise<UpdateResult> {
    return await this.service.change(data, id);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting data' })
  @ApiOkResponse({
    description: 'data was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    return await this.service.deleteOne(id);
  }

  @Put('/connect-factories/collection')
  @ApiOperation({ summary: 'Method: connect datas to country' })
  @ApiOkResponse({ description: 'datas were update' })
  @HttpCode(HttpStatus.OK)
  async connectFactoriesToCounty(@Body() body: connectFactoriesToCountry){
    return await this.service.connectFactoriesToCountry(body)
  }


}
