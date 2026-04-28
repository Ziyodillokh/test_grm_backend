import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateShapeDto, ShapeQueryDto, UpdateShapeDto } from './dto';
import { Shape } from './shape.entity';
import { ShapeService } from './shape.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '../../infra/shared/enum';
import { Pagination } from 'nestjs-typeorm-paginate';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Shape')
@Controller('shape')
export class ShapeController {
  constructor(private readonly shapeService: ShapeService) {}

  @Public()
  @Get('/')
  @ApiOperation({ summary: 'Method: returns single Shape by id' })
  @ApiOkResponse({
    description: 'The Shape was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getAll(@Query() query: ShapeQueryDto): Promise<Pagination<Shape>> {
    return this.shapeService.getAll(query, {title: query.search});
  }

  @Public()
  @Get('/with-counts')
  async getAllWithCounts(@Query() query: ShapeQueryDto) {
    return this.shapeService.getAllWithCounts(query, { title: query.search });
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single Shape by id' })
  @ApiOkResponse({
    description: 'The Shape was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getMe(@Param('id') id: string): Promise<Shape> {
    return this.shapeService.getOne(id);
  }

  @Post('/')
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.DEALER, UserRoleEnum.W_MANAGER, UserRoleEnum.F_MANAGER)
  @ApiOperation({ summary: 'Method: creates new Shape' })
  @ApiCreatedResponse({
    description: 'The Shape was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateShapeDto): Promise<Shape> {
    return await this.shapeService.create(data);
  }

  @Patch('/merge/:id')
  @ApiOperation({ summary: 'Method: updating Shape' })
  @ApiOkResponse({
    description: 'Shape was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeDataMerge(
    @Body() data: UpdateShapeDto,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return await this.shapeService.mergeShapeReferences(id, data.title);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Method: updating Shape' })
  @ApiOkResponse({
    description: 'Shape was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeData(
    @Body() data: UpdateShapeDto,
    @Param('id') id: string,
  ): Promise<UpdateResult> {
    return await this.shapeService.change(data, id);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting Shape' })
  @ApiOkResponse({
    description: 'Shape was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    return await this.shapeService.deleteOne(id);
  }
}
