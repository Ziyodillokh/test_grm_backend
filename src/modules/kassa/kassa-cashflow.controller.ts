import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Cashflow } from '../cashflow/cashflow.entity';
import { Order } from '../order/order.entity';
import { Kassa } from './kassa.entity';
import { CashFlowEnum, CashflowStatusEnum, OrderEnum } from '../../infra/shared/enum';

@ApiTags('Kassa Cashflow')
@Controller()
export class KassaCashflowController {
  constructor(
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Kassa)
    private readonly kassaRepository: Repository<Kassa>,
  ) {}

  // ────────────────────────────────────────────────────────────────
  //  1. GET /kassa/:kassaId/cashflows
  //     Paginated list of all cashflows for a specific kassa
  // ────────────────────────────────────────────────────────────────
  @Get('kassa/:kassaId/cashflows')
  @ApiOperation({ summary: 'Get all cashflows for a specific kassa (paginated, filterable)' })
  @ApiOkResponse({ description: 'Cashflows returned successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'all'], example: 'all' })
  @ApiQuery({ name: 'type', required: false, enum: ['income', 'expense', 'all'], example: 'all' })
  @HttpCode(HttpStatus.OK)
  async getCashflowsByKassa(
    @Param('kassaId') kassaId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status', new DefaultValuePipe('all')) status: string,
    @Query('type', new DefaultValuePipe('all')) type: string,
  ) {
    const kassa = await this.kassaRepository.findOne({ where: { id: kassaId } });
    if (!kassa) {
      throw new BadRequestException('Kassa not found');
    }

    const qb = this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoinAndSelect('cashflow.cashflow_type', 'cashflow_type')
      .leftJoinAndSelect('cashflow.createdBy', 'createdBy')
      .leftJoinAndSelect('cashflow.order', 'order')
      .where('cashflow.kassaId = :kassaId', { kassaId });

    // Filter by status
    if (status === 'pending') {
      qb.andWhere('cashflow.status = :status', { status: CashflowStatusEnum.PENDING });
    } else if (status === 'approved') {
      qb.andWhere('cashflow.status = :status', { status: CashflowStatusEnum.APPROVED });
    }
    // 'all' -> no status filter

    // Filter by type (income / expense)
    if (type === 'income') {
      qb.andWhere('cashflow.type = :type', { type: CashFlowEnum.InCome });
    } else if (type === 'expense') {
      qb.andWhere('cashflow.type = :type', { type: CashFlowEnum.Consumption });
    }
    // 'all' -> no type filter

    qb.orderBy('cashflow.date', 'DESC');

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [items, totalItems] = await qb.getManyAndCount();

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: items.map((cf) => ({
        ...cf,
        isOrderRelated: !!cf.order,
      })),
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  // ────────────────────────────────────────────────────────────────
  //  2. PATCH /cashflow/approve/:id
  //     Approve a pending cashflow and update kassa balances
  // ────────────────────────────────────────────────────────────────
  @Patch('cashflow/approve/:id')
  @ApiOperation({ summary: 'Approve a pending cashflow and update kassa balances' })
  @ApiOkResponse({ description: 'Cashflow approved successfully' })
  @HttpCode(HttpStatus.OK)
  async approveCashflow(@Param('id') id: string) {
    const cashflow = await this.cashflowRepository.findOne({
      where: { id },
      relations: ['kassa', 'order'],
    });

    if (!cashflow) {
      throw new BadRequestException('Cashflow not found');
    }

    if (cashflow.status !== CashflowStatusEnum.PENDING) {
      throw new BadRequestException(`Cashflow is not pending. Current status: ${cashflow.status}`);
    }

    // 1) Set cashflow status to approved
    cashflow.status = CashflowStatusEnum.APPROVED;
    await this.cashflowRepository.save(cashflow);

    // 2) If cashflow has an order, set order status to accepted
    if (cashflow.order) {
      cashflow.order.status = OrderEnum.Accept;
      await this.orderRepository.save(cashflow.order);
    }

    // 3) Update kassa balances
    if (cashflow.kassa) {
      const kassa = await this.kassaRepository.findOne({
        where: { id: cashflow.kassa.id },
      });

      if (kassa) {
        const price = Number(cashflow.price) || 0;

        if (cashflow.type === CashFlowEnum.InCome) {
          kassa.in_hand += price;
          kassa.income += price;
        } else if (cashflow.type === CashFlowEnum.Consumption) {
          kassa.in_hand -= price;
          kassa.expense += price;
        }

        await this.kassaRepository.save(kassa);
      }
    }

    // Return updated cashflow with relations
    return this.cashflowRepository.findOne({
      where: { id },
      relations: ['kassa', 'order', 'cashflow_type', 'createdBy'],
    });
  }

  // ────────────────────────────────────────────────────────────────
  //  3. GET /kassa/:kassaId/cashflows/summary
  //     Summary totals for a kassa's cashflows
  // ────────────────────────────────────────────────────────────────
  @Get('kassa/:kassaId/cashflows/summary')
  @ApiOperation({ summary: 'Get cashflow summary totals for a specific kassa' })
  @ApiOkResponse({ description: 'Cashflow summary returned successfully' })
  @HttpCode(HttpStatus.OK)
  async getCashflowSummary(@Param('kassaId') kassaId: string) {
    const kassa = await this.kassaRepository.findOne({ where: { id: kassaId } });
    if (!kassa) {
      throw new BadRequestException('Kassa not found');
    }

    // Total approved income
    const incomeResult = await this.cashflowRepository
      .createQueryBuilder('cashflow')
      .select('COALESCE(SUM(cashflow.price), 0)', 'total')
      .where('cashflow.kassaId = :kassaId', { kassaId })
      .andWhere('cashflow.status = :status', { status: CashflowStatusEnum.APPROVED })
      .andWhere('cashflow.type = :type', { type: CashFlowEnum.InCome })
      .getRawOne();

    // Total approved expense
    const expenseResult = await this.cashflowRepository
      .createQueryBuilder('cashflow')
      .select('COALESCE(SUM(cashflow.price), 0)', 'total')
      .where('cashflow.kassaId = :kassaId', { kassaId })
      .andWhere('cashflow.status = :status', { status: CashflowStatusEnum.APPROVED })
      .andWhere('cashflow.type = :type', { type: CashFlowEnum.Consumption })
      .getRawOne();

    // Pending count
    const pendingCount = await this.cashflowRepository
      .createQueryBuilder('cashflow')
      .where('cashflow.kassaId = :kassaId', { kassaId })
      .andWhere('cashflow.status = :status', { status: CashflowStatusEnum.PENDING })
      .getCount();

    const totalIncome = parseFloat(incomeResult?.total) || 0;
    const totalExpense = parseFloat(expenseResult?.total) || 0;
    const netBalance = totalIncome - totalExpense;

    return {
      totalIncome,
      totalExpense,
      pendingCount,
      netBalance,
    };
  }
}
