import { Controller, Get, Post, Query } from '@nestjs/common';
import { CollectionReportService } from './collection-report-item.service';
import { FilterCollectionReportDto, FilterMonthlyReportDto } from './dto/filter-collection-report.dto';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Collection-report')
@Controller('collection-report')
export class CollectionReportController {
  constructor(private readonly service: CollectionReportService) {}

  @Get()
  @ApiOperation({
    summary: 'Umumiy hisobotlar olish',
    description: "Belgilangan sana oralig'ida collection bo'yicha sotuv va ombor hisobotlarini olish",
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Boshlanish sanasi (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Tugash sanasi (YYYY-MM-DD)' })
  @ApiQuery({ name: 'filialId', required: false, type: Number, description: 'Filial ID' })
  @ApiQuery({ name: 'collectionId', required: false, type: Number, description: 'Collection ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Sahifa raqami' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Bir sahifadagi elementlar soni' })
  @ApiResponse({ status: 200, description: 'Hisobotlar muvaffaqiyatli qaytarildi' })
  @ApiResponse({ status: 400, description: "Noto'g'ri so'rov parametrlari" })
  async findAllReports(@Query() dto: FilterCollectionReportDto) {
    return this.service.findAllReports(dto);
  }

  @Get('monthly')
  @ApiOperation({
    summary: 'Oylik hisobotlar olish',
    description: "Belgilangan oy uchun collection bo'yicha sotuv va ombor hisobotlarini olish",
  })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2025, description: 'Yil' })
  @ApiQuery({ name: 'month', required: false, type: Number, example: 8, description: 'Oy (1-12)' })
  @ApiQuery({ name: 'filialId', required: false, type: Number, description: 'Filial ID' })
  @ApiQuery({ name: 'collectionId', required: false, type: Number, description: 'Collection ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Sahifa raqami' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Bir sahifadagi elementlar soni' })
  @ApiQuery({ name: 'factory', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Oylik hisobotlar muvaffaqiyatli qaytarildi' })
  @ApiResponse({ status: 400, description: "Noto'g'ri oy yoki yil parametri" })
  async findMonthlyReports(@Query() dto: FilterMonthlyReportDto) {
    return this.service.getCollections(Number(dto?.page || 1), Number(dto?.limit || 10), dto.filialId, dto.factory, dto.country, dto.month, dto.year);
  }

  @Get('order/monthly')
  @ApiOperation({
    summary: 'Oylik hisobotlar olish',
    description: "Belgilangan oy uchun collection bo'yicha sotuv va ombor hisobotlarini olish",
  })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2025, description: 'Yil' })
  @ApiQuery({ name: 'month', required: false, type: Number, example: 8, description: 'Oy (1-12)' })
  @ApiQuery({ name: 'filialId', required: false, type: String, description: 'Filial ID' })
  @ApiQuery({ name: 'collectionId', required: false, type: String, description: 'Collection ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Sahifa raqami' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Bir sahifadagi elementlar soni' })
  @ApiQuery({ name: 'factory', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Oylik hisobotlar muvaffaqiyatli qaytarildi' })
  @ApiResponse({ status: 400, description: "Noto'g'ri oy yoki yil parametri" })
  async findMonthlyOrderReports(@Query() dto: FilterMonthlyReportDto) {
    return this.service.getCollectionsOrder(Number(dto?.page || 1), Number(dto?.limit || 10), dto.filialId, dto.factory, dto.country, dto.month, dto.year);
  }

  @Post('seed-history')
  @ApiOperation({
    summary: 'Tarixiy hisobotlarni generatsiya qilish',
    description: "Order va Product transactionlari bo'yicha barcha tarixiy hisobotlarni qayta generatsiya qilish",
  })
  @ApiResponse({ status: 201, description: 'Tarixiy hisobotlar muvaffaqiyatli generatsiya qilindi' })
  @ApiResponse({ status: 500, description: 'Server xatosi' })
  async seedHistorical() {
    await this.service.seedHistorical();
    return {
      message: 'Tarixiy hisobotlar muvaffaqiyatli generatsiya qilindi',
      success: true,
    };
  }
}
