import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartiyaNumberService } from './partiya_number.service';
import { PartiyaNumber } from './partiya_number.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '../../infra/shared/enum';
import { CreateStyleDto, UpdateStyleDto } from '../style/dto';
import { UpdateResult } from 'typeorm';
import { PaginationDto } from '../../infra/shared/dto';
import { Pagination } from 'nestjs-typeorm-paginate';

@ApiTags('Partiya-Number')
@Controller('partiya-number')
export class PartiyaNumberController {
  constructor(private readonly service: PartiyaNumberService) {
  }

  @Get('/')
  @ApiOperation({ summary: 'Method: returns all data' })
  @ApiOkResponse({
    description: 'The data was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getAll(@Query() query: PaginationDto): Promise<Pagination<PartiyaNumber>> {
    return await this.service.getAll(query);
  }


  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single data by id' })
  @ApiOkResponse({
    description: 'The data was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getOne(@Param('id') id: string): Promise<PartiyaNumber> {
    return await this.service.getOne(id);
  }

  @Post('/')
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.W_MANAGER, UserRoleEnum.F_MANAGER, UserRoleEnum.DEALER)
  @ApiOperation({ summary: 'Method: creates new data' })
  @ApiCreatedResponse({
    description: 'The data was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateStyleDto): Promise<PartiyaNumber> {
    return await this.service.create(data);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Method: updating data' })
  @ApiOkResponse({
    description: 'Data was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeData(
    @Body() data: UpdateStyleDto,
    @Param('id') id: string,
  ): Promise<UpdateResult> {
    return await this.service.change(data, id);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting data' })
  @ApiOkResponse({
    description: 'Data was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    return await this.service.deleteOne(id);
  }
}
