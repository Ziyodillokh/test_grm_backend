import { BadRequestException, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { SellerReportItemService } from './seller-report-item.service';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueryReportItemDto } from './dto';
import { query, Request } from 'express';
import { User } from '../user/user.entity';
import { IPaginationOptions, Pagination } from 'nestjs-typeorm-paginate';
import { SellerReportItem } from './seller-report-item.entity';
import * as dayjs from 'dayjs';

@ApiTags('Seller Reports Item')
@ApiBearerAuth()
@Controller('seller-reports-item')
export class SellerReportItemController {
  constructor(private readonly reportService: SellerReportItemService) {}

  @Get('paginate')
  async paginate(@Query() query: any): Promise<Pagination<SellerReportItem>> {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    return this.reportService.paginateReports({ page, limit });
  }

  @Post('generate-daily')
  async generateDailyReports() {
    await this.reportService.generateDailyReportsForAllSellers();
    return { message: '✅ Kunlik seller reportlar yaratildi!' };
  }
  @Get('orders-by-date-range')
  @ApiOperation({ summary: 'Report ID va kunlar oraliqi boyicha sotuvchi orderlarini olish' })
  @ApiQuery({ name: 'reportId', type: 'string', description: 'Report ID si' })
  @ApiQuery({ name: 'startDay', type: 'number', description: 'Boshlanish kuni (1-31)', example: 1, required: false })
  @ApiQuery({ name: 'endDay', type: 'number', description: 'Tugash kuni (1-31)', example: 31, required: false })
  @ApiQuery({ name: 'page', type: 'number', description: 'Sahifa raqami', example: 1, required: false })
  @ApiQuery({ name: 'limit', type: 'number', description: 'Har sahifada nechta element', example: 10, required: false })
  @ApiResponse({ status: 200, description: 'success' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getOrdersByDateRange(
    @Query('reportId') reportId: string,
    @Query('startDay') startDay?: number,
    @Query('endDay') endDay?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (!reportId) {
      throw new BadRequestException('reportId majburiy parametr');
    }

    if (startDay !== undefined && endDay !== undefined && startDay > endDay) {
      throw new BadRequestException("Boshlanish kuni tugash kunidan katta bo'lishi mumkin emas");
    }

    const pageNumber = page && page > 0 ? page : 1;
    const limitNumber = limit && limit > 0 ? Math.min(limit, 100) : 10;

    const options: IPaginationOptions = {
      page: pageNumber,
      limit: limitNumber,
    };

    return await this.reportService.getOrdersByDateRange(reportId, options, startDay, endDay);
  }

  @Get('sellers/stats')
  getSellerOrderStats(
    @Query('sellerId') sellerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportService.getSellerOrderStats(sellerId, startDate, endDate);
  }

  @Get('current')
  async getCurrent(@Req() req: Request) {
    const user = req['user'] as User;
    return this.reportService.getCurrentReport(user);
  }

  @Get()
  @ApiOperation({ summary: 'Get filtered seller report items with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'month', required: false, type: Number })
  async getFilteredReports(@Query() query: QueryReportItemDto, @Query('page') page = 1, @Query('limit') limit = 10) {
    const options: IPaginationOptions = {
      page,
      limit,
      route: '/seller-report-items',
    };

    return this.reportService.getReportsFiltered(query, options);
  }

  @Get('total')
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async totalReports(@Query() query: QueryReportItemDto) {
    return this.reportService.getTotalReports(query);
  }

  @Post('generate-and-link')
  async generateAndLinkReportsByYear() {
    return this.reportService.linkAllItemsToMonthlyReports();
  }

  @Post('recalculate-all')
  @ApiOperation({
    summary: 'Barcha seller report itemlarni qayta hisoblash',
    description: "Barcha seller report itemlarni 0 qilib, orderlar bo'yicha qayta hisoblaydi va bog'laydi",
  })
  @ApiResponse({
    status: 200,
    description: 'Muvaffaqiyatli qayta hisoblandi',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        processedOrders: { type: 'number' },
        updatedReportItems: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Server xatosi',
  })
  async recalculateAllReports() {
    try {
      const result = await this.reportService.recalculateAllSellerReportItems();
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Qayta hisoblashda xatolik yuz berdi',
        error: error.message,
      });
    }
  }
}
