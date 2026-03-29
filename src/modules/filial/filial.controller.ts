  import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FilialService } from './filial.service';
import { Route } from '../../infra/shared/decorators/route.decorator';
import { FilialQueryDto, PaginationDto } from '../../infra/shared/dto';
import { Filial } from './filial.entity';
import { CreateDealerDto, CreateFilialDto, UpdateFilialDto } from './dto';
import { UpdateResult } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';
import { Req } from '@nestjs/common/decorators';
import PaginationParamsDto from './dto/pagination.param.dto';

@ApiTags('Filial')
@Controller('filial')
export class FilialController {
  constructor(private readonly filialService: FilialService) {}

  @Public()
  @Get('/')
  @ApiOperation({ summary: 'Method: returns all filial' })
  @ApiOkResponse({
    description: 'The filial were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getData(@Route() route: string, @Query() query: FilialQueryDto, @Req() req) {
    return await this.filialService.getAll({ ...query, route }, req.where);
  }

  @Get('/warehouse-and-filial')
  @ApiOperation({ summary: 'Method: returns all FILIAL and WAREHOUSE types' })
  @ApiOkResponse({ description: 'The filials and warehouses were returned successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @HttpCode(HttpStatus.OK)
  async getFilialsAndWarehouses(@Route() route: string, @Query() query: PaginationParamsDto, @Req() req) {
    return await this.filialService.getFilialTypeWarehousesAndFIlials({ ...query, route }, req.where);
  }

  @Get('/warehouse')
  @ApiOperation({ summary: 'Method: returns all warehouse' })
  @ApiOkResponse({
    description: 'The warehouse were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getWareHouse(@Route() route: string, @Query() query: PaginationDto) {
    return await this.filialService.getWarehouses({ ...query, route });
  }

  @Get('/action')
  @ApiOperation({ summary: 'Method: returns all filial' })
  @ApiOkResponse({
    description: 'The filial were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getAction() {
    return await this.filialService.name();
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single filial by id' })
  @ApiOkResponse({
    description: 'The filial was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getMe(@Param('id') id: string): Promise<Filial> {
    return this.filialService.getOne(id);
  }

  @Post('/')
  @ApiOperation({ summary: 'Method: creates new filial' })
  @ApiCreatedResponse({
    description: 'The filial was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateFilialDto): Promise<Filial> {
    return await this.filialService.create(data);
  }

  @Post('/dealer')
  @ApiOperation({ summary: 'Method: creates new filial' })
  @ApiCreatedResponse({
    description: 'The filial was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveDealer(@Body() data: CreateDealerDto): Promise<{ success: boolean; filialId: number }> {
    return await this.filialService.createDealerWithManager(data);
  }

  @Patch('/maker-report/:id')
  @ApiOperation({ summary: 'Method: updating filial' })
  @ApiOkResponse({
    description: 'Filial was changed make report',
  })
  @HttpCode(HttpStatus.OK)
  async changeMakeReport(@Body() data: UpdateFilialDto, @Param('id') id: string): Promise<UpdateResult> {
    return await this.filialService.makeReport(id);
  }

  @Patch('/maker-report/:id')
  @ApiOperation({ summary: 'Method: updating filial' })
  @ApiOkResponse({
    description: 'Filial was changed make report',
  })
  @HttpCode(HttpStatus.OK)
  async changeMake(@Param('id') id: string): Promise<UpdateResult> {
    return await this.filialService.makeReport(id);
  }

  @Patch('/end-report/:id')
  @ApiOperation({ summary: 'Method: updating filial' })
  @ApiOkResponse({
    description: 'Filial was changed make report',
  })
  @HttpCode(HttpStatus.OK)
  async changeDone(@Param('id') id: string): Promise<UpdateResult> {
    return await this.filialService.endReport(id);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Method: updating filial' })
  @ApiOkResponse({
    description: 'Filial was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeData(@Body() data: UpdateFilialDto, @Param('id') id: string): Promise<UpdateResult> {
    return await this.filialService.change(data, id);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting filial' })
  @ApiOkResponse({
    description: 'Filial was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    return await this.filialService.deleteOne(id);
  }

  @Public()
  @Get('/hickontrol/all/filials/hook')
  async getFilialsHik_control() {
    return await this.filialService.getFilials4hick();
  }
}
