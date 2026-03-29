import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PlanYearService } from './plan-year.service';
import { UpdatePlanYearDto } from './dto/update-plan-year.dto';
import CreatePlanYearDto from './dto/create-plan-year.dto';
import { PlanYear } from './plan-year.entity';
import * as dayjs from 'dayjs';

@ApiTags('Plan-year')
@Controller('plan-year')
export class PlanYearController {
  constructor(private readonly service: PlanYearService) {}

  // ========== GET (Simple First) ==========

  @Get()
  @ApiOperation({ summary: 'Barcha global PlanYearlarni olish' })
  findAll() {
    return this.service.findAll();
  }

  @Get('performance')
  @ApiOperation({ summary: 'Umumiy yil rejasining kunlik bajarilish korsatkichlari' })
  getPerformance() {
    return this.service.getPlanPerformance();
  }

  @Get('monthly-trend')
  @ApiOperation({ summary: 'Oylik pul oqimi trendi' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiOkResponse({ description: 'Current va previous month solishtirmasi' })
  getMonthlyProgress(@Query('year') year?: number, @Query('month') month?: number) {
    return this.service.calculateMonthlyProgress(year, month);
  }

  @Get('filial-plans')
  @ApiOperation({ summary: 'Barcha filial planlarini pagination bilan olish' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getAllFilialPlans(@Query('year') year?: number, @Query('page') page = 1, @Query('limit') limit = 10) {
    return this.service.getAllFilialPlans(year, { page, limit });
  }

  @Get('filial-plans/totals')
  @ApiOperation({ summary: 'Barcha filial planlar umumisini olish!' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  async getTotalFilialsPlans(@Query('year') year?: number) {
    const now = dayjs();
    return this.service.getTotalFilialsPlans(Number(year) || now.year());
  }

  @Get('sellers-get-all')
  @ApiOperation({ summary: 'SELLER foydalanuvchilarni olish (filialId, year, page, limit)' })
  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getSellersPaginated(
    @Query('filialId') filialId?: string,
    @Query('year') year?: number,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.service.getAllSellers(filialId, { page, limit }, year);
  }

  @Get('health-check')
  @ApiOperation({ summary: "Service sog'ligini tekshirish" })
  async healthCheck() {
    const currentYear = new Date().getFullYear();
    const globalPlans = await this.service.findAll();

    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      currentYear,
      globalPlansCount: globalPlans.length,
      message: 'PlanYear service is working properly',
    };
  }

  // 🔥 YANGI: Cascading CollectedAmount Endpoints
  @Get('recalculate-all')
  @ApiOperation({
    summary: "Barcha CollectedAmount larni to'g'ri qayta hisoblash",
    description: 'Sellerlar → Filiallar → Global tartibida cascade update',
  })
  @ApiQuery({ name: 'year', required: false, type: Number })
  async recalculateAllCollectedAmounts(@Query('year') year?: number) {
    const result = await this.service.recalculateAllCollectedAmounts(year);
    return {
      message: 'All collected amounts successfully recalculated',
      ...result,
    };
  }

  @Get('update-seller-collected/:sellerId')
  @ApiOperation({
    summary: 'Seller CollectedAmount ni yangilash va cascade qilish',
    description: 'SellerReportItem lardan hisoblaydi va filial/globalga tarqatadi',
  })
  @ApiParam({ name: 'sellerId', required: true })
  @ApiQuery({ name: 'year', required: false, type: Number })
  async updateSellerCollectedAmount(@Param('sellerId') sellerId: string, @Query('year') year?: number) {
    await this.service.updateSellerCollectedAmount(sellerId, year);
    return {
      message: 'Seller collected amount updated and cascaded successfully',
      sellerId,
      year: year || new Date().getFullYear(),
    };
  }

  @Get('by-filial/:filialId')
  @ApiOperation({ summary: 'Filial boyicha barcha yillik planlar' })
  @ApiParam({ name: 'filialId', required: true })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getPlansByFilial(@Param('filialId') filialId: string, @Query('year') year?: number): Promise<PlanYear[]> {
    return this.service.getFilialPlans(filialId, year);
  }

  @Get('filial-plans/:id')
  @ApiOperation({ summary: 'ID orqali bitta filial PlanYearni olish (filial bilan)' })
  getFilialPlanById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Get('by-id/:id')
  @ApiOperation({ summary: 'Universal PlanYear ni ID orqali olish' })
  getPlanById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'ID orqali umumiy PlanYear yozuvini olish' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // ========== PATCH ==========

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Umumiy PlanYear yozuvini tiklash' })
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }

  @Patch('filial-plans-restore/:id')
  @ApiOperation({ summary: 'ID orqali bitta filial PlanYearni tiklash' })
  restoreFilialPlans(@Param('id') id: string) {
    return this.service.restoreById(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: "Universal PlanYear yangilash - Avtomatik ierarxik o'zgarishlar bilan",
    description: 'PLANYEAR → filiallar, FILIAL → global+sellerlar, USER → filial+global',
  })
  update(@Param('id') id: string, @Body() dto: UpdatePlanYearDto) {
    return this.service.update(id, dto);
  }

  // ========== POST ==========

  @Post()
  @ApiOperation({ summary: 'Yangi global PlanYear yaratish' })
  create(@Body() dto: CreatePlanYearDto) {
    return this.service.create(dto);
  }

  @Post('create-for-all-filials')
  @ApiOperation({ summary: 'Hamma filiallar uchun PlanYear larni yaratish' })
  createForAllFilials() {
    return this.service.createForAllFilials();
  }

  @Post('create-for-all-sellers')
  @ApiOperation({ summary: 'Hamma sellerlarga PlanYear lar yaratish' })
  createForAllSellers() {
    return this.service.createForAllSellers();
  }

  @Post('redistribute-seller/:userId')
  @ApiOperation({
    summary: 'Seller planini boshqa sellerlarga qayta taqsimlash',
    description: 'Berilgan sellerning qolgan rejasini boshqalarga proporsional taqsimlaydi',
  })
  redistributeSellerPlan(@Param('userId') userId: string) {
    return this.service.redistributeSellerPlan(userId).then((result) => ({
      success: result,
      message: result ? 'Plan muvaffaqiyatli qayta taqsimlandi' : 'Seller plan topilmadi',
    }));
  }

  // ========== DELETE ==========

  @Delete(':id')
  @ApiOperation({ summary: 'Umumiy PlanYear yozuvini ochirish' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Delete('filial-plans/:id')
  @ApiOperation({ summary: 'ID orqali bitta filial PlanYearni ochirish' })
  deleteFilialPlanById(@Param('id') id: string) {
    return this.service.deleteById(id);
  }
}
