import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Between, UpdateResult } from 'typeorm';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { KassaService } from './kassa.service';
import { Kassa } from './kassa.entity';
import { Route } from '../../infra/shared/decorators/route.decorator';
import { KassaQueryDto } from '../../infra/shared/dto';
import { CloseKassaDto, CreateKassaDto, UpdateKassaDto } from './dto';
import { Roles } from '../auth/decorators/roles.decorator';
import CloseKassaCronDto from '@modules/kassa/dto';
import { UserRoleEnum } from '@infra/shared/enum';

@ApiTags('Kassa')
@Controller('kassa')
export class KassaController {
  constructor(private readonly kassaService: KassaService) {}

  @Get('/')
  @ApiOperation({ summary: 'Method: returns all kassa' })
  @ApiOkResponse({
    description: 'The kassa were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getData(@Route() route: string, @Query() query: KassaQueryDto, @Req() req) {
    req.where?.total && delete req.where?.total;

    const year = query.year || new Date().getFullYear();
    if (query.year || query.month) {
      const startMonth = query.month ? query.month - 1 : 0;
      const endMonth = query.month ? query.month - 1 : 11;

      const startDate = new Date(year, startMonth, 1);
      const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59);

      req.where = { ...req.where, createdAt: Between(startDate, endDate) };
    }
    return await this.kassaService.getAll({ ...query, route }, req.where);
  }

  @Get('/open-kassa')
  @ApiOperation({ summary: 'Method: returns all open kassa' })
  @HttpCode(HttpStatus.OK)
  async getOpenKassas() {
    return await this.kassaService.closeAllPreviousMonthOpenKassas();
  }

  @Get('/warning-kassas')
  @ApiQuery({ name: 'filialId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiOperation({ summary: 'Method: returns all open kassa' })
  @HttpCode(HttpStatus.OK)
  async getWarningKassas(
    @Query('filialId') filialId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return await this.kassaService.getWarningKassas(filialId, { page, limit });
  }

  @Get('/archive/kassa/one/:id')
  @ApiOperation({ summary: 'Method: returns all kassa' })
  @ApiOkResponse({
    description: 'The kassa were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getKassa(@Param('id') id: string) {
    return await this.kassaService.getKassa(id);
  }

  @Get('/filial')
  @ApiOperation({ summary: 'Method: returns all kassa by fillial' })
  @ApiOkResponse({
    description: 'The kassa were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getFilialId(@Route() route: string, @Query() query: KassaQueryDto, @Req() req) {
    req.where?.total && delete req.where?.total;
    return await this.kassaService.getAllKassaByFIlialId({ ...query, route }, req.where);
  }

  @Roles(UserRoleEnum.F_MANAGER, UserRoleEnum.BOSS, UserRoleEnum.I_MANAGER)
  @Get('/report')
  @ApiOperation({ summary: 'Method: returns single kassa' })
  @ApiOkResponse({
    description: 'The kassa was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async alKassa(@Req() req, @Query() query): Promise<Kassa | unknown> {
    return await this.kassaService.getReport({ limit: query.limit || 50, page: query.page || 1 }, req.user, {
      startDate: query.startDate,
      endDate: query?.endDate,
      ...(query.year && { year: Number(query.year) }),
      ...(query.filial && { filial: { id: query.filial } }),
    });
  }

  @Get('/totals')
  @ApiOperation({ summary: 'Method: returns kassa totals by filial and year' })
  @ApiQuery({ name: 'filialId', required: true, type: String })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiOkResponse({ description: 'Kassa totals returned successfully' })
  @HttpCode(HttpStatus.OK)
  async getTotals(
    @Query('filialId') filialId: string,
    @Query('year') year: string,
    @Req() req,
  ) {
    const fId = filialId || req['user']?.filial?.id;
    if (!fId) return {};
    return this.kassaService.getReportTotals(fId, year ? +year : undefined);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Method: returns single kassa by id' })
  @ApiOkResponse({
    description: 'The kassa was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getMe(@Param('id') id: string): Promise<Kassa> {
    return await this.kassaService.getOne(id);
  }

  @Roles(
    UserRoleEnum.BOSS,
    UserRoleEnum.M_MANAGER,
    UserRoleEnum.W_MANAGER,
    UserRoleEnum.F_MANAGER,
    UserRoleEnum.DEALER,
    UserRoleEnum.I_MANAGER,
  )
  @Get('/open-kassa/:filialId')
  @ApiOperation({ summary: 'Method: returns single kassa' })
  @ApiOkResponse({
    description: 'The kassa was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async opnKassa(@Param('filialId') id: string, @Req() req): Promise<Kassa | unknown> {
    let kassa = await this.kassaService.GetOpenKassa(id, req.user.filial.type);
    console.log(req.user);

    if (!kassa || !kassa?.id) {
      await this.kassaService.create({ filial: id });

      kassa = await this.kassaService.GetOpenKassa(id, req.user.filial.type);
    }

    return kassa;
  }

  @Post('/')
  @ApiOperation({ summary: 'Method: creates new kassa' })
  @ApiCreatedResponse({
    description: 'The kassa was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreateKassaDto) {
    const check = await this.kassaService.create(data);
    console.log('check', check);

    if (!check) {
      throw new HttpException('First you Should close kassa', HttpStatus.BAD_REQUEST);
    } else {
      return check;
    }
  }

  @Roles(
    UserRoleEnum.BOSS,
    UserRoleEnum.M_MANAGER,
    UserRoleEnum.W_MANAGER,
    UserRoleEnum.F_MANAGER,
    UserRoleEnum.DEALER,
    UserRoleEnum.I_MANAGER,
  )
  @Patch('/close-kassa')
  @ApiOperation({ summary: 'Method: closing kassa' })
  @ApiOkResponse({
    description: 'Kassa was closed',
  })
  @HttpCode(HttpStatus.OK)
  async closeKassa(@Body() data: CloseKassaDto, @Req() req) {
    const user = req.user;
    if (!user?.filial?.id) {
      throw new BadRequestException("You don't have filial!");
    }

    if (![UserRoleEnum.F_MANAGER, UserRoleEnum.M_MANAGER].includes(req.user.position.role)) {
      throw new BadRequestException('You can not close kassa!');
    }

    const closedKassas = await this.kassaService.closeKassas(data.ids, req.user);
    if ([UserRoleEnum.F_MANAGER].includes(req.user.position.role)) {
      await this.kassaService.create({ filial: user.filial.id });
      await this.kassaService.moveKassaOrders(closedKassas);
    }
    return await this.kassaService.GetOpenKassa(req.user.filial.id);
  }

  @Roles(UserRoleEnum.F_MANAGER, UserRoleEnum.I_MANAGER)
  @Patch('/cancel-kassa')
  @ApiOperation({ summary: 'Method: closing kassa' })
  @ApiOkResponse({
    description: 'Kassa was closed',
  })
  @HttpCode(HttpStatus.OK)
  async cancelKassa(@Body() data: CloseKassaDto, @Req() req) {
    const user = req.user;
    if (!user?.filial?.id) {
      throw new BadRequestException("You don't have filial!");
    }

    if (![UserRoleEnum.F_MANAGER].includes(req.user.position.role)) {
      throw new BadRequestException('You can not close kassa!');
    }

    await this.kassaService.cancelKassas(data.ids, req.user);
    return await this.kassaService.GetOpenKassa(req.user.filial.id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Method: restore kassa' })
  @ApiOkResponse({
    description: 'Kassa was restored successfully',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async restore(@Param('id') id: string) {
    return await this.kassaService.restoreOne(id);
  }

  @Patch('correct-kassa-cron')
  @ApiOperation({ summary: 'Method: updating kassa' })
  @ApiOkResponse({
    description: 'Kassa was changed',
  })
  @HttpCode(HttpStatus.OK)
  async correctKassa(@Body() body: CloseKassaCronDto) {
    await this.kassaService.handleEndOfMonth(body.ids);
    return 'successfully changed!';
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Method: updating kassa' })
  @ApiOkResponse({
    description: 'Kassa was changed',
  })
  @HttpCode(HttpStatus.OK)
  async changeData(@Body() positionData: UpdateKassaDto, @Param('id') id: string): Promise<UpdateResult> {
    return await this.kassaService.change(positionData, id);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting kassa' })
  @ApiOkResponse({
    description: 'Kassa was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    return await this.kassaService.deleteOne(id);
  }

  @Post('bind-kassas-to-reports')
  async bindKassasToReports(): Promise<{ message: string }> {
    await this.kassaService.bindAllKassasToTheirReports();
    return { message: 'Kassas bound to reports' };
  }

  @Post('move-orders')
  @ApiBody({
    description: 'Move pending orders from old kassa to new kassa',
    schema: {
      example: {
        oldKassaId: '1a2b3c4d-5e6f-7890-abcd-ef0123456789',
        newKassaId: '9f8e7d6c-5b4a-3210-fedc-ba9876543210',
      },
    },
  })
  async moveOrders(@Body() body: { oldKassaId: string; newKassaId: string }) {
    return this.kassaService.transferPendingOrdersToNextMonthKassa(body.oldKassaId, body.newKassaId);
  }

  // ────────────────────────────────────────────────────────────────
  //  ENDPOINTS ABSORBED FROM kassa-report.controller
  // ────────────────────────────────────────────────────────────────

  @Get('monthly/by-filial')
  @ApiOperation({ summary: 'Method: get monthly kassa for the current user filial' })
  @ApiOkResponse({ description: 'Monthly kassa returned successfully' })
  @HttpCode(HttpStatus.OK)
  async getMonthlyKassa(@Req() req) {
    const user = req['user'];
    const now = new Date();
    return this.kassaService.getOrCreateKassaForFilial(
      user.filial.id,
      now.getFullYear(),
      now.getMonth() + 1,
    );
  }

  @Roles(UserRoleEnum.F_MANAGER, UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT)
  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm or reject monthly kassa (multi-step workflow)' })
  @ApiOkResponse({ description: 'Kassa status updated' })
  @HttpCode(HttpStatus.OK)
  async confirmKassa(
    @Param('id') id: string,
    @Query('action') action: 'confirm' | 'reject' = 'confirm',
    @Req() req,
  ) {
    return this.kassaService.closeKassa(id, req.user, action);
  }

  @Post('generate/:year')
  @ApiOperation({ summary: 'Method: generate monthly kassas for all filials for a given year' })
  @ApiCreatedResponse({ description: 'Monthly kassas created' })
  @HttpCode(HttpStatus.CREATED)
  async generateKassasByYear(@Param('year') year: string) {
    return this.kassaService.createKassasForFilialsByYear(Number(year));
  }
}
