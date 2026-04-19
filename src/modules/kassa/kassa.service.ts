import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import {
  Between,
  DataSource,
  EntityManager,
  Equal,
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import { Kassa } from './kassa.entity';
import { CreateKassaDto, UpdateKassaDto } from './dto';
import { FilialService } from '../filial/filial.service';
import { ActionService } from '../action/action.service';
import FilialType from '../../infra/shared/enum/filial-type.enum';
import * as dayjs from 'dayjs';
import { CashFlowEnum, FilialTypeEnum, OrderEnum, UserRoleEnum } from '../../infra/shared/enum';
import { User } from '../user/user.entity';
import { ReportService } from '../report/report.service';
import { Report } from '../report/report.entity';
import { Order } from '../order/order.entity';
import { Filial } from '../filial/filial.entity';
import KassaProgresEnum from '@infra/shared/enum/kassa-progres-enum';
import KassaReportProgresEnum from '../../infra/shared/enum/kassa-report-progres.enum';
import { Cashflow } from '@modules/cashflow/cashflow.entity';
import CashflowTipEnum from '../../infra/shared/enum/cashflow/cashflow-tip.enum';
import { CashflowType } from '@modules/cashflow-type/cashflow-type.entity';

@Injectable()
export class KassaService {
  constructor(
    @InjectRepository(Kassa)
    private readonly kassaRepository: Repository<Kassa>,
    @InjectRepository(Filial)
    private readonly filialRepository: Repository<Filial>,
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CashflowType)
    private readonly cashflowTypeRepository: Repository<CashflowType>,
    private readonly actionService: ActionService,
    @Inject(forwardRef(() => FilialService))
    private readonly filialService: FilialService,
    @Inject(forwardRef(() => ReportService))
    private readonly reportService: ReportService,
    private readonly entityManager: EntityManager,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  // ────────────────────────────────────────────────────────────────
  //  EXISTING METHODS (unchanged or updated to remove kassaReport)
  // ────────────────────────────────────────────────────────────────

  async getAll(options: IPaginationOptions, where?: FindOptionsWhere<Kassa>): Promise<Pagination<Kassa>> {
    return await paginate<Kassa>(this.kassaRepository, options, {
      where,
      relations: {
        filial: true,
        closer: {
          avatar: true,
        },
        closer_m: {
          avatar: true,
        },
      },
      order: {
        month: 'DESC',
        endDate: 'DESC',
      },
    });
  }

  async getReport(options: IPaginationOptions, user, where) {
    const filialId = where.filial?.id || (!where.report?.id ? user?.filial?.id : undefined);

    const queryWhere: any = {
      ...(where.year && { year: where.year }),
      ...(filialId && { filial: { id: filialId } }),
      ...(where.report?.id && { report: { id: where.report.id } }),
    };

    return paginate<Kassa>(this.kassaRepository, options, {
      relations: {
        filial: {
          users: { position: true },
          manager: { position: true },
        },
        report: true,
      },
      where: queryWhere,
      order: { year: 'DESC', month: 'DESC' },
    });
  }

  async getReportTotals(filialId: string, year?: number) {
    const kassas = await this.kassaRepository.find({
      where: {
        filial: { id: filialId },
        ...(year && { year }),
      },
    });

    return kassas.reduce(
      (acc, k) => ({
        totalIncome: acc.totalIncome + (k.income || 0),
        income: acc.income + (k.income || 0),
        totalSale: acc.totalSale + (k.sale || 0),
        sale: acc.sale + (k.sale || 0),
        totalPlasticSum: acc.totalPlasticSum + (k.plasticSum || 0),
        plasticSum: acc.plasticSum + (k.plasticSum || 0),
        additionalProfitTotalSum: acc.additionalProfitTotalSum + (k.additionalProfitTotalSum || 0),
        totalExpense: acc.totalExpense + (k.expense || 0),
        expense: acc.expense + (k.expense || 0),
        totalSaleReturn: acc.totalSaleReturn + (k.return_sale || 0),
        return_sale: acc.return_sale + (k.return_sale || 0),
        totalCashCollection: acc.totalCashCollection + (k.cash_collection || 0),
        cash_collection: acc.cash_collection + (k.cash_collection || 0),
        totalDiscount: acc.totalDiscount + (k.discount || 0),
        discount: acc.discount + (k.discount || 0),
        in_hand: acc.in_hand + (k.in_hand || 0),
        debt_sum: acc.debt_sum + (k.debt_sum || 0),
        totalSize: acc.totalSize + (k.totalSize || 0),
      }),
      {
        totalIncome: 0, income: 0, totalSale: 0, sale: 0,
        totalPlasticSum: 0, plasticSum: 0, additionalProfitTotalSum: 0,
        totalExpense: 0, expense: 0, totalSaleReturn: 0, return_sale: 0,
        totalCashCollection: 0, cash_collection: 0, totalDiscount: 0,
        discount: 0, in_hand: 0, debt_sum: 0, totalSize: 0,
      },
    );
  }

  async getById(id: string, for_warning: boolean = false) {
    return await this.kassaRepository
      .findOne({
        where: {
          id,
          ...(for_warning && { status: KassaProgresEnum.WARNING }),
        },
        relations: { filial: true, cashflow: true, report: true },
      })
      .catch(() => {
        throw new NotFoundException(`Kassa not found. for_warning: ${for_warning}`);
      });
  }

  async getOne(id: string) {
    return await this.kassaRepository
      .findOne({
        where: { id },
        relations: {
          filial: true,
          orders: true,
          report: true,
        },
      })
      .catch(() => {
        throw new NotFoundException('data not found');
      });
  }

  async GetOpenKassa(id: string, type?: FilialType) {
    // Avval OPEN statusli kassani qidirish (joriy oy)
    const openKassa = await this.kassaRepository.findOne({
      where: { filial: { id, type: type || FilialType.FILIAL }, isActive: true, status: KassaProgresEnum.OPEN },
      relations: { report: true },
      order: { month: 'DESC', year: 'DESC' },
    });
    if (openKassa) return openKassa;

    // OPEN topilmasa, isActive bo'lgan eng yangi kassani qaytarish
    return await this.kassaRepository.findOne({
      where: { filial: { id, type: type || FilialType.FILIAL }, isActive: true },
      relations: { report: true },
      order: { month: 'DESC', year: 'DESC' },
    });
  }

  async getKassa(id: string) {
    return await this.kassaRepository.findOne({
      relations: {
        orders: {
          seller: true,
          createdBy: true,
          product: {
            bar_code: {
              model: true,
              collection: true,
              color: true,
            },
            filial: true,
          },
        },
        cashflow: {
          createdBy: true,
        },
        filial: true,
      },
      where: { id, filial: { type: FilialType.FILIAL } },
    });
  }

  async closeKassas(ids: string[], user) {
    const roleStatusMap = {
      [UserRoleEnum.F_MANAGER]: KassaProgresEnum.ACCEPTED,
    };

    const userRole = user.position.role;
    const status = roleStatusMap[userRole];
    const endDate = new Date();

    if (!status) {
      throw new BadRequestException('You cannot close kassa!');
    }

    for (const id of ids) {
      const kassa = await this.kassaRepository.findOne({
        where: { id },
        relations: { filial: true },
      });

      if (!kassa) continue;

      if (userRole === UserRoleEnum.F_MANAGER) {
        await this.kassaRepository.update({ id: kassa.id }, {
          isActive: false,
          status: KassaProgresEnum.ACCEPTED,
          endDate,
          closer_m: user.id,
          closer: user.id,
        });
      }
    }

    return await this.kassaRepository.find({ where: { id: In(ids) }, relations: { filial: true } });
  }

  async cancelKassas(ids: string[], user) {
    // Reject endi boolean flag orqali boshqariladi, status WARNING ga qaytadi
    const updatePromises = ids.map((id) =>
      this.kassaRepository.update(id, {
        status: KassaProgresEnum.WARNING,
        closer_m: user.id,
      }),
    );
    return Promise.allSettled(updatePromises);
  }

  async deleteOne(id: string) {
    return await this.kassaRepository.softDelete(id).catch(() => {
      throw new NotFoundException('data not found');
    });
  }

  async restoreOne(id: string) {
    return await this.kassaRepository.restore(id).catch(() => {
      throw new NotFoundException('data not found');
    });
  }

  async rejectKassa(ids: string[], user: User) {
    // Reject endi boolean flag orqali, status WARNING ga qaytadi
    return await Promise.allSettled(
      ids.map((id) => {
        return this.kassaRepository.update(id, {
          status: KassaProgresEnum.WARNING,
        });
      }),
    );
  }

  async change(value: UpdateKassaDto, id: string) {
    return await this.kassaRepository
      .createQueryBuilder()
      .update()
      .set(value as unknown as Kassa)
      .where('id = :id', { id })
      .execute();
  }

  async create(value: CreateKassaDto): Promise<Kassa> {
    // First check if there's an open kassa for the branch
    const existingKassa = await this.getById(value.filial, false);
    if (existingKassa) {
      return existingKassa;
    }

    const year = value.year || new Date().getFullYear();
    const month = value.month || new Date().getMonth() + 1;

    // Get or create the Report for this filial/year/month
    const filial = await this.filialRepository.findOne({ where: { id: value.filial } });
    let report: Report = null;
    if (filial) {
      report = await this.reportService.findOneByYearMonthAndFilialType(year, month, filial.type);
    }

    const newKassa = this.kassaRepository.create({
      filial: { id: value.filial },
      year,
      month,
      report: report || undefined,
    });

    return this.kassaRepository.save(newKassa);
  }

  async getAllKassaByFIlialId(options: IPaginationOptions, where?: FindOptionsWhere<Kassa>): Promise<Pagination<Kassa>> {
    return await paginate<Kassa>(this.kassaRepository, options, {
      where,
      relations: {
        filial: true,
      },
      order: {
        endDate: 'DESC',
      },
    });
  }

  async clearInactiveKassas(): Promise<void> {
    const now = dayjs();
    const currentMonth = now.month() + 1;
    const currentYear = now.year();

    const kassas = await this.kassaRepository.find({
      relations: ['cashflow', 'filial'],
    });
    for (const kassa of kassas) {
      const kassaMonth = dayjs(kassa.startDate).month() + 1;
      const kassaYear = dayjs(kassa.startDate).year();

      // Faqat avvalgi oylar kassasini ko'rib chiqamiz
      if (kassaYear === currentYear && kassaMonth === currentMonth) continue;

      const cashflowCount = Array.isArray(kassa.cashflow) ? kassa.cashflow.length : 0;

      if (cashflowCount === 0) {
        await this.kassaRepository.delete(kassa.id);
      }
    }
  }

  async deactivateKassas(kassas: Kassa[], endDate: Date): Promise<void> {
    await this.closeAllPreviousMonthOpenKassas();

    await Promise.all(
      kassas.map((kassa) =>
        this.kassaRepository.update(kassa.id, {
          isActive: false,
          endDate,
        }),
      ),
    );
  }

  async openNewKassas(startDateStr: string): Promise<void> {
    const filials = await this.filialRepository.find({ where: { isActive: true, type: FilialType.FILIAL } });

    for (const filial of filials) {
      const year = new Date(startDateStr).getFullYear();
      const month = new Date(startDateStr).getMonth() + 1;
      const report = await this.reportService.findOneByYearMonthAndFilialType(year, month, filial.type);

      const newKassa = this.kassaRepository.create({
        filial: { id: filial.id },
        year,
        month,
        report: report || undefined,
        isActive: true,
        startDate: startDateStr,
      });
      await this.kassaRepository.save(newKassa);
    }
  }

  async updateReports(kassas: Kassa[]): Promise<void> {
    await Promise.all(kassas.map((kassa) => this.changeValueReport(kassa)));
  }

  async findKassasByFilial(filialId: string): Promise<Kassa[]> {
    return this.kassaRepository.find({
      where: {
        filial: { id: filialId },
        status: KassaProgresEnum.ACCEPTED,
      },
      relations: ['filial'],
    });
  }

  async bindAllKassasToTheirReports(): Promise<void> {
    const kassas = await this.kassaRepository.find({
      relations: ['filial', 'report'],
    });

    for (const kassa of kassas) {
      if (!kassa.filial || !kassa.startDate) continue;

      const year = kassa.startDate.getFullYear();
      const month = kassa.startDate.getMonth() + 1;

      const report = await this.reportRepo.findOne({
        where: {
          filial: { id: kassa.filial.id },
          year,
          month,
        },
      });

      if (!report) {
        console.warn(`Report not found: filialId=${kassa.filial.id}, year=${year}, month=${month}`);
        continue;
      }

      if (kassa.report && kassa.report.id === report.id) {
        continue;
      }

      kassa.report = report;
      // Also sync year/month on the kassa
      kassa.year = year;
      kassa.month = month;
      await this.kassaRepository.save(kassa);
    }
  }

  async closeAllPreviousMonthOpenKassas(): Promise<void> {
    const previousMonthStart = dayjs().subtract(1, 'month').startOf('month').toDate();
    const previousMonthEnd = dayjs().subtract(1, 'month').endOf('month').toDate();

    const kassas = await this.kassaRepository.find({
      where: {
        status: KassaProgresEnum.OPEN,
        startDate: Between(previousMonthStart, previousMonthEnd),
      },
    });

    for (const kassa of kassas) {
      kassa.status = KassaProgresEnum.CLOSED;
    }

    await this.kassaRepository.save(kassas);
  }

  async getAllActiveKassa() {
    return await this.kassaRepository.find({ where: { isActive: true } });
  }

  async transferPendingOrdersToNextMonthKassa(oldKassaId: string, newKassaId: string): Promise<void> {
    const oldKassa = await this.kassaRepository.findOne({
      where: { id: oldKassaId },
      relations: ['orders'],
    });

    const newKassa = await this.kassaRepository.findOne({
      where: { id: newKassaId },
    });

    if (!oldKassa || !newKassa) {
      throw new NotFoundException('Kassa not found');
    }

    const progressOrders = oldKassa.orders.filter((order) => order.status === OrderEnum.Progress);

    for (const order of progressOrders) {
      order.kassa = newKassa;
      await this.orderRepository.save(order);
    }
  }

  async getOpenKassaByFilialId(filialId: string): Promise<Kassa | null> {
    const now = dayjs();
    const startOfMonth = now.startOf('month').toDate();
    const endOfMonth = now.endOf('month').toDate();

    return this.kassaRepository.findOne({
      where: {
        filial: { id: filialId },
        status: KassaProgresEnum.OPEN,
        startDate: Between(startOfMonth, endOfMonth),
      },
      order: { startDate: 'DESC' },
    });
  }

  async moveKassaOrders(kassas: Kassa[]) {
    for (const kassa of kassas) {
      const kassaOld = await this.kassaRepository.findOne({
        where: { id: kassa.id },
        relations: { filial: true },
      });

      if (!kassaOld?.filial) continue;

      const openKassa = await this.GetOpenKassa(kassaOld.filial.id);
      if (!openKassa) continue;

      await this.orderRepository.update(
        {
          kassa: { id: kassaOld.id },
          status: OrderEnum.Progress,
        },
        { kassa: { id: openKassa.id } },
      );
    }
  }

  async getWarningKassas(id: string, options: IPaginationOptions) {
    const kassas = await paginate(this.kassaRepository, options, {
      where: {
        status: In([KassaProgresEnum.WARNING, KassaProgresEnum.OPEN]),
        filial: { id },
      },
      order: {
        startDate: 'DESC',
      },
    });
    const have_warning_kassa = kassas.items.find(el => el.status === KassaProgresEnum.WARNING);
    return have_warning_kassa ? kassas : {
      items: [],
      meta: { totalItems: 0, itemCount: 0, totalPages: 0, currentPage: 0, itemsPerPage: 0 },
    };
  }

  async handleEndOfMonth(kassa_ids?: string[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const kassaRepo = queryRunner.manager.getRepository(Kassa);
      const cashflowRepo = queryRunner.manager.getRepository(Cashflow);
      const orderRepo = queryRunner.manager.getRepository(Order);

      const activeKassas = await kassaRepo.find({
        where: {
          ...(kassa_ids?.length && { id: In(kassa_ids) }),
          isActive: true,
          status: KassaProgresEnum.OPEN,
        },
        relations: ['filial'],
      });
      const today = dayjs();

      for (const kassa of activeKassas) {
        // Skip kassas without filial (orphaned data)
        if (!kassa.filial) {
          continue;
        }

        const kassaDate = dayjs(kassa.startDate);
        const kassaEndDate = dayjs(kassa.startDate).endOf('month').hour(23).minute(0).second(0).millisecond(0);
        const nextMonthStart = kassaDate.add(1, 'month').startOf('month').toDate();

        // Only skip if kassa is from a FUTURE month (shouldn't happen, but safety check)
        if (kassaDate.isAfter(today, 'month')) {
          continue;
        }

        const cashflowCount = await cashflowRepo.count({ where: { kassa: { id: kassa.id } } });

        const nextMonth = nextMonthStart.getMonth() + 1;
        const nextYear = dayjs(nextMonthStart).year();

        // Find existing kassas for next month for this filial
        const existingNextMonthKassas = await kassaRepo.find({
          where: {
            filial: { id: kassa.filial.id },
            year: nextYear,
            month: nextMonth,
          },
        });

        if (cashflowCount > 0 || existingNextMonthKassas.length < 2) {
          // Close current kassa with WARNING status
          kassa.endDate = kassaEndDate.toDate();
          kassa.isActive = false;
          kassa.status = KassaProgresEnum.WARNING;
          await kassaRepo.save(kassa);

          // Create new kassa for next month
          const report = await this.reportRepo.findOne({
            where: {
              filial: { id: kassa.filial.id },
              year: nextYear,
              month: nextMonth,
            },
          });

          const newKassa = kassaRepo.create({
            filial: kassa.filial,
            startDate: nextMonthStart,
            isActive: true,
            status: KassaProgresEnum.OPEN,
            year: nextYear,
            month: nextMonth,
            filialType: kassa.filialType,
            report: report || undefined,
          });
          await kassaRepo.save(newKassa);

          // Move unaccepted orders
          const pendingOrders = await orderRepo.find({
            where: { kassa: { id: kassa.id }, status: OrderEnum.Progress },
          });
          for (const order of pendingOrders) {
            order.kassa = newKassa;
            await orderRepo.save(order);
          }

        } else {
          // No cashflows -> just shift startDate to next month
          kassa.startDate = nextMonthStart;
          kassa.year = nextYear;
          kassa.month = nextMonth;

          const report = await this.reportRepo.findOne({
            where: {
              filial: { id: kassa.filial.id },
              year: nextYear,
              month: nextMonth,
            },
          });
          if (report) {
            kassa.report = report;
          }

          await kassaRepo.save(kassa);
        }
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Error in Kassa Cron', err);
    } finally {
      await queryRunner.release();
    }
  }

  // ────────────────────────────────────────────────────────────────
  //  METHODS ABSORBED FROM KassaReportService
  // ────────────────────────────────────────────────────────────────

  /**
   * Gets or creates a monthly Kassa for a given filial.
   * Replaces KassaReportService logic — Kassa now holds year/month directly.
   */
  async getOrCreateKassaForFilial(filialId: string, year: number, month: number): Promise<Kassa> {
    let kassa = await this.kassaRepository.findOne({
      where: {
        filial: { id: filialId },
        year,
        month,
      },
      relations: ['filial', 'report'],
    });

    if (kassa) return kassa;

    const filial = await this.filialRepository.findOne({ where: { id: filialId } });
    if (!filial) {
      throw new NotFoundException(`Filial ${filialId} not found`);
    }

    const report = await this.reportService.findOneByYearMonthAndFilialType(year, month, filial.type);

    kassa = this.kassaRepository.create({
      filial,
      year,
      month,
      report: report || undefined,
      filialType: filial.type,
    });

    return this.kassaRepository.save(kassa);
  }

  /**
   * Creates kassas for ALL dealer filials for the given month/year,
   * linking each to the global dealer report for that period.
   * Skips dealers that already have a kassa for that month.
   */
  async ensureDealerKassasForMonth(year: number, month: number): Promise<void> {
    const dealers = await this.filialRepository.find({
      where: { type: FilialType.DEALER, isDeleted: false },
    });

    const report = await this.reportService.findOneByYearMonthAndFilialType(
      year, month, FilialType.DEALER as unknown as FilialTypeEnum,
    );

    for (const dealer of dealers) {
      const exists = await this.kassaRepository.findOne({
        where: { filial: { id: dealer.id }, year, month },
      });
      if (exists) {
        if (!exists.report && report) {
          exists.report = report;
          await this.kassaRepository.save(exists);
        }
        continue;
      }

      const kassa = this.kassaRepository.create({
        filial: dealer,
        year,
        month,
        report: report || undefined,
        filialType: FilialType.DEALER as unknown as FilialTypeEnum,
        isActive: true,
        status: KassaProgresEnum.OPEN,
      });
      await this.kassaRepository.save(kassa);
    }
  }

  /**
   * Close / confirm a Kassa (monthly confirmation workflow).
   * Preserves the exact closeKassaReport workflow from KassaReportService:
   *  - F_MANAGER  -> confirmationStatus = CLOSED
   *  - M_MANAGER  -> isMManagerConfirmed = true
   *  - ACCOUNTANT -> isAccountantConfirmed = true, creates terminal cashflow
   *  - Both confirmed -> ACCEPTED, carry forward balance to next month
   */

  // ─── Guard funksiyalar ──────────────────────────────────────────

  /** Kassaga yangi cashflow qo'shish mumkinmi */
  canAddCashflow(kassa: Kassa): boolean {
    return kassa.status === KassaProgresEnum.OPEN;
  }

  /** Kassadan cashflow o'chirish mumkinmi */
  canDeleteCashflow(kassa: Kassa, isOrderCashflow: boolean): boolean {
    if (kassa.status === KassaProgresEnum.CLOSED || kassa.status === KassaProgresEnum.ACCEPTED) return false;
    if (kassa.status === KassaProgresEnum.WARNING) {
      return !isOrderCashflow; // faqat order bilan bog'liq BO'LMAGAN
    }
    return true; // open
  }

  /** Cashflow yangilash mumkinmi */
  canUpdateCashflow(kassa: Kassa): boolean {
    if (kassa.status === KassaProgresEnum.CLOSED || kassa.status === KassaProgresEnum.ACCEPTED) return false;
    return true; // open va warning
  }

  /** Cashflow sanasini boshqa oyga o'zgartirish mumkinmi */
  canChangeCashflowMonth(kassa: Kassa): boolean {
    return kassa.status === KassaProgresEnum.OPEN || kassa.status === KassaProgresEnum.WARNING;
  }

  /** Order vazvrat — barcha holatda mumkin */
  canReturnOrder(): boolean {
    return true; // open, warning, closed, accepted
  }

  // ─── Kassa qayta hisoblash ──────────────────────────────────────

  /** Kassaning barcha totallarini cashflowlardan qayta hisoblash */
  async recalculateKassa(kassaId: string): Promise<void> {
    const cashflows = await this.cashflowRepository.find({
      where: { kassa: { id: kassaId }, is_cancelled: false },
      relations: { order: { product: { bar_code: { size: true } } } },
    });

    let income = 0, expense = 0, sale = 0, plasticSum = 0, in_hand = 0;
    let discount = 0, return_sale = 0, return_size = 0, cash_collection = 0;
    let totalSize = 0, totalSellCount = 0;
    let netProfitTotalSum = 0, additionalProfitTotalSum = 0;
    let debt_sum = 0, debt_kv = 0, debt_count = 0;
    let internetShopSum = 0;

    for (const cf of cashflows) {
      const price = Math.abs(cf.price || 0);
      const isOrder = cf.tip === CashflowTipEnum.ORDER;
      const order = cf.order;

      if (cf.type === CashFlowEnum.InCome) {
        if (isOrder && order) {
          sale += price;
          plasticSum += order.plasticSum || 0;
          discount += (order.discountSum || 0) + (order.managerDiscountSum || 0);
          netProfitTotalSum += order.netProfitSum || 0;
          additionalProfitTotalSum += order.additionalProfitSum || 0;
          if (order.isDebt) {
            debt_sum += price;
            debt_kv += order.kv || 0;
            debt_count += order.product?.bar_code?.isMetric ? 1 : (order.x || 0);
          } else {
            in_hand += order.price || 0;
          }
          const barCode = order?.product?.bar_code;
          const size = barCode?.size;
          if (barCode && size) {
            totalSize += barCode.isMetric ? ((order.x || 0) / 100) * size.x : (size.kv || 0) * (order.x || 0);
            totalSellCount += barCode.isMetric ? 1 : (order.x || 0);
          }
          if (order.product?.isInternetShop) internetShopSum += price;
        } else {
          income += price;
          if (cf.is_online) plasticSum += price;
        }
      } else if (cf.type === CashFlowEnum.Consumption) {
        expense += price;
        in_hand -= price;
        if (cf.cashflow_type?.slug === 'cash_collection') cash_collection += price;
        if (cf.cashflow_type?.slug === 'return') {
          return_sale += price;
        }
      }
    }

    // Kassa yangilash
    const kassa = await this.kassaRepository.findOne({ where: { id: kassaId } });
    if (!kassa) return;

    const openingBalance = kassa.opening_balance || 0;

    kassa.income = income;
    kassa.expense = expense;
    kassa.sale = sale;
    kassa.plasticSum = plasticSum;
    kassa.in_hand = openingBalance + in_hand + income - expense;
    kassa.discount = discount;
    kassa.return_sale = return_sale;
    kassa.return_size = return_size;
    kassa.cash_collection = cash_collection;
    kassa.totalSize = totalSize;
    kassa.totalSellCount = totalSellCount;
    kassa.netProfitTotalSum = netProfitTotalSum;
    kassa.additionalProfitTotalSum = additionalProfitTotalSum;
    kassa.debt_sum = debt_sum;
    kassa.debt_kv = debt_kv;
    kassa.debt_count = debt_count;
    kassa.internetShopSum = internetShopSum;

    await this.kassaRepository.save(kassa);
  }

  // ─── closeKassa ─────────────────────────────────────────────────

  async closeKassa(id: string, user: User, action: 'confirm' | 'reject' = 'confirm') {
    const userRole = user.position.role;

    const kassa = await this.kassaRepository.findOne({
      where: { id },
      relations: { filial: { manager: true }, report: true },
    });

    if (!kassa) throw new BadRequestException('Kassa not found');

    // ─── F_MANAGER: yopish (warning/open → closed) ─────────────────
    if (userRole === UserRoleEnum.F_MANAGER && action === 'confirm') {
      if (kassa.status !== KassaProgresEnum.WARNING && kassa.status !== KassaProgresEnum.OPEN) {
        throw new BadRequestException('Kassani faqat open yoki warning holatdan yopish mumkin');
      }
      kassa.status = KassaProgresEnum.CLOSED;
      // Barcha flaglarni reset qilish — yangi tasdiqlash sikli
      kassa.isMManagerConfirmed = false;
      kassa.isAccountantConfirmed = false;
      kassa.isManagerRejected = false;
      kassa.isAccountantRejected = false;
    }

    // ─── M_MANAGER: tasdiqlash ──────────────────────────────────────
    else if (userRole === UserRoleEnum.M_MANAGER && action === 'confirm') {
      if (kassa.status !== KassaProgresEnum.CLOSED) {
        throw new BadRequestException('Kassani tasdiqlash uchun avval F_MANAGER yopishi kerak');
      }
      kassa.isMManagerConfirmed = true;
      kassa.isManagerRejected = false;
    }

    // ─── M_MANAGER: qaytarish ───────────────────────────────────────
    else if (userRole === UserRoleEnum.M_MANAGER && action === 'reject') {
      if (kassa.status !== KassaProgresEnum.CLOSED) {
        throw new BadRequestException('Faqat closed kassani qaytarish mumkin');
      }
      kassa.isManagerRejected = true;
      kassa.isMManagerConfirmed = false;
      kassa.isAccountantConfirmed = false;
      kassa.status = KassaProgresEnum.WARNING;
    }

    // ─── ACCOUNTANT: tasdiqlash ─────────────────────────────────────
    else if (userRole === UserRoleEnum.ACCOUNTANT && action === 'confirm') {
      if (kassa.status !== KassaProgresEnum.CLOSED) {
        throw new BadRequestException('Kassani tasdiqlash uchun avval F_MANAGER yopishi kerak');
      }
      kassa.isAccountantConfirmed = true;
      kassa.isAccountantRejected = false;

      // Terminal cashflow yaratish
      const accountant = await this.userRepository.findOne({
        where: { position: { role: UserRoleEnum.ACCOUNTANT } },
        relations: { avatar: true, position: true },
      });
      const report = await this.reportService.findOne(kassa.report?.id);
      const slugTerminal = await this.getOneBySlug('online');

      // plasticSum > 0 bo'lgandagina terminal cashflow yaratilsin, 0 bo'lsa ignore
      if (slugTerminal && report && kassa.plasticSum > 0) {
        await this.cashflowRepository.save(
          this.cashflowRepository.create({
            price: kassa.plasticSum,
            type: CashFlowEnum.InCome,
            tip: CashflowTipEnum.CASHFLOW,
            comment: `${kassa.filial.title} terminal: ${this.getMonthName(kassa.month)} oyi ${kassa.year}`,
            cashflow_type: slugTerminal,
            date: new Date().toISOString(),
            report: report,
            createdBy: accountant,
            is_online: false,
            is_static: true,
          }),
        );
      }
    }

    // ─── ACCOUNTANT: qaytarish ──────────────────────────────────────
    else if (userRole === UserRoleEnum.ACCOUNTANT && action === 'reject') {
      if (kassa.status !== KassaProgresEnum.CLOSED) {
        throw new BadRequestException('Faqat closed kassani qaytarish mumkin');
      }
      kassa.isAccountantRejected = true;
      kassa.isAccountantConfirmed = false;
      kassa.isMManagerConfirmed = false;
      kassa.status = KassaProgresEnum.WARNING;
    }

    else {
      throw new BadRequestException('Bu amalni bajarish huquqingiz yo\'q');
    }

    // ─── Ikkalasi tasdiqlagan → ACCEPTED ────────────────────────────
    if (kassa.isMManagerConfirmed && kassa.isAccountantConfirmed) {
      kassa.status = KassaProgresEnum.ACCEPTED;

      const now = dayjs();
      if (kassa.year > now.year() || (kassa.year === now.year() && kassa.month >= now.month() + 1)) {
        throw new BadRequestException('Joriy yoki kelajak oyni yakunlab bo\'lmaydi');
      }

      // Balansni keyingi oyga o'tkazish (faqat FILIAL kassalar uchun, diller kassalarida yurmaydi)
      const isDealerKassa = kassa.filialType === FilialTypeEnum.DEALER
        || kassa.filialType === (FilialType.DEALER as unknown as FilialTypeEnum);

      if (!isDealerKassa) {
        const nextMonth = kassa.month === 12 ? 1 : kassa.month + 1;
        const nextYear = kassa.month === 12 ? kassa.year + 1 : kassa.year;

        const nextKassa = await this.kassaRepository.findOne({
          where: { month: nextMonth, year: nextYear, filial: { id: kassa.filial.id } },
          relations: { filial: true },
        });

        const price = kassa.in_hand;

        if (Number(price) > 0 && nextKassa) {
          const slugSaldo = await this.getOneBySlug('balance');
          await this.cashflowRepository.save(
            this.cashflowRepository.create({
              price: price,
              type: CashFlowEnum.InCome,
              tip: CashflowTipEnum.CASHFLOW,
              comment: `${this.getMonthName(kassa.month)} oyidan o'tgan pul ${kassa.year}`,
              cashflow_type: slugSaldo,
              date: new Date().toISOString(),
              kassa: nextKassa,
              createdBy: kassa?.filial?.manager,
              is_online: false,
              is_static: true,
            }),
          );

          nextKassa.opening_balance = (nextKassa.opening_balance || 0) + price;
          nextKassa.in_hand = (nextKassa.in_hand || 0) + price;
          nextKassa.income = (nextKassa.income || 0) + (price > 0 ? price : 0);
          await this.kassaRepository.save(nextKassa);
        } else if (nextKassa) {
          // Nol yoki manfiy balance — cashflow yaratmasdan faqat opening_balance yozish
          nextKassa.opening_balance = (nextKassa.opening_balance || 0) + Number(price);
          nextKassa.in_hand = (nextKassa.in_hand || 0) + Number(price);
          await this.kassaRepository.save(nextKassa);
        }
      }
    }

    kassa.dealer_frozen_owed = kassa.filial?.owed || 0;

    return await this.kassaRepository.save(kassa);
  }

  /**
   * Creates monthly Kassas (12 months) for all active filials of a given year.
   * Replaces KassaReportService.createDefaultKassaReportsByYear.
   */
  async createKassasForFilialsByYear(targetYear: number): Promise<Kassa[]> {
    const now = dayjs();
    const currentYear = now.year();
    const currentMonth = now.month() + 1;

    const filials = await this.filialRepository.find({
      where: {
        isActive: true,
        isDeleted: false,
        type: In([
          FilialTypeEnum.FILIAL,
          FilialTypeEnum.DEALER,
          FilialTypeEnum.MARKET,
        ]),
      },
    });

    const created: Kassa[] = [];

    for (const filial of filials) {
      if (filial.type === FilialTypeEnum.WAREHOUSE) continue;

      for (let month = 1; month <= 12; month++) {
        const exists = await this.kassaRepository.findOne({
          where: {
            year: targetYear,
            month,
            filial: { id: filial.id },
          },
        });

        if (exists) continue;

        let kassaStatus = 3; // future
        if (targetYear < currentYear) {
          kassaStatus = 1;
        } else if (targetYear === currentYear) {
          if (month < currentMonth) kassaStatus = 1;
          else if (month === currentMonth) kassaStatus = 2;
        }

        const report = await this.reportService.findOneByYearMonthAndFilialType(
          targetYear,
          month,
          filial.type,
        );

        const newKassa = this.kassaRepository.create({
          filial,
          filialType: filial.type,
          year: targetYear,
          month,
          kassaStatus,
          report: report || undefined,
          createdAt: new Date(Date.UTC(targetYear, month - 1, 1)),
        });

        created.push(await this.kassaRepository.save(newKassa));
      }
    }

    return created;
  }

  // ────────────────────────────────────────────────────────────────
  //  HELPER METHODS (absorbed from KassaReportService)
  // ────────────────────────────────────────────────────────────────

  getMonthName(month: number): string {
    const monthNames = [
      'Yanvar',
      'Fevral',
      'Mart',
      'Aprel',
      'May',
      'Iyun',
      'Iyul',
      'Avgust',
      'Sentabr',
      'Oktabr',
      'Noyabr',
      'Dekabr',
    ];
    return monthNames[month - 1] || 'Unknown month';
  }

  async getOneBySlug(slug: string) {
    return await this.cashflowTypeRepository
      .findOne({
        where: { slug },
      })
      .catch(() => {
        throw new NotFoundException('Cashflow type not found');
      });
  }

  /**
   * Adds kassa values to a report aggregate (helper).
   */
  public addKassaToReport(report: Report, kassa: Kassa): void {
    report.in_hand = (report.in_hand || 0) + (kassa.in_hand || 0) + (kassa.plasticSum || 0);
    report.totalExpense = (report.totalExpense || 0) + (kassa.expense || 0);
    report.totalIncome = (report.totalIncome || 0) + (kassa.income || 0);
  }

  public subtractKassaFromReport(report: Report, kassa: Kassa): void {
    report.in_hand = Math.max(0, (report.in_hand || 0) - ((kassa.in_hand || 0) + (kassa.plasticSum || 0)));
    report.totalExpense = Math.max(0, (report.totalExpense || 0) - (kassa.expense || 0));
    report.totalIncome = Math.max(0, (report.totalIncome || 0) - (kassa.income || 0));
  }

  async changeValueReport(kassa: Kassa): Promise<Report> {
    const year = kassa.startDate.getFullYear();
    const month = kassa.startDate.getMonth() + 1;

    const fullKassa = await this.kassaRepository.findOne({
      where: { id: kassa.id },
      relations: ['report', 'filial'],
    });

    if (!fullKassa?.filial) {
      throw new BadRequestException('Filial not found in kassa');
    }

    let report = await this.reportRepo.findOne({
      where: {
        filial: { id: fullKassa.filial.id },
        year,
        month,
      },
    });

    if (!report) {
      throw new BadRequestException('Report not found');
    }

    if (report.is_cancelled) {
      throw new BadRequestException('This report is cancelled and cannot be modified');
    }

    if (fullKassa.report?.id === report.id) {
      this.subtractKassaFromReport(report, fullKassa);
    }

    this.addKassaToReport(report, fullKassa);

    const savedReport = await this.reportRepo.save(report);

    fullKassa.report = savedReport;
    await this.kassaRepository.save(fullKassa);

    return savedReport;
  }
}
