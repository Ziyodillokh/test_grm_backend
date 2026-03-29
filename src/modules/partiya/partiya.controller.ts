import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { CreatePartiyaDto, QueryPartiyaDto, UpdatePartiyaDto } from './dto';
import { Partiya } from './partiya.entity';
import { PartiyaService } from './partiya.service';
import { Route } from '../../infra/shared/decorators/route.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PartiyaStatusEnum, UserRoleEnum } from 'src/infra/shared/enum';

@ApiTags('Partiya')
@Controller('partiya')
export class PartiyaController {
  constructor(private readonly partiyaService: PartiyaService) {}

  @Get('/')
  @ApiOperation({ summary: 'Method: returns all partiya' })
  @ApiOkResponse({
    description: 'The partiya were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getData(@Route() route: string, @Query() query: QueryPartiyaDto, @Req() req) {
    try {
      return await this.partiyaService.getAll({ page: query.page, limit: query.limit, route }, req.where, req.user);
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  @Get('/date-range')
  @ApiOperation({ summary: 'Method: returns all partiya by date range' })
  @ApiOkResponse({
    description: 'The partiya were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getDataByRange() {
    try {
      return await this.partiyaService.getAllByDateRange();
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('/change-to/:id/:status')
  @ApiOperation({ summary: 'Method: returns all partiya by date range' })
  @ApiOkResponse({
    description: 'The partiya were returned successfully',
  })
  @ApiParam({
    name: 'status',
    enum: PartiyaStatusEnum,
    required: true,
  })
  @HttpCode(HttpStatus.OK)
  async changePartiyaStatus(@Param('status') status: PartiyaStatusEnum, @Param('id') id: string, @Req() req) {
    return await this.partiyaService.changeStatus(id, status, req.user);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single partiya by id' })
  @ApiOkResponse({
    description: 'The partiya was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getMe(@Param('id') id: string) {
    return this.partiyaService.getOne(id);
  }

  @Patch('/correct-all/:id')
  @ApiOperation({ summary: 'Method: updating partiya' })
  @ApiOkResponse({
    description: 'Partiya was changed',
  })
  @HttpCode(HttpStatus.OK)
  async correctAll(@Param('id') id: string, @Req() req): Promise<string> {
    try {
      return await this.partiyaService.correctAll(id);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('/')
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.W_MANAGER, UserRoleEnum.F_MANAGER, UserRoleEnum.DEALER)
  @ApiOperation({ summary: 'Method: creates new partiya' })
  @ApiCreatedResponse({
    description: 'The partiya was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveDataExc(@Body() positionData: CreatePartiyaDto, @Req() req): Promise<Partiya> {
    try {
      return await this.partiyaService.create(positionData, req.user);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Method: updating partiya' })
  @ApiOkResponse({
    description: 'Partiya was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeData(@Body() data: UpdatePartiyaDto, @Param('id') id: string, @Req() req): Promise<UpdateResult> {
    try {
      return await this.partiyaService.change(data, id);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('/expense/:id')
  @ApiOperation({ summary: 'Method: updating partiya' })
  @ApiOkResponse({
    description: 'Partiya was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeExpense(@Body() data: UpdatePartiyaDto, @Param('id') id: string, @Req() req): Promise<UpdateResult> {
    try {
      return await this.partiyaService.changeExp(data.expense, id, req.user);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting partiya' })
  @ApiOkResponse({
    description: 'Partiya was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    try {
      return await this.partiyaService.deleteOne(id);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
