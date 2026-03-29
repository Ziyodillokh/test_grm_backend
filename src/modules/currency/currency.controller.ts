import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Currency } from './currency.entity';
import { Pagination } from 'nestjs-typeorm-paginate';
import { PaginationDto } from '../../infra/shared/dto';
import { CreateCurrencyDto, UpdateCurrencyDto } from './dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Currency')
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {
  }

  @Public()
  @Get()
  @ApiOkResponse({ description: 'Paginated list of currencies', type: Currency, isArray: true })
  async findAll(@Query() query: PaginationDto): Promise<Pagination<Currency>> {
    return await this.currencyService.paginate({ page: query.page, limit: query.limit });
  }

  @Post()
  @ApiCreatedResponse({ description: 'Currency created successfully', type: Currency })
  async create(@Body() dto: CreateCurrencyDto): Promise<Currency> {
    return await this.currencyService.create(dto);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Currency found', type: Currency })
  @ApiNotFoundResponse({ description: 'Currency not found' })
  async findOne(@Param('id') id: string): Promise<Currency> {
    return await this.currencyService.findOne(id);
  }

  @Put(':id')
  @ApiOkResponse({ description: 'Currency updated successfully', type: Currency })
  @ApiNotFoundResponse({ description: 'Currency not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateCurrencyDto): Promise<Currency> {
    return await this.currencyService.update(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'Currency deleted successfully' })
  @ApiNotFoundResponse({ description: 'Currency not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return await this.currencyService.remove(id);
  }
}
