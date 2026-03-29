import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateCashflowDto, createDealerCashflowDto } from './dto';
import { Route } from '../../infra/shared/decorators/route.decorator';
import { CashflowService } from './cashflow.service';
import { Cashflow } from './cashflow.entity';
import { PaginatedFilterCashflowDto } from './dto/paginated-filter-cashflow.dto';
import { FilterCashflowByMonthDto } from './dto/for-boss-filter.dto';
import { CashFlowEnum } from 'src/infra/shared/enum';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Cashflow')
@Controller('cashflow')
export class CashflowController {
  constructor(private readonly cashflowService: CashflowService) {}

  @Get('/')
  @ApiOperation({ summary: 'Method: returns all Cashflows' })
  @ApiOkResponse({
    description: 'The cashflows were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getData(@Route() route: string, @Query() query: PaginatedFilterCashflowDto) {
    return await this.cashflowService.getAll({ page: query.page || 1, limit: query.limit || 10, route }, query);
  }

  // @Roles(UserRoleEnum.F_MANAGER)
  @Get('/for/filial-manager/:id')
  @ApiOperation({ summary: 'Method: returns total cashflow for filial manager' })
  @ApiOkResponse({
    description: 'The cashflow total was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getTotalForFlManager(@Param('id') kassaReportId: string): Promise<{ income: number; expense: number }> {
    return this.cashflowService.getTotalForFlManager(kassaReportId);
  }

  @Get('summary')
  @ApiQuery({ name: 'year', example: 2025 })
  @ApiQuery({ name: 'month', example: 2 })
  @ApiQuery({ name: 'startDate', example: 1 })
  @ApiQuery({ name: 'endDate', example: 15 })
  @ApiQuery({ name: 'filialId', required: false })
  async getSummary(
    @Query('year') year: number,
    @Query('month') month: number,
    @Query('startDate') startDate: number,
    @Query('endDate') endDate: number,
    @Query('filialId') filialId?: string,
  ) {
    return await this.cashflowService.getSummary(year, month, startDate, endDate, filialId);
  }

  @Get('calculate-dealer-balances')
  @ApiOperation({ summary: 'Dealer filiallar uchun given/owed hisoblash 0 dan' })
  async calculateDealerBalances() {
    return this.cashflowService.calculateDealerFilialsFromCashflows();
  }

  @Get('filtered')
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: CashFlowEnum,
    description: 'Filtrlash uchun tur: Приход (Income) yoki Расход (Expense)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getFiltered(@Query() dto: FilterCashflowByMonthDto) {
    return this.cashflowService.getFilteredCashflows(dto);
  }

  // @Roles(UserRoleEnum.M_MANAGER)
  @Get('/for/main-manager/:id')
  @ApiOperation({ summary: 'Method: returns total cashflow for main manager' })
  @ApiOkResponse({
    description: 'The cashflow total was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getTotalForMManager(@Param('id') reportId: string): Promise<{ income: number; expense: number }> {
    return this.cashflowService.getTotalForMManager(reportId);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single cashflow by id' })
  @ApiOkResponse({
    description: 'The cashflow was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getMe(@Param('id') id: string): Promise<Cashflow> {
    return this.cashflowService.getOne(id);
  }

  @Post('/')
  @ApiOperation({ summary: 'Method: creates new Cashflow' })
  @ApiCreatedResponse({
    description: 'The cashflow was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateCashflowDto, @Req() req) {
    const userId = req.user.id;

    return await this.cashflowService.create(data, userId);
  }

  @Post('/dealer/income')
  @ApiOperation({ summary: 'Method: creates new Cashflow for dealer income!' })
  @ApiCreatedResponse({
    description: 'The cashflow was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async createCashflow(@Body() data: createDealerCashflowDto) {
    await this.cashflowService.dealerCashflow(data);
  }


  @Patch('restore/:id')
  restore(@Param('id') id: string, @Req() req) {
    return this.cashflowService.restoreWithOrder(id);
  }

  @Patch('update/costs/:kassa_id')
  @ApiOperation({ summary: 'Method: calc and set to kassa.' })
  async updateCosts(@Param('kassa_id') kassa_id: string) {
    return await this.cashflowService.updatecosts(kassa_id);
  }

  @Patch(':id/cancel')
  cancelCashflow(@Param('id') id: string, @Req() req) {
    const userId = req.user.id;
    return this.cashflowService.cancel(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.cashflowService.delete(id);
  }

  @Delete('/cashflow/kassa/:id')
  cancelCashflowClear(@Param('id') id: string) {
    return this.cashflowService.deleteWithOrder(id);
  }

  @Delete(':id/cashflows-orders/permanent')
  @ApiOperation({ summary: 'Shaxboz aka ehtiyot boling hammasi ochib ketadi' })
  @ApiParam({ name: 'id', description: 'Kassa ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Successfully permanently deleted' })
  async permanentDeleteCashflowsAndOrders(@Param('id', ParseUUIDPipe) kassaId: string) {
    try {
      const result = await this.cashflowService.hardDeleteAllByKassaId(kassaId);
      return {
        statusCode: 200,
        message: 'Cashflows and orders permanently deleted',
        data: result,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to permanently delete');
    }
  }
  @Post('update-dates/:kassaId')
  @ApiOperation({
    summary: 'Excel fayldan order datalarini yangilash',
    description: "Excel faylda date, price va plasticSum ustunlari bo'lishi kerak",
  })
  @ApiParam({
    name: 'kassaId',
    description: 'Kassa ID',
    example: 'uuid-kassa-id',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel fayl (date, price, plasticSum ustunlari bilan)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Orders muvaffaqiyatli yangilandi',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '5 ta order yangilandi' },
        updatedCount: { type: 'number', example: 5 },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async updateOrdersDate(@Param('kassaId') kassaId: string, @UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        return {
          success: false,
          message: 'Excel fayl yuklash majburiy',
        };
      }
      const excelData = this.cashflowService.parseExcelBuffer(file.buffer);

      if (excelData.length === 0) {
        return { success: false, message: 'Excel fayl bo\'sh' };
      }

      const firstRow = excelData[0];
      const requiredColumns = ['date', 'price', 'plastic', 'id'];
      const missingColumns = requiredColumns.filter(col => !firstRow.hasOwnProperty(col));

      if (missingColumns.length) {
        return { success: false, message: `Ushbu ustunlar yo'q: ${missingColumns.join(', ')}` };
      }

      const result = await this.cashflowService.updateCashflowDate(excelData, kassaId);

      return {
        success: true,
        message: `${result.updated_rows.length} ta order yangilandi`,
        updated_rows: result.un_updated_rows,
        result,
      };
    } catch (error) {
      console.error('Excel processing error:', error);
      return {
        success: false,
        message: 'Excel faylni qayta ishlashda xatolik',
        error: error.message,
      };
    }
  }

  @Post('update-dates/by/report')
  @ApiOperation({
    summary: 'Excel fayldan order datalarini yangilash',
    description: 'Excel faylda date, price va plasticSum ustunlari bo\'lishi kerak',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel fayl (date, price, plasticSum ustunlari bilan)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Orders muvaffaqiyatli yangilandi',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '5 ta order yangilandi' },
        updatedCount: { type: 'number', example: 5 },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async updateCashflowInReport(@UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        return {
          success: false,
          message: 'Excel fayl yuklash majburiy',
        };
      }
      const excelData = this.cashflowService.parseExcelBuffer(file.buffer);

      if (excelData.length === 0) {
        return { success: false, message: 'Excel fayl bo\'sh' };
      }

      const firstRow = excelData[0];
      const requiredColumns = ['date', 'id'];
      const missingColumns = requiredColumns.filter(col => !firstRow.hasOwnProperty(col));

      if (missingColumns.length) {
        return { success: false, message: `Ushbu ustunlar yo'q: ${missingColumns.join(', ')}` };
      }

      const result = await this.cashflowService.updateCashflowInReport(excelData);

      return {
        success: true,
        message: `${result.updated_rows.length} ta cashflow yangilandi`,
        updated_rows: result.un_updated_rows,
        result,
      };
    } catch (error) {
      console.error('Excel processing error:', error);
      return {
        success: false,
        message: 'Excel faylni qayta ishlashda xatolik',
        error: error.message,
      };
    }
  }
}
