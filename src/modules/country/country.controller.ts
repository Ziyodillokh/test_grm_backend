import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateCountryDto, QueryCountryDto, UpdateCountryDto } from './dto';
import { Country } from './country.entity';
import { CountryService } from './country.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '../../infra/shared/enum';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Country')
@Controller('country')
export class CountryController {
  constructor(private readonly countryService: CountryService) {}

  @Public()
  @Get('/')
  @ApiOperation({ summary: 'Method: returns all reference' })
  @ApiOkResponse({
    description: 'The reference were returned successfully',
  })
  async getDataAll(@Query() query: QueryCountryDto) {
    return await this.countryService.getAll(query, {title: query.search});
  }


  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single country by id' })
  @ApiOkResponse({
    description: 'The country was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getMe(@Param('id') id: string): Promise<Country> {
    return this.countryService.getOne(id);
  }

  @Post('/')
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.W_MANAGER, UserRoleEnum.F_MANAGER, UserRoleEnum.DEALER)
  @ApiOperation({ summary: 'Method: creates new country' })
  @ApiCreatedResponse({
    description: 'The country was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateCountryDto): Promise<Country> {
    return await this.countryService.create(data);
  }

  @Public()
  @Patch('/merge/:id')
  @ApiOperation({ summary: 'Method: updating country' })
  @ApiOkResponse({
    description: 'Country was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeDataMerge(
    @Body() data: UpdateCountryDto,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return await this.countryService.mergeColorReferences(id, data.title);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Method: updating country' })
  @ApiOkResponse({
    description: 'Country was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeData(
    @Body() data: UpdateCountryDto,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return await this.countryService.mergeColorReferences(id, data.title);
  }

  @Public()
  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting country' })
  @ApiOkResponse({
    description: 'Country was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    console.log(id);
    return await this.countryService.deleteOne(id);
  }
}
