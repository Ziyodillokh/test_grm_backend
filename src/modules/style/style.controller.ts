import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateStyleDto, StyleQueryDto, UpdateStyleDto } from './dto';
import { Style } from './style.entity';
import { StyleService } from './style.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '../../infra/shared/enum';
import { PaginationDto } from '../../infra/shared/dto';
import { Pagination } from 'nestjs-typeorm-paginate';
import { Public } from '@modules/auth/decorators/public.decorator';

@ApiTags('Style')
@Controller('style')
export class StyleController {
  constructor(private readonly styleService: StyleService) {}

  @Public()
  @Get('/')
  @ApiOperation({ summary: 'Method: returns single style by id' })
  @ApiOkResponse({
    description: 'The style was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getAll(@Query() query: StyleQueryDto): Promise<Pagination<Style>> {
    return this.styleService.getAll(query, {title: query.search});
  }

  @Public()
  @Get('/with-counts')
  async getAllWithCounts(@Query() query: StyleQueryDto) {
    return this.styleService.getAllWithCounts(query, { title: query.search });
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single style by id' })
  @ApiOkResponse({
    description: 'The style was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getMe(@Param('id') id: string): Promise<Style> {
    return this.styleService.getOne(id);
  }

  @Post('/')
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.F_MANAGER, UserRoleEnum.D_MANAGER, UserRoleEnum.W_MANAGER)
  @ApiOperation({ summary: 'Method: creates new style' })
  @ApiCreatedResponse({
    description: 'The style was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateStyleDto): Promise<Style> {
    const response = await this.styleService.create(data);
    return response;
  }

  @Patch('/merge/:id')
  @ApiOperation({ summary: 'Method: updating style' })
  @ApiOkResponse({
    description: 'Style was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeDataMerge(
    @Body() data: UpdateStyleDto,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return await this.styleService.mergeColorReferences(id, data.title);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Method: updating style' })
  @ApiOkResponse({
    description: 'Style was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeData(
    @Body() data: UpdateStyleDto,
    @Param('id') id: string,
  ): Promise<UpdateResult> {
    return await this.styleService.change(data, id);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting style' })
  @ApiOkResponse({
    description: 'Style was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    return await this.styleService.deleteOne(id);
  }
}
