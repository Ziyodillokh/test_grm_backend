import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { InsertResult } from 'typeorm';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateActionDto, restoreArxive } from './dto';
import { ActionService } from './action.service';
import { ProductQueryDto } from '../../infra/shared/dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Action')
@Controller('action')
export class ActionController {
  constructor(private readonly actionService: ActionService) {}

  @Public()
  @Get('/')
  @ApiOperation({ summary: 'Method: returns single color by id' })
  @ApiOkResponse({
    description: 'The action was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getAll(@Query() query: ProductQueryDto) {
    return await this.actionService.getAll({ limit: query.limit, page: query.page }, query);
  }

  @Public()
  @Get('/restore/data')
  @ApiOperation({ summary: 'Method: returns single color by id' })
  @ApiOkResponse({
    description: 'The action was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async restoreData(@Query() query: restoreArxive) {
    return await this.actionService.createArxive(query.startDate, query.endDate, query.filialId, query.kassaId);
  }

  @Post('/')
  @ApiOperation({ summary: 'Method: creates new color' })
  @ApiCreatedResponse({
    description: 'The color was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateActionDto, @Req() req): Promise<InsertResult> {
    return await this.actionService.create(data.info, data.user, data.filial, data.type);
  }
}
