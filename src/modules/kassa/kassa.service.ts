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
        endDate: 'DESC',
      },
    });
  }

  async getReport(options: IPaginationOptions, user, where) {
    const filialId = where.filial?.id || user?.filial?.id;

    const queryWhere: any = {
      ...(where.year && { year: where.year }),
      ...(filialId && { filial: { id: filialId } }),
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

  async getReportTotals(filialId: string) {
    const kassas = await this.kassaRepository.find({
      where: { filial: { id: filialId } },
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
    return await this.kassaRepository.findOne({
      where: { filial: { id, type: type || FilialType.FILIAL }, isActive: true },
      relations: {
        report: true,
      },
    });
  }

  async getKassa(id: string) {
    return await this.kassaRepository.findOne({
      relations: {
        orders: {
          seller: true,
          casher: true,
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
          casher: true,
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
    const roleStatusMap = {
      [UserRoleEnum.F_MANAGER]: KassaProgresEnum.REJECTED,
    };

    const userRole = user.position.role;
    const status = roleStatusMap[userRole];

    if (!status) {
      throw new BadRequestException('You cannot close kassa!');
    }

    const partialEntity = {
      status,
      closer_m: user.id,
    };

    const updatePromises = ids.map((id) => this.kassaRepository.update(id, partialEntity));

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
    const roleStatusMap = {
      [UserRoleEnum.F_MANAGER]: KassaProgresEnum.REJECTED,
    };

    if (!roleStatusMap?.[user.position.role]) throw new BadRequestException('You can not reject kassa!');

    const status = roleStatusMap[user.position.role];
    return await Promise.allSettled(
      ids.map((id) => {
        return this.kassaRepository.update(id, {
          isActive: false,
          status,
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
      kassa.status = KassaProgresEnum.CLOSED_BY_C;
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
   * Close / confirm a Kassa (monthly confirmation workflow).
   * Preserves the exact closeKassaReport workflow from KassaReportService:
   *  - F_MANAGER  -> confirmationStatus = CLOSED
   *  - M_MANAGER  -> isMManagerConfirmed = true
   *  - ACCOUNTANT -> isAccountantConfirmed = true, creates terminal cashflow
   *  - Both confirmed -> ACCEPTED, carry forward balance to next month
   */
  async closeKassa(id: string, user: User) {
    const userRole = user.position.role;

    const kassa = await this.kassaRepository.findOne({
      where: { id },
      relations: { filial: { manager: true }, report: true },
    });

    if (!kassa) throw new BadRequestException('Kassa not found');

    // Check that all daily kassas within this monthly kassa are accepted
    // (kassas with actual sales that haven't been accepted yet)
    const hasUnacceptedKassa = kassa.status !== KassaProgresEnum.ACCEPTED
      && (kassa.in_hand + kassa.plasticSum) > 0
      && kassa.sale > 0;

    if (hasUnacceptedKassa) {
      throw new BadRequestException('You have unaccepted kassas or you have no kassas.');
    }

    if (userRole === UserRoleEnum.F_MANAGER) {
      if (kassa.confirmationStatus !== KassaReportProgresEnum.OPEN) {
        throw new BadRequestException('Report already closed, accepted or rejected!');
      }
      kassa.confirmationStatus = KassaReportProgresEnum.CLOSED;
    } else if (userRole === UserRoleEnum.M_MANAGER) {
      if (
        kassa.confirmationStatus !== KassaReportProgresEnum.CLOSED &&
        kassa.confirmationStatus !== KassaReportProgresEnum.ACCOUNTANT_CONFIRMED &&
        kassa.confirmationStatus !== KassaReportProgresEnum.M_MANAGER_CONFIRMED
      ) {
        throw new BadRequestException('Report must be closed by F_MANAGER first!');
      }
      kassa.isMManagerConfirmed = true;
      kassa.confirmationStatus = KassaReportProgresEnum.M_MANAGER_CONFIRMED;
    } else if (userRole === UserRoleEnum.ACCOUNTANT) {
      if (
        kassa.confirmationStatus !== KassaReportProgresEnum.CLOSED &&
        kassa.confirmationStatus !== KassaReportProgresEnum.ACCOUNTANT_CONFIRMED &&
        kassa.confirmationStatus !== KassaReportProgresEnum.M_MANAGER_CONFIRMED
      ) {
        throw new BadRequestException('Report must be closed by F_MANAGER first!');
      }
      kassa.isAccountantConfirmed = true;
      kassa.confirmationStatus = KassaReportProgresEnum.ACCOUNTANT_CONFIRMED;

      const accountant = await this.userRepository.findOne({
        where: {
          position: { role: UserRoleEnum.ACCOUNTANT },
        },
        relations: { avatar: true, position: true },
      });

      const report = await this.reportService.findOne(kassa.report?.id);
      const slugTerminal = await this.getOneBySlug('онлайн');

      await this.cashflowRepository.save(
        this.cashflowRepository.create({
          price: kassa.plasticSum,
          type: CashFlowEnum.InCome,
          tip: CashflowTipEnum.CASHFLOW,
          comment: `${kassa.filial.title} terminal va perechisleniya: ${this.getMonthName(
            kassa.month,
          )} oyi uchun ${kassa.year}`,
          cashflow_type: slugTerminal,
          date: new Date().toISOString(),
          report: report,
          casher: accountant,
          is_online: false,
          is_static: true,
        }),
      );
    } else {
      throw new BadRequestException('You do not have permission to perform this action!');
    }

    // When both M_MANAGER and ACCOUNTANT have confirmed -> ACCEPTED
    if (kassa.isMManagerConfirmed && kassa.isAccountantConfirmed) {
      kassa.confirmationStatus = KassaReportProgresEnum.ACCEPTED;

      let nextMonth: number;
      let nextYear: number;
      if (kassa.month === 12) {
        nextMonth = 1;
        nextYear = kassa.year + 1;
      } else {
        nextMonth = kassa.month + 1;
        nextYear = kassa.year;
      }

      const now = dayjs();
      if (
        kassa.year > now.year() ||
        (kassa.year === now.year() && kassa.month >= now.month() + 1)
      ) {
        throw new BadRequestException('You cannot close the current or a future month.');
      }

      // Find the next month's kassa for this filial
      const nextKassa = await this.kassaRepository.findOne({
        where: { month: nextMonth, year: nextYear, filial: { id: kassa.filial.id } },
        relations: { filial: true },
      });

      const slugSaldo = await this.getOneBySlug('Balance');
      const price = kassa.in_hand;

      if (Number(price) > 0 && nextKassa) {
        await this.cashflowRepository.save(
          this.cashflowRepository.create({
            price: price,
            type: CashFlowEnum.InCome,
            tip: CashflowTipEnum.CASHFLOW,
            comment: `${this.getMonthName(kassa.month)} oyidan o'tgan pul ${kassa.year}`,
            cashflow_type: slugSaldo,
            date: new Date().toISOString(),
            kassa: nextKassa,
            casher: kassa?.filial?.manager,
            is_online: false,
            is_static: true,
          }),
        );

        await this.kassaRepository.update({ id: nextKassa.id }, {
          in_hand: nextKassa.in_hand + price,
          income: nextKassa.income + price > 0 ? price : 0,
          totalSum: (nextKassa.in_hand || 0) + (nextKassa.plasticSum || 0) + price,
        });
      }

      if (nextKassa) {
        if (price > 0) {
          nextKassa.totalSum += price;
          nextKassa.income += price;
        }
        nextKassa.opening_balance += price;
        nextKassa.in_hand += price;
        await this.kassaRepository.save(nextKassa);
      }
    }

    kassa.dealer_frozen_owed = kassa.filial.owed;

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
