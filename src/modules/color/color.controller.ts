import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateColorDto, QueryColorDto, UpdateColorDto } from './dto';
import { Color } from './color.entity';
import { ColorService } from './color.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from 'src/infra/shared/enum';
import { Public } from '../auth/decorators/public.decorator';
import { Pagination } from 'nestjs-typeorm-paginate';

@ApiTags('Color')
@Controller('color')
export class ColorController {
  constructor(private readonly colorService: ColorService) {}

  @Public()
  @Get('/')
  @ApiOperation({ summary: 'Method: returns single color by id' })
  @ApiOkResponse({
    description: 'The color was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getAll(@Query() query: QueryColorDto): Promise<Pagination<Color>> {
    return this.colorService.getAll(query, {title: query.search});
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single color by id' })
  @ApiOkResponse({
    description: 'The color was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getMe(@Param('id') id: string): Promise<Color> {
    return this.colorService.getOne(id);
  }

  @Get('/merge/datas')
  @ApiOperation({ summary: 'Method: returns single color by id' })
  @ApiOkResponse({
    description: 'The color was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getMerge() {
    return this.colorService.mergeColors();
  }

  @Post('/')
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.F_MANAGER, UserRoleEnum.W_MANAGER, UserRoleEnum.D_MANAGER)
  @ApiOperation({ summary: 'Method: creates new color' })
  @ApiCreatedResponse({
    description: 'The color was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateColorDto): Promise<Color> {
    return await this.colorService.create(data);
  }

  @Patch('/merge/:id')
  @ApiOperation({ summary: 'Method: updating color' })
  @ApiOkResponse({
    description: 'Color was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeDataMerge(@Body() CollectionData: UpdateColorDto, @Param('id') id: string): Promise<{ message: string }> {
    return await this.colorService.mergeColorReferences(id, CollectionData.title);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Method: updating color' })
  @ApiOkResponse({
    description: 'Color was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeData(@Body() CollectionData: UpdateColorDto, @Param('id') id: string): Promise<{ message: string }> {
    return await this.colorService.mergeColorReferences(id, CollectionData.title);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting color' })
  @ApiOkResponse({
    description: 'Color was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    return await this.colorService.deleteOne(id);
  }
}
