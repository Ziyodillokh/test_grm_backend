import { ApiBody, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Query } from '@nestjs/common';
import { FilialPlanService } from '@modules/filial-plan/filial-plan.service';
import { Put } from '@nestjs/common/decorators';

@ApiTags('Filial Plan')
@Controller('filial-plan')
export class FilialPlanController {
  constructor(
    private readonly filialPlanService: FilialPlanService,
  ) {
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return await this.filialPlanService.getTotals(Number(page || 1), Number(limit || 15));
  }

  @Get('/:year')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'month', required: false, type: Number })
  async getByYear(
    @Param('year') year: number,
    @Query('page') page = 1,
    @Query('limit') limit = 15,
    @Query('filialId') filialId?: string,
    @Query('month') month?: number,
  ) {
    return this.filialPlanService.getByYear(
      Number(year),
      Number(limit),
      Number(page),
      filialId,
      month ? Number(month) : undefined,
    );
  }
  @Get('/by-filial/:id')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'seller', required: false, type: String })
  async getByFilial(
    @Param('id') id: string,
    @Query('year') year: number,
    @Query('page') page = 1,
    @Query('limit') limit = 15,
    @Query('month') month?: number,
    @Query('seller') seller?: string,
  ) {
    return this.filialPlanService.getByFilial(
      Number(year),
      Number(limit),
      Number(page),
      id,
      month ? Number(month) : undefined,
      seller
    );
  }

  @Put(':id')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        price: {
          type: 'number',
        },
        year: {
          type: 'number',
        }
      },
    },
  })
  async updatePlanPrice(
    @Param('id') id: string,
    @Body() body: { price: number, year: number },
  ) {
    return await this.filialPlanService.updateYearPlan(id, body.price, body.year);
  }
}