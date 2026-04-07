import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';

import { ReportQueryDto } from './dto';
import * as dayjs from 'dayjs';
import { Filial } from '../filial/filial.entity';
import { User } from '../user/user.entity';
import { CashFlowEnum, FilialTypeEnum, OrderEnum } from '../../infra/shared/enum';
import KassaReportProgresEnum from '../../infra/shared/enum/kassa-report-progres.enum';
import { Report } from './report.entity';
import { Kassa } from '../kassa/kassa.entity';
import { CancelReportDto } from './dto/update-report.dto';
import { Cashflow } from '../cashflow/cashflow.entity';
import { CashflowType } from '@modules/cashflow-type/cashflow-type.entity';
import ReportProgresEnum from 'src/infra/shared/enum/report-progres.enum';
import FilialType from '@infra/shared/enum/filial-type.enum';
import { PackageTransferEnum, UserRoleEnum } from '@infra/shared/enum';
import { PackageTransfer } from '@modules/package-transfer/package-transfer.entity';
import { Order } from '@modules/order/order.entity';
import { Redis } from 'ioredis';
import { Product } from '@modules/product/product.entity';
import { Transfer } from '@modules/transfer/transfer.entity';
import { Media } from '@modules/media/media.entity';
import { PlanYearService } from '@modules/plan-year/plan-year.service';
import userRoleEnum from '@infra/shared/enum/user-role.enum';
import KassaProgresEnum from '@infra/shared/enum/kassa-progres-enum';
import CashflowTipEnum from '@infra/shared/enum/cashflow/cashflow-tip.enum';

@Injectable()
export class ReportService {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    private readonly dataSource: DataSource,
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(Kassa)
    private readonly kassaRepo: Repository<Kassa>,
    @InjectRepository(Filial)
    private readonly filialRepository: Repository<Filial>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @InjectRepository(PackageTransfer)
    private readonly packageTransfer: Repository<PackageTransfer>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly entityManager: EntityManager,
    private readonly planYearService: PlanYearService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    @InjectRepository(CashflowType)
    private readonly cashflowTypeRepository: Repository<CashflowType>,
  ) {
  }

  async paginateReports(options: IPaginationOptions): Promise<Pagination<Report>> {
    const queryBuilder = this.reportRepo.createQueryBuilder('report');
    queryBuilder.orderBy('report.year', 'DESC').addOrderBy('report.month', 'DESC');
    return paginate<Report>(queryBuilder, options);
  }

  async getCurrentReport(filial: Filial): Promise<Report> {
    const now = dayjs();
    const year = now.year();
    const month = now.month() + 1;

    // Filial tipiga mos report qidirish
    const filialType = filial?.type || FilialTypeEnum.FILIAL;

    let report = await this.reportRepo.findOne({
      where: { year, month, filialType },
    });

    if (!report) {
      report = this.reportRepo.create({ year, month, filialType });
      report = await this.reportRepo.save(report);
    }

    // Link unlinked kassas for current month (faqat shu filialType uchun)
    const orphanKassas = await this.kassaRepo
      .createQueryBuilder('kassa')
      .leftJoinAndSelect('kassa.filial', 'filial')
      .where('kassa.year = :year', { year })
      .andWhere('kassa.month = :month', { month })
      .andWhere('kassa."reportId" IS NULL')
      .andWhere('filial.type = :filialType', { filialType })
      .getMany();

    for (const kassa of orphanKassas) {
      kassa.report = report;
      await this.kassaRepo.save(kassa);
    }

    return this.reportRepo.findOne({
      where: { id: report.id },
      relations: ['kassas', 'kassas.filial'],
      order: { kassas: { filial: { title: 'ASC' } } },
    });
  }

  async getReportByDate(filial: Filial, { year, month }): Promise<Report> {
    const existing = await this.reportRepo.findOne({
      where: {
        year,
        month,
      },
    });

    if (existing) return existing;

    const newReport = this.reportRepo.create({
      year,
      month,
    });

    return await this.reportRepo.save(newReport);
  }

  async getReportsFiltered(query: ReportQueryDto, options: IPaginationOptions, user: User): Promise<Pagination<Report>> {
    const qb = this.reportRepo.createQueryBuilder('report');

    const roleToFilialTypeMap = {
      [UserRoleEnum.M_MANAGER]: FilialTypeEnum.FILIAL,
      [UserRoleEnum.D_MANAGER]: FilialTypeEnum.DEALER,
      [UserRoleEnum.I_MANAGER]: FilialTypeEnum.MARKET,
      [UserRoleEnum.ACCOUNTANT]: FilialTypeEnum.FILIAL,
    };

    if (user.position.role === UserRoleEnum.BOSS) {
      if (query.filialType) {
        qb.andWhere('report.filialType = :filialType', { filialType: query.filialType });
      } else {
        qb.andWhere('report.filialType = :filialType', { filialType: FilialTypeEnum.FILIAL });
      }
    } else {
      const filialType = roleToFilialTypeMap[user.position.role];
      if (filialType) {
        qb.andWhere('report.filialType = :filialType', { filialType });
      }
    }

    if (query.year) {
      qb.andWhere('report.year = :year', { year: query.year });
      let year = dayjs().year();
      const currentMonth = year === query.year ? dayjs().month() + 1 : 12;
      qb.andWhere('report.month <= :currentMonth', { currentMonth });
    }

    qb.orderBy('report.year', 'DESC').addOrderBy('report.month', 'DESC');

    const result = await paginate<Report>(qb, options);

    const { totalOwed } = await this.filialRepository
      .createQueryBuilder('filial')
      .select('COALESCE(SUM(filial.owed), 0)', 'totalOwed')
      .where('filial.type = :type', { type: FilialType.DEALER })
      .andWhere('filial.isActive = true')
      .getRawOne();

    return {
      ...result,
      items: result.items.map((report) => ({
        ...report,
        additionalProfitTotalSum: Number(Number(report.additionalProfitTotalSum ?? 0).toFixed(2)),
        netProfitTotalSum: Number(Number(report.netProfitTotalSum ?? 0).toFixed(2)),
        totalSize: Number(Number(report.totalSize ?? 0).toFixed(2)),
        totalPlasticSum: Number(Number(report.totalPlasticSum ?? 0).toFixed(2)),
        totalInternetShopSum: Number(Number(report.totalInternetShopSum ?? 0).toFixed(2)),
        totalSale: Number(Number(report.totalSale ?? 0).toFixed(2)),
        totalSaleReturn: Number(Number(report.totalSaleReturn ?? 0).toFixed(2)),
        totalCashCollection: Number(Number(report.totalCashCollection ?? 0).toFixed(2)),
        totalDiscount: Number(Number(report.totalDiscount ?? 0).toFixed(2)),
        totalIncome: Number(Number(report.totalIncome ?? 0).toFixed(2)),
        totalExpense: Number(Number(report.totalExpense ?? 0).toFixed(2)),
        managerSum: Number(Number(report.managerSum ?? 0).toFixed(2)),
        accountantSum: Number(Number(report.accountantSum ?? 0).toFixed(2)),
        owed: totalOwed,
      })),
    };
  }

  async getTotalReports(query: ReportQueryDto): Promise<{
    totalSellCount: number;
    additionalProfitTotalSum: number;
    netProfitTotalSum: number;
    totalSize: number;
    totalPlasticSum: number;
    totalInternetShopSum: number;
    totalSale: number;
    totalSaleReturn: number;
    totalCashCollection: number;
    totalDiscount: number;
    totalIncome: number;
    totalExpense: number;
    totalSum: number;
    managerSum: number;
    accountantSum: number;
    managerSaldo: number;
    accountantSaldo: number;
  }> {
    const qb = this.reportRepo.createQueryBuilder('report');

    if (query.year) {
      qb.andWhere('report.year = :year', { year: query.year });
      qb.andWhere('report.filialType = :type', { type: 'filial' });
    }

    const result = await qb
      .select('SUM(report.totalSellCount)', 'totalSellCount')
      .addSelect('SUM(report.additionalProfitTotalSum)', 'additionalProfitTotalSum')
      .addSelect('SUM(report.netProfitTotalSum)', 'netProfitTotalSum')
      .addSelect('SUM(report.totalSize)', 'totalSize')
      .addSelect('SUM(report.totalPlasticSum)', 'totalPlasticSum')
      .addSelect('SUM(report.totalInternetShopSum)', 'totalInternetShopSum')
      .addSelect('SUM(report.totalSale)', 'totalSale')
      .addSelect('SUM(report.totalSaleReturn)', 'totalSaleReturn')
      .addSelect('SUM(report.totalCashCollection)', 'totalCashCollection')
      .addSelect('SUM(report.totalDiscount)', 'totalDiscount')
      .addSelect('SUM(report.totalIncome)', 'totalIncome')
      .addSelect('SUM(report.totalExpense)', 'totalExpense')
      .addSelect('SUM(report.managerSum)', 'managerSum')
      .addSelect('SUM(report.accountantSum)', 'accountantSum')
      .addSelect('SUM(report.managerSaldo)', 'managerSaldo')
      .addSelect('SUM(report.accountantSaldo)', 'accountantSaldo')
      .getRawOne();

    return {
      totalSellCount: parseInt(result?.totalSellCount || '0', 10),
      additionalProfitTotalSum: parseFloat(result?.additionalProfitTotalSum || '0'),
      netProfitTotalSum: parseFloat(result?.netProfitTotalSum || '0'),
      totalSize: parseFloat(result?.totalSize || '0'),
      totalPlasticSum: parseFloat(result?.totalPlasticSum || '0'),
      totalInternetShopSum: parseFloat(result?.totalInternetShopSum || '0'),
      totalSale: parseFloat(result?.totalSale || '0'),
      totalSaleReturn: parseFloat(result?.totalSaleReturn || '0'),
      totalCashCollection: parseFloat(result?.totalCashCollection || '0'),
      totalDiscount: parseFloat(result?.totalDiscount || '0'),
      totalIncome: parseFloat(result?.totalIncome || '0'),
      totalExpense: parseFloat(result?.totalExpense || '0'),
      totalSum: parseFloat(result?.totalSum || '0'),
      managerSum: parseFloat(result?.managerSum || '0'),
      accountantSum: parseFloat(result?.accountantSum || '0'),
      managerSaldo: parseFloat(result?.managerSaldo || '0'),
      accountantSaldo: parseFloat(result?.accountantSaldo || '0'),
    };
  }

  async changeValueByReport(filial: Filial, year: number, month: number): Promise<Report> {
    const kassas = await this.kassaRepo.find({
      where: { filial: { id: filial.id }, year, month },
    });

    const report = await this.getReportByDate(filial, { year, month });
    if (report.is_cancelled) throw new BadRequestException('Report already cancelled');

    Object.assign(report, {
      totalSellCount: 0,
      totalSize: 0,
      totalSale: 0,
      totalCashCollection: 0,
      additionalProfitTotalSum: 0,
      totalInternetShopSum: 0,
      totalDiscount: 0,
      totalPlasticSum: 0,
      netProfitTotalSum: 0,
      totalSum: 0,
      totalExpense: 0,
      totalIncome: 0,
    });

    for (const k of kassas) {
      report.totalSellCount += k.totalSellCount || 0;
      report.totalSize += k.totalSize || 0;
      report.totalSale += k.sale || 0;
      report.totalCashCollection += k.cash_collection || 0;
      report.additionalProfitTotalSum += k.additionalProfitTotalSum || 0;
      report.totalInternetShopSum += k.internetShopSum || 0;
      report.totalDiscount += k.discount || 0;
      report.totalPlasticSum += k.plasticSum || 0;
      report.netProfitTotalSum += k.netProfitTotalSum || 0;
      report.accountantSum += Math.max(k.plasticSum + k.cash_collection, 0);
      report.totalExpense += k.expense || 0;
      report.totalIncome += k.income || 0;
    }

    report.is_cancelled = false;
    return this.reportRepo.save(report);
  }

  async cancelValueReport(dto: CancelReportDto, reportId: string): Promise<Report> {
    const kassa = await this.kassaRepo.findOne({ where: { id: dto.kassaReportId } });
    const report = await this.findOne(reportId);
    if (report.is_cancelled) throw new BadRequestException('Report already cancelled');

    if (!kassa) {
      throw new BadRequestException('Kassa is not found');
    }

    Object.assign(report, {
      totalSellCount: report.totalSellCount - (kassa.totalSellCount || 0),
      totalSize: report.totalSize - (kassa.totalSize || 0),
      totalSale: report.totalSale - (kassa.sale || 0),
      totalCashCollection: Math.max(0, report.totalCashCollection - (kassa.cash_collection || 0)),
      additionalProfitTotalSum: report.additionalProfitTotalSum - (kassa.additionalProfitTotalSum || 0),
      totalInternetShopSum: report.totalInternetShopSum - (kassa.internetShopSum || 0),
      totalDiscount: report.totalDiscount - (kassa.discount || 0),
      totalPlasticSum: report.totalPlasticSum - (kassa.plasticSum || 0),
      netProfitTotalSum: report.netProfitTotalSum - (kassa.netProfitTotalSum || 0),
      accountantSum: report.accountantSum - ((kassa.plasticSum + kassa.cash_collection) || 0),
      totalExpense: report.totalExpense - (kassa.expense || 0),
      totalIncome: report.totalIncome - (kassa.income || 0),
    });
    report.is_cancelled = true;
    return this.reportRepo.save(report);
  }

  async closeReport(id: string, user: User) {
    const userRole = user.position?.role;

    const report = await this.reportRepo.findOne({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const check = {
      [userRoleEnum.ACCOUNTANT]: report.isAccountantConfirmed,
      [userRoleEnum.M_MANAGER]: report.isMManagerConfirmed,
    };

    if (report.filialType === FilialTypeEnum.DEALER && report.status !== ReportProgresEnum.CLOSED_BY_D) {
      throw new BadRequestException('Dealer reports must be closed by D_MANAGER before confirmation.');
    }

    if (userRole === userRoleEnum.ACCOUNTANT) {
      report.isAccountantConfirmed = true;
    } else if (userRole === userRoleEnum.M_MANAGER) {
      report.isMManagerConfirmed = true;
    }

    if (report.isAccountantConfirmed && report.isMManagerConfirmed) {
      report.status = ReportProgresEnum.ACCEPTED;

      // ──── Saldo: qoldiqlarni keyingi oyga o'tkazish ────
      const nextMonth = report.month === 12 ? 1 : report.month + 1;
      const nextYear = report.month === 12 ? report.year + 1 : report.year;

      const nextReport = await this.reportRepo.findOne({
        where: { month: nextMonth, year: nextYear, filialType: FilialTypeEnum.FILIAL },
      });

      if (nextReport) {
        const slugSaldo = await this.cashflowTypeRepository.findOne({
          where: { slug: 'Balance' },
        });

        const users = await this.userRepository.find({
          where: [
            { position: { role: 9 }, isActive: true },
            { position: { role: 10 }, isActive: true },
          ],
          relations: { position: true },
        });

        for (const u of users) {
          const amount = u.position.role === 9 ? report.managerSum : report.accountantSum;

          if (amount > 0 && slugSaldo) {
            await this.cashflowRepository.save(
              this.cashflowRepository.create({
                price: amount,
                type: CashFlowEnum.InCome,
                tip: CashflowTipEnum.CASHFLOW,
                comment: `${report.month}-oy saldo qoldig'i ${report.year}`,
                cashflow_type: slugSaldo,
                date: new Date().toISOString(),
                report: nextReport,
                createdBy: u,
                is_online: false,
                is_static: true,
              }),
            );

            if (u.position.role === 9) {
              nextReport.managerSum += amount;
              nextReport.managerSaldo = amount;
            } else {
              nextReport.accountantSum += amount;
              nextReport.accountantSaldo = amount;
            }
            nextReport.totalIncome += amount;
          }
        }

        await this.reportRepo.save(nextReport);
      }
    }

    return await this.reportRepo.save(report);
  }

  async testcreate() {
    const report = this.reportRepo.create({ year: 2025, month: 6 });
    return await this.reportRepo.save(report);
  }

  async findOne(id: string) {
    const report = await this.reportRepo.findOne({
      where: {
        id,
      },
      relations: ['kassas', 'kassas.filial', 'kassas.filial.manager'],
      order: {
        kassas: { filial: { title: 'ASC' } },
      },
    });


    if (!report) {
      throw new NotFoundException('Report not found!');
    }

    const { totalOwed } = await this.filialRepository
      .createQueryBuilder('filial')
      .select('COALESCE(SUM(filial.owed), 0)', 'totalOwed')
      .where('filial.type = :type', { type: FilialType.DEALER })
      .andWhere('filial.isActive = true')
      .getRawOne();


    report['owed'] = totalOwed;

    return report;
  }

  async findOneByFilialTypes(id: string) {
    const report = await this.reportRepo.findOne({
      where: {
        id,
        kassas: {
          filial: {
            type: Not(FilialTypeEnum.WAREHOUSE),
          },
        },
      },
      relations: ['kassas', 'kassas.filial'],
    });

    if (!report) {
      throw new NotFoundException('Report not found or filial is not of type FILIAL');
    }

    return report;
  }




  async generateReportsByYear(): Promise<Report[]> {
    const year = new Date().getFullYear();
    const currentMonth = dayjs().month() + 1;

    const targetTypes: FilialTypeEnum[] = [FilialTypeEnum.FILIAL, FilialTypeEnum.DEALER, FilialTypeEnum.MARKET];

    const createdOrUpdatedReports: Report[] = [];

    for (const type of targetTypes) {
      for (let month = 1; month <= 12; month++) {
        let report = await this.reportRepo.findOne({
          where: {
            year,
            month,
            filialType: type,
          },
        });
        let reportStatus: number;
        if (month < currentMonth) {
          reportStatus = 1;
        } else if (month === currentMonth) {
          reportStatus = 2;
        } else {
          reportStatus = 3;
        }

        if (report) {
          report.reportStatus = reportStatus;
        } else {
          report = this.reportRepo.create({
            year,
            month,
            reportStatus,
            filialType: type,
          });
        }

        const saved = await this.reportRepo.save(report);
        createdOrUpdatedReports.push(saved);
      }
    }

    return createdOrUpdatedReports;
  }

  async generateReportsByYearNew(targetYear: number): Promise<Report[]> {
    const now = dayjs();

    const currentYear = now.year();
    const currentMonth = now.month() + 1;

    const targetTypes: FilialTypeEnum[] = [
      FilialTypeEnum.FILIAL,
      FilialTypeEnum.DEALER,
      FilialTypeEnum.MARKET,
    ];

    const createdOrUpdatedReports: Report[] = [];

    for (const type of targetTypes) {
      for (let month = 1; month <= 12; month++) {
        let report = await this.reportRepo.findOne({
          where: {
            year: targetYear,
            month,
            filialType: type,
          },
        });

        let reportStatus: number;

        if (targetYear < currentYear) {
          reportStatus = 1;
        } else if (targetYear > currentYear) {
          reportStatus = 3;
        } else {
          if (month < currentMonth) {
            reportStatus = 1;
          } else if (month === currentMonth) {
            reportStatus = 2;
          } else {
            reportStatus = 3;
          }
        }

        if (report) {
          report.reportStatus = reportStatus;
        } else {
          report = this.reportRepo.create({
            year: targetYear,
            month,
            reportStatus,
            filialType: type,
          });
        }

        const saved = await this.reportRepo.save(report);
        createdOrUpdatedReports.push(saved);
      }
    }

    return createdOrUpdatedReports;
  }


  // Links the kassa to the report
  async generateAndLinkReportsByYear(): Promise<Report[]> {
    const createdOrUpdatedReports = await this.generateReportsByYear();

    for (const report of createdOrUpdatedReports) {
      const kassas = await this.kassaRepo.find({
        where: {
          year: report.year,
          month: report.month,
          filialType: report.filialType,
        },
        relations: ['report'],
      });

      for (const kassa of kassas) {
        kassa.report = report;
        await this.kassaRepo.save(kassa);
      }
    }
    return createdOrUpdatedReports;
  }

  // for created new kassa
  async getOrCreateKassaForFilial(filialId: string, year: number, month: number): Promise<Kassa> {
    const currentMonth = dayjs().month() + 1;

    let kassaStatus: number;
    if (month < currentMonth) {
      kassaStatus = 1;
    } else if (month === currentMonth) {
      kassaStatus = 2;
    } else {
      kassaStatus = 3;
    }

    let report = await this.reportRepo.findOne({ where: { year, month } });

    if (!report) {
      report = this.reportRepo.create({
        year,
        month,
        reportStatus: kassaStatus,
      });
      report = await this.reportRepo.save(report);
    } else {
      if (!report.reportStatus || report.reportStatus !== kassaStatus) {
        report.reportStatus = kassaStatus;
        report = await this.reportRepo.save(report);
      }
    }

    let kassa = await this.kassaRepo.findOne({
      where: {
        filial: { id: filialId },
        year,
        month,
      },
      relations: ['report'],
    });

    if (kassa) {
      kassa.kassaStatus = kassaStatus;
      kassa.report = report;
    } else {
      kassa = this.kassaRepo.create({
        filial: { id: filialId },
        year,
        month,
        kassaStatus,
        report,
      });
    }

    return this.kassaRepo.save(kassa);
  }

  async aggregateAndSaveReport(year: number, month: number): Promise<Report[]> {
    return await this.entityManager.transaction(async (manager) => {
      const reports: Report[] = [];
      const usedFilialTypes = [FilialTypeEnum.FILIAL, FilialTypeEnum.DEALER, FilialTypeEnum.MARKET];

      // Transaction ichidagi repositorylar
      const reportRepo = manager.getRepository(Report);
      const kassaRepository = manager.getRepository(Kassa);
      const cashflowRepository = manager.getRepository(Cashflow);

      for (const type of usedFilialTypes) {
        // DEALER alohida mantiq
        if (type === FilialTypeEnum.DEALER) {
          const dealerReport = await reportRepo.findOne({
            where: { year, month, filialType: type },
          });

          if (dealerReport) {
            reports.push(dealerReport);
          }
          continue;
        }

        // 1-BOSQICH: Kassa yig'ish
        const kassas = await kassaRepository.find({
          where: {
            year,
            month,
            status: KassaProgresEnum.ACCEPTED,
            filialType: type,
          },
        });

        const kassaAggregated = {
          totalSellCount: 0,
          additionalProfitTotalSum: 0,
          netProfitTotalSum: 0,
          totalSize: 0,
          totalPlasticSum: 0,
          totalInternetShopSum: 0,
          totalSale: 0,
          totalSaleReturn: 0,
          totalCashCollection: 0,
          totalDiscount: 0,
          totalIncome: 0,
          totalExpense: 0,
          managerSum: 0,
          accountantSum: 0,
        };

        // Har bir kassani alohida logga yozish
        for (const k of kassas) {

          kassaAggregated.totalSellCount += k.totalSellCount || 0;
          kassaAggregated.additionalProfitTotalSum += k.additionalProfitTotalSum || 0;
          kassaAggregated.netProfitTotalSum += k.netProfitTotalSum || 0;
          kassaAggregated.totalSize += k.totalSize || 0;
          kassaAggregated.totalPlasticSum += k.plasticSum || 0;
          kassaAggregated.totalInternetShopSum += k.internetShopSum || 0;
          kassaAggregated.totalSale += k.sale || 0;
          kassaAggregated.totalSaleReturn += k.totalSaleReturn || 0;
          kassaAggregated.totalCashCollection += k.cash_collection || 0;
          kassaAggregated.totalDiscount += k.discount || 0;
          kassaAggregated.totalIncome += k.income || 0;
          kassaAggregated.totalExpense += k.expense || 0;
          kassaAggregated.accountantSum += (k.plasticSum + k.cash_collection) || 0;
        }

        let report = await reportRepo.findOne({
          where: { year, month, filialType: type },
        });

        if (!report) {
          report = reportRepo.create({
            year,
            month,
            filialType: type,
            ...kassaAggregated,
            reportStatus: 1,
            is_cancelled: false,
            accountantSum: 0,
            managerSum: 0,
          });
        } else {
          Object.assign(report, kassaAggregated);
        }

        await reportRepo.save(report);

        if (type === FilialTypeEnum.FILIAL) {
          const dealerReports = await reportRepo.find({
            where: {
              year,
              month,
              filialType: FilialTypeEnum.DEALER,
              status: ReportProgresEnum.ACCEPTED,
            },
          });

          // DEALER qo'shishdan oldingi holat
          const beforeDealers = {
            totalIncome: report.totalIncome,
            totalExpense: report.totalExpense,
          };

          for (const dealerReport of dealerReports) {

            await this.addDealerToFilialReport(dealerReport, manager);
          }

          if (dealerReports.length > 0) {
            report = await reportRepo.findOne({ where: { id: report.id } });
          }
        }

        // Income cashflowlarni yig'ish
        const incomeFlows = await cashflowRepository.find({
          where: {
            report: { id: report.id },
            type: CashFlowEnum.InCome,
            is_static: false,
          },
          relations: ['cashflow_type', 'createdBy', 'createdBy.position'],
          order: { date: 'ASC' },
        });

        // Income qo'shishdan oldingi holat
        const beforeIncome = {
          totalIncome: report.totalIncome,
          accountantSum: report.accountantSum,
          managerSum: report.managerSum,
        };

        let incomeAccountantTotal = 0;
        let incomeManagerTotal = 0;

        for (const cashflow of incomeFlows) {
          const user = cashflow.createdBy;
          if (!user || !user.position) {
            console.log(`    SKIP: Cashflow ID ${cashflow.id} - user yoki position yo'q`);
            continue;
          }

          const price = Math.abs(cashflow.price || 0);
          const isAccountant = user.position.role === UserRoleEnum.ACCOUNTANT;

          console.log(`    INCOME CASHFLOW:`, {
            id: cashflow.id,
            price: price,
            user: user.firstName || user.id,
            role: isAccountant ? 'ACCOUNTANT' : 'MANAGER',
            date: cashflow.date,
          });

          if (isAccountant) {
            report.accountantSum += price;
            report.totalIncome += price;
            incomeAccountantTotal += price;
          } else {
            report.totalIncome += price;
            report.managerSum += price;
            incomeManagerTotal += price;
          }
        }

        await reportRepo.save(report);
        console.log(`  3-BOSQICH TUGADI - PRIXODLAR QOSHILDI:`);
        console.log(`     Oldingi holat:`, beforeIncome);
        console.log(`     Qo'shilgan ACCOUNTANT prixodlar: ${incomeAccountantTotal}`);
        console.log(`     Qo'shilgan MANAGER prixodlar: ${incomeManagerTotal}`);
        console.log(
          `     Keyingi holat: totalIncome=${report.totalIncome}, accountantSum=${report.accountantSum}, managerSum=${report.managerSum}`,
        );

        // Expense cashflowlarni yig'ish
        console.log(`\n 4-BOSQICH: Expense cashflowlar yig'ilmoqda...`);
        const expenseCashflows = await cashflowRepository.find({
          where: {
            report: { id: report.id },
            type: CashFlowEnum.Consumption,
          },
          relations: ['cashflow_type', 'createdBy', 'createdBy.position'],
          order: { date: 'ASC' },
        });
        console.log(`  ${expenseCashflows.length} ta expense cashflow topildi`);

        // Expense qo'shishdan oldingi holat
        const beforeExpense = {
          totalExpense: report.totalExpense,
          accountantSum: report.accountantSum,
          managerSum: report.managerSum,
        };

        let expenseAccountantTotal = 0;
        let expenseManagerTotal = 0;

        for (const cashflow of expenseCashflows) {
          const user = cashflow.createdBy;
          if (!user || !user.position) {
            console.log(`    SKIP: Cashflow ID ${cashflow.id} - user yoki position yo'q`);
            continue;
          }

          const price = Math.abs(cashflow.price || 0);
          const isAccountant = user.position.role === UserRoleEnum.ACCOUNTANT;

          console.log(`    EXPENSE CASHFLOW:`, {
            id: cashflow.id,
            price: price,
            user: user.firstName || user.id,
            role: isAccountant ? 'ACCOUNTANT' : 'MANAGER',
            date: cashflow.date,
          });

          if (isAccountant) {
            if (report.accountantSum < price) {
              console.error(`ACCOUNTANT balans yetarli emas: kerak=${price}, bor=${report.accountantSum}`);
              throw new BadRequestException('Hisobingizda mablag\' yetarli emas');
            }
            report.accountantSum -= price;
            report.totalExpense += price;
            expenseAccountantTotal += price;
            console.log(`    ACCOUNTANT dan ${price} ayirildi. Qolgan: ${report.accountantSum}`);
          } else {
            if (report.managerSum < price) {
              console.error(`MANAGER balans yetarli emas: kerak=${price}, bor=${report.managerSum}`);
              throw new BadRequestException('Hisobingizda mablag\' yetarli emas');
            }
            report.managerSum -= price;
            expenseManagerTotal += price;
            report.totalExpense += price;
            console.log(`    MANAGER dan ${price} ayirildi. Qolgan: ${report.managerSum}`);
          }
        }

        await reportRepo.save(report);
        console.log(`  4-BOSQICH TUGADI - RASXODLAR AYIRILDI:`);
        console.log(`     Oldingi holat:`, beforeExpense);
        console.log(`     Ayirilgan ACCOUNTANT rasxodlar: ${expenseAccountantTotal}`);
        console.log(`     Ayirilgan MANAGER rasxodlar: ${expenseManagerTotal}`);
        console.log(
          `     Keyingi holat: totalExpense=${report.totalExpense}, accountantSum=${report.accountantSum}, managerSum=${report.managerSum}`,
        );

        // YAKUNIY REPORT HOLATI
        console.log(`\n ${type} UCHUN YAKUNIY REPORT HOLATI:`);
        console.log(`   Report ID: ${report.id}`);
        console.log(`   totalIncome: ${report.totalIncome}`);
        console.log(`   totalExpense: ${report.totalExpense}`);
        console.log(`   accountantSum: ${report.accountantSum}`);
        console.log(`   managerSum: ${report.managerSum}`);
        console.log(`   Umumiy balans: accountantSum + managerSum = ${report.accountantSum + report.managerSum}`);

        reports.push(report);
      }

      console.log(`\n=== ${reports.length} ta report tayyor bo'ldi ===`);
      return reports;
    });
  }

  async createReportsForYear(): Promise<void> {
    const year = new Date().getFullYear();
    for (let month = 1; month <= 12; month++) {
      await this.aggregateAndSaveReport(year, month);
    }
  }

  async saveReport(report: Report): Promise<Report> {
    return this.reportRepo.save(report);
  }

  async deleteReport(id: string): Promise<void> {
    const result = await this.reportRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Report not found');
    }
  }

  async findAllByYearMonthAndFilialType(year: number, month: number, filialType: FilialTypeEnum): Promise<Report[]> {
    return this.reportRepo.find({
      where: {
        year,
        month,
        filialType,
      },
      relations: ['filial'],
    });
  }

  async findOneByYearMonthAndFilialType(
    year: number,
    month: number,
    filialType: FilialTypeEnum,
  ): Promise<Report> {
    return this.reportRepo.findOne({
      where: { year, month, filialType },
    });
  }

  async closeDealerReport(id: string, user: User) {
    const userRole = user.position?.role;

    const report = await this.reportRepo.findOne({
      where: { id },
      relations: { filial: true, kassas: true },
    });

    if (!report) throw new BadRequestException('Report not found');

    if (report.filialType !== FilialTypeEnum.DEALER) {
      throw new BadRequestException('This action is allowed only for DEALER filial type!');
    }

    if (report.status === ReportProgresEnum.ACCEPTED) {
      throw new BadRequestException('Report already accepted!');
    }

    if (report.status !== ReportProgresEnum.CLOSED_BY_D && userRole !== UserRoleEnum.D_MANAGER) {
      throw new BadRequestException('Report must be closed by D_MANAGER first!');
    }

    // Kassalarni tekshirish
    const openKassas = report.kassas.filter((kassa) => kassa.status === KassaProgresEnum.OPEN || kassa.status === KassaProgresEnum.WARNING);

    if (openKassas.length > 0) {
      throw new BadRequestException('You have unclosed kassa reports');
    }

    // D_MANAGER faqat bir marta CLOSED_BY_D qiladi
    if (userRole === UserRoleEnum.D_MANAGER) {
      if (report.status === ReportProgresEnum.CLOSED_BY_D) {
        throw new BadRequestException('Report already closed by D_MANAGER!');
      }
      report.status = ReportProgresEnum.CLOSED_BY_D;
    }

    // M_MANAGER tasdiqlaydi
    if (userRole === UserRoleEnum.M_MANAGER) {
      if (report.isMManagerConfirmed) {
        throw new BadRequestException('Report already confirmed by M_MANAGER!');
      }

      await this.reportRepo.update({ id: report.id }, { isMManagerConfirmed: true });
    }

    // ACCOUNTANT tasdiqlaydi
    if (userRole === UserRoleEnum.ACCOUNTANT) {
      if (report.isAccountantConfirmed) {
        throw new BadRequestException('Report already confirmed by ACCOUNTANT!');
      }
      await this.reportRepo.update({ id: report.id }, { isAccountantConfirmed: true });
    }

    // Ikkala tasdiq bo'lsa — status ACCEPTED va qo'shiladi
    const shouldAccept = report.isMManagerConfirmed && report.isAccountantConfirmed;
    if (shouldAccept && (report.status as ReportProgresEnum) !== ReportProgresEnum.ACCEPTED) {
      report.status = ReportProgresEnum.ACCEPTED;

      const { totalOwed } = await this.filialRepository
        .createQueryBuilder('filial')
        .select('COALESCE(SUM(filial.owed), 0)', 'totalOwed')
        .where('filial.type = :type', { type: FilialType.DEALER })
        .andWhere('filial.isActive = true')
        .getRawOne();

      report.dealer_frozen_owed = totalOwed;

      // await this.moveToNextMonthDealerReport(report);
    }

    return await this.reportRepo.save(report);
  }

  async addDealerToFilialReportForManager(dealerReport: Report, manager?: EntityManager) {
    if (dealerReport.filialType !== FilialTypeEnum.DEALER) {
      return;
    }

    const reportRepo = manager ? manager.getRepository(Report) : this.reportRepo;

    const filialReport = await reportRepo.findOne({
      where: {
        year: dealerReport.year,
        month: dealerReport.month,
        filialType: FilialTypeEnum.FILIAL,
      },
    });

    if (!filialReport) {
      return;
    }

    filialReport.managerSum += dealerReport.totalIncome ?? 0;
    filialReport.managerSum -= dealerReport.totalPlasticSum ?? 0;

    await reportRepo.save(filialReport);
  }

  async addDealerToFilialReport(dealerReport: Report, manager?: EntityManager) {
    if (dealerReport.filialType !== FilialTypeEnum.DEALER) {
      return;
    }

    const reportRepo = manager ? manager.getRepository(Report) : this.reportRepo;

    const filialReport = await reportRepo.findOne({
      where: {
        year: dealerReport.year,
        month: dealerReport.month,
        filialType: FilialTypeEnum.FILIAL,
      },
    });

    if (!filialReport) {
      return;
    }

    filialReport.totalPlasticSum += dealerReport.totalPlasticSum ?? 0;
    filialReport.accountantSum += dealerReport.totalPlasticSum ?? 0;
    filialReport.managerSum += dealerReport.totalIncome ?? 0;
    filialReport.managerSum -= dealerReport.totalPlasticSum ?? 0;

    await reportRepo.save(filialReport);
  }

  async addDealerToFilialReportForAccauntant(dealerReport: Report, manager?: EntityManager) {
    if (dealerReport.filialType !== FilialTypeEnum.DEALER) {
      return;
    }

    const reportRepo = manager ? manager.getRepository(Report) : this.reportRepo;

    const filialReport = await reportRepo.findOne({
      where: {
        year: dealerReport.year,
        month: dealerReport.month,
        filialType: FilialTypeEnum.FILIAL,
      },
    });

    if (!filialReport) {
      return;
    }

    filialReport.totalPlasticSum += dealerReport.totalPlasticSum ?? 0;
    filialReport.accountantSum += dealerReport.totalPlasticSum ?? 0;

    await reportRepo.save(filialReport);
  }

  async getDealerClosedByDReports(year: number, month: number) {
    return this.reportRepo.find({
      where: {
        year,
        month,
        filialType: FilialTypeEnum.DEALER
      },
      relations: { filial: {manager: true} },
    });
  }

  async moveToNextMonthDealerReport(currentReport: Report) {
    if (currentReport.filialType !== FilialTypeEnum.DEALER) return;

    const currentMonth = dayjs()
      .month(currentReport.month - 1)
      .year(currentReport.year);

    const nextMonth = currentMonth.add(1, 'month');

    const nextMonthReport = await this.reportRepo.findOne({
      where: {
        filialType: FilialTypeEnum.DEALER,
        month: nextMonth.month() + 1,
        year: nextMonth.year(),
      },
    });

    if (!nextMonthReport) return;

    const nextKassas = await this.kassaRepo.find({
      where: {
        report: { id: nextMonthReport.id },
      },
      relations: ['filial'],
    });

    for (const nextKassa of nextKassas) {
      const previousKassa = await this.kassaRepo.findOne({
        where: {
          filial: { id: nextKassa.filial.id },
          month: currentMonth.month() + 1,
          year: currentMonth.year(),
        },
      });

      if (previousKassa) {
        nextKassa.expense += previousKassa.expense ?? 0;
        await this.kassaRepo.save(nextKassa);
      }
    }
  }

  async deleteOne(id: string): Promise<void> {
    const result = await this.reportRepo.softDelete(id);
    if (result.affected === 0) {
      throw new BadRequestException('Report not found');
    }
  }

  async restoreOne(id: string): Promise<void> {
    const result = await this.reportRepo.restore(id);
    if (result.affected === 0) {
      throw new BadRequestException('Report not found');
    }
  }

  async aggregateKassa(year: number, month: number, kassaId: string): Promise<void> {
    const report = await this.reportRepo.findOne({
      where: {
        year: year,
        month: month,
        filialType: FilialTypeEnum.DEALER,
      },
    });

    if (!report) {
      throw new BadRequestException(`${year} yil ${month} oy uchun DEALER tipi reporti topilmadi`);
    }

    const kassa = await this.kassaRepo.findOne({
      where: {
        id: kassaId,
        year: year,
        month: month,
        filialType: FilialTypeEnum.DEALER,
        status: KassaProgresEnum.ACCEPTED,
      },
    });

    if (!kassa) {
      throw new BadRequestException('Kassa topilmadi yoki u ACCEPTED holatda emas');
    }

    report.totalPlasticSum += kassa.plasticSum || 0;
    report.totalExpense += kassa.expense || 0;
    report.totalIncome += kassa.income || 0;

    await this.reportRepo.save(report);
  }

  async addManagerSum(kassaId: string): Promise<Report> {
    const kassa = await this.kassaRepo.findOne({
      where: { id: kassaId },
    });

    if (!kassa) {
      throw new NotFoundException('Kassa topilmadi');
    }

    let report = await this.reportRepo.findOne({
      where: {
        year: kassa.year,
        month: kassa.month,
        filialType: kassa.filialType,
      },
    });

    report.totalIncome += kassa.income || 0;

    await this.reportRepo.save(report);
    console.log(`  Report saqlandi`);

    return report;
  }

  async addAccauntantSum(kassaId: string): Promise<Report> {
    const kassa = await this.kassaRepo.findOne({
      where: { id: kassaId },
    });

    if (!kassa) {
      throw new NotFoundException('Kassa topilmadi');
    }

    let report = await this.reportRepo.findOne({
      where: {
        year: kassa.year,
        month: kassa.month,
        filialType: kassa.filialType,
      },
    });

    report.accountantSum += (kassa.plasticSum + kassa.cash_collection) || 0;
    report.totalPlasticSum += kassa.plasticSum || 0;
    report.totalCashCollection += kassa.cash_collection || 0;

    await this.reportRepo.save(report);
    console.log(`  Report saqlandi`);

    return report;
  }

  async addOtherSum(kassaId: string): Promise<Report> {
    const kassa = await this.kassaRepo.findOne({
      where: { id: kassaId },
    });

    if (!kassa) {
      throw new NotFoundException('Kassa topilmadi');
    }

    let report = await this.reportRepo.findOne({
      where: {
        year: kassa.year,
        month: kassa.month,
        filialType: kassa.filialType,
      },
    });
    if (!report) {
      throw new NotFoundException('Ushbu yil va oy uchun report topilmadi');
    }
    report.totalSellCount += kassa.totalSellCount || 0;
    report.additionalProfitTotalSum += kassa.additionalProfitTotalSum || 0;
    report.netProfitTotalSum += kassa.netProfitTotalSum || 0;
    report.totalSize += kassa.totalSize || 0;
    report.totalInternetShopSum += kassa.internetShopSum || 0;
    report.totalSale += kassa.sale || 0;
    report.totalSaleReturn += kassa.totalSaleReturn || 0;
    report.totalDiscount += kassa.discount || 0;
    report.totalExpense += kassa.expense || 0;

    await this.reportRepo.save(report);

    await this.kassaRepo.save(kassa);

    return report;
  }

  async save(report: Report): Promise<Report> {
    return this.reportRepo.save(report);
  }

  async changeStatusByMonth() {
    const now = dayjs();
    const nextMonth = now.add(1, 'month');
    const month = nextMonth.month() + 1;
    const year = nextMonth.year();

    const currentMonth = now.month() + 1;
    const currentYear = now.year();

    const targetTypes: FilialTypeEnum[] = [FilialTypeEnum.FILIAL, FilialTypeEnum.DEALER, FilialTypeEnum.MARKET];

    // 1. Joriy oy OPEN reportlarni WARNING ga o'zgartirish (oy tugayapti)
    const currentReports = await this.reportRepo.find({
      where: {
        month: currentMonth,
        year: currentYear,
        status: ReportProgresEnum.OPEN,
      },
    });

    for (const report of currentReports) {
      report.status = ReportProgresEnum.WARNING;
      report.reportStatus = 1; // o'tgan oy
      await this.reportRepo.save(report);
    }

    // 2. Yangi oy uchun reportlar yaratish yoki mavjudlarini OPEN qilish
    for (const type of targetTypes) {
      let report = await this.reportRepo.findOne({
        where: { year, month, filialType: type },
      });

      if (!report) {
        report = this.reportRepo.create({
          year,
          month,
          filialType: type,
          status: ReportProgresEnum.OPEN,
          reportStatus: 2, // joriy oy
        });
        await this.reportRepo.save(report);
      } else if (report.status === ReportProgresEnum.OPEN) {
        report.reportStatus = 2;
        await this.reportRepo.save(report);
      }
    }
  }

  async update(id: string, data) {
    await this.reportRepo.update({ id }, { ...data });
  }

  async bossReport(from: string | Date, to: string | Date, filial?: string): Promise<BossReport> {
    if (!from || !to) {
      throw new Error('`from` and `to` are required');
    }

    // normalize dates to be inclusive on the end (<= to)
    // If caller already passes Date objects with times set, this is still fine.
    const fromParam = from instanceof Date ? from : new Date(from);
    const toParam = to instanceof Date ? to : new Date(to);

    const qb = this.entityManager.getRepository(Cashflow)
      .createQueryBuilder('cf')
      .leftJoin('cf.cashflow_type', 'ct')
      .leftJoin('cf.filial', 'filial')
      .where('cf.is_cancelled = false')
      .andWhere('cf.date >= :from AND cf.date <= :to', { from: fromParam, to: toParam });

    if (filial) {
      // Works whether `filial` is an id or entity relation (TypeORM will compare by FK)
      qb.andWhere('cf.filial = :filial', { filial });
    }

    // Use SUM(CASE ...) so this runs regardless of DB settings (FILTER works in Postgres, but CASE is portable)
    qb.select([
      // overall totals
      `COALESCE(SUM(cf.price), 0)                                           AS total_all`,
      `COALESCE(SUM(CASE WHEN cf.type = 'Приход' THEN cf.price END), 0)     AS total_income`,
      `COALESCE(SUM(CASE WHEN cf.type = 'Расход' THEN cf.price END), 0)     AS total_consumption`,

      // by tip (cashflow)
      `COALESCE(SUM(CASE WHEN cf.tip = 'cashflow' AND cf.type = 'Приход' THEN cf.price END), 0) AS cashflow_income`,
      `COALESCE(SUM(CASE WHEN cf.tip = 'cashflow' AND cf.type = 'Расход' THEN cf.price END), 0) AS cashflow_consumption`,

      // by tip (order)
      `COALESCE(SUM(CASE WHEN cf.tip = 'order' AND cf.type = 'Приход' THEN cf.price END), 0) AS order_income`,
      `COALESCE(SUM(CASE WHEN cf.tip = 'order' AND cf.type = 'Расход' THEN cf.price END), 0)  AS order_consumption`,

      // by tip (debt)
      `COALESCE(SUM(CASE WHEN cf.tip = 'debt' AND cf.type = 'Приход' THEN cf.price END), 0)   AS debt_income`,
      `COALESCE(SUM(CASE WHEN cf.tip = 'debt' AND cf.type = 'Расход' THEN cf.price END), 0)    AS debt_consumption`,

      // ONLY "debt inside order" (tip='order' AND linked debt)
      `COALESCE(SUM(CASE WHEN cf.tip = 'order' AND cf.debt IS NOT NULL AND cf.type = 'Приход' THEN cf.price END), 0) AS order_debt_income`,
      `COALESCE(SUM(CASE WHEN cf.tip = 'order' AND cf.debt IS NOT NULL AND cf.type = 'Расход' THEN cf.price END), 0)  AS order_debt_consumption`,

      // income by specific cashflow_type slugs (only Приход)
      `COALESCE(SUM(CASE WHEN cf.type = 'Приход' AND ct.slug = 'manager'  THEN cf.price END), 0) AS income_manager`,
      `COALESCE(SUM(CASE WHEN cf.type = 'Приход' AND ct.slug = 'bugalter' THEN cf.price END), 0) AS income_bugalter`,
    ]);

    const row = await qb.getRawOne<{
      total_all: string | number;
      total_income: string | number;
      total_consumption: string | number;

      cashflow_income: string | number;
      cashflow_consumption: string | number;

      order_income: string | number;
      order_consumption: string | number;

      debt_income: string | number;
      debt_consumption: string | number;

      order_debt_income: string | number;
      order_debt_consumption: string | number;

      income_manager: string | number;
      income_bugalter: string | number;
    }>();

    const num = (v: string | number | null | undefined) => Number(v ?? 0);

    return {
      period: { from: fromParam, to: toParam, filial },
      totals: {
        total: num(row?.total_all),
        income: num(row?.total_income),
        consumption: num(row?.total_consumption),
      },
      byTip: {
        cashflow: {
          income: num(row?.cashflow_income),
          consumption: num(row?.cashflow_consumption),
          total: num(row?.cashflow_income) + num(row?.cashflow_consumption),
        },
        order: {
          income: num(row?.order_income),
          consumption: num(row?.order_consumption),
          total: num(row?.order_income) + num(row?.order_consumption),
        },
        debt: {
          income: num(row?.debt_income),
          consumption: num(row?.debt_consumption),
          total: num(row?.debt_income) + num(row?.debt_consumption),
        },
        orderDebtOnly: {
          income: num(row?.order_debt_income),
          consumption: num(row?.order_debt_consumption),
          total: num(row?.order_debt_income) + num(row?.order_debt_consumption),
        },
      },
      incomeBySlug: {
        manager: num(row?.income_manager),
        accountant: num(row?.income_bugalter),
      },
    };
  }

  async bossCurrentMonth({ filial_id, startDate, endDate, month, year }: {
    filial_id: string,
    startDate: Date,
    endDate: Date,
    month: number,
    year: number
  }) {
    const cacheKey = `bossCurrentMonth:${filial_id || 'all'}:${startDate?.toISOString()}:${endDate?.toISOString()}:${month || 'month'}:${year || 'year'}`;
    const cacheTTL = 180; // 3 minutes

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const qb = this.packageTransfer.createQueryBuilder('pt')
      .select([
        'COALESCE(SUM(pt.total_sum), 0)::NUMERIC(20, 2) AS total_sum',
        'COALESCE(SUM(pt.total_profit_sum), 0)::NUMERIC(20, 2) AS total_profit_sum',
        'COALESCE(SUM(pt.total_kv), 0)::NUMERIC(20, 2) AS total_kv',
        'COALESCE(SUM(pt.total_count), 0)::NUMERIC(20, 2) AS total_count',
      ])
      .where('pt.status = :status', { status: PackageTransferEnum.Accept });

    const order_qb = this.orderRepo.createQueryBuilder('ord')
      .leftJoin('ord.bar_code', 'bar_code')
      .leftJoin('ord.kassa', 'kassa')
      .select([
        `COALESCE(SUM(ord.price + ord.plasticSum), 0)::NUMERIC(20, 2) AS total_sum`,
        `COALESCE(SUM(ord.kv), 0)::NUMERIC(20, 2) AS total_kv`,
        `COALESCE(SUM(ord.netProfitSum), 0)::NUMERIC(20, 2) AS total_profit_sum`,
        `COALESCE(SUM(ord."discountSum"), 0)::NUMERIC(20, 2) AS total_discount_sum  `,
        `
      SUM(CASE
        WHEN bar_code.isMetric = true THEN 1
        ELSE ord.x
      END)::NUMERIC(20, 2) as total_count
      `,
        `
      SUM(CASE
        WHEN ord.status = 'canceled' THEN ord.price + ord."plasticSum"
        ELSE 0
      END)::NUMERIC(20, 2) as total_return
      `,
        `
      SUM(CASE
        WHEN ord.status = 'canceled' THEN ord.kv
        ELSE 0
      END)::NUMERIC(20, 2) as total_return_kv
      `,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.price ELSE 0 END), 0)::NUMERIC(20, 2) as total_debt_sum`,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.kv ELSE 0 END), 0)::NUMERIC(20, 2) as total_debt_kv`,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord."netProfitSum" ELSE 0 END), 0)::NUMERIC(20, 2) as total_debt_profit_sum`,
        `
      SUM(CASE
        WHEN ord.isDebt = true THEN CASE WHEN bar_code.isMetric = true THEN 1 ELSE ord.x END
        ELSE 0
      END)::NUMERIC(20, 2) as total_debt_count
      `,
      ])
      .where('ord.status IN (:...status)', { status: [OrderEnum.Accept, OrderEnum.Cancel] });

    const [accountant, manager] = await Promise.all([
      this.userRepository.findOne({ where: { isActive: true, position: { role: UserRoleEnum.ACCOUNTANT } } }),
      this.userRepository.findOne({ where: { isActive: true, position: { role: UserRoleEnum.M_MANAGER } } }),
    ]);

    const accountant_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.type = 'Приход' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_income,
      SUM(CASE WHEN cash.type = 'Расход' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_expense
    `)
      .where('cash.createdById = :accountant', { accountant: accountant.id });

    const manager_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.type = 'Приход' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_income,
      SUM(CASE WHEN cash.type = 'Расход' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_expense
    `)
      .where('cash.createdById = :manager', { manager: manager.id });

    const boss_qb = this.cashflowRepository.createQueryBuilder('cash')
      .leftJoin('cash.cashflow_type', 'cash_type')
      .select(`
      SUM(COALESCE(cash.price, 0))::NUMERIC(20, 2) AS total_expense,
      SUM(CASE WHEN cash_type.slug = 'Bos' THEN COALESCE(cash.price, 0) ELSE 0 END)::NUMERIC(20, 2) AS boss_expense
    `)
      .where('cash_type.slug NOT IN (:...excluded)', { excluded: ['factory', 'tamojnya', 'manager', 'bugalter'] })
      .andWhere('cash.type = :type', { type: 'Расход' });

    if (filial_id) {
      order_qb.andWhere('kassa.filialId = :filial_id', { filial_id });
      boss_qb.andWhere('cash.filialId = :filial_id', { filial_id });
    }

    const currentYear = dayjs().year();
    const y = year ? Number(year) : currentYear;

    const monthStart = dayjs(`${y}-${month}-01`).startOf('month').toDate();
    const monthEnd = dayjs(`${y}-${month}-01`).endOf('month').toDate();

    let finalStart;
    let finalEnd;

    if (startDate && endDate) {
      finalStart = new Date(startDate);
      finalEnd = new Date(endDate);

    } else if (startDate) {
      finalStart = new Date(startDate);
      finalEnd = monthEnd;

    } else if (endDate) {
      finalStart = monthStart;
      finalEnd = new Date(endDate);

    } else {
      finalStart = monthStart;
      finalEnd = monthEnd;
    }

    qb.andWhere('pt.updatedAt BETWEEN :finalStart AND :finalEnd', { finalStart, finalEnd });
    order_qb.andWhere('ord.date BETWEEN :finalStart AND :finalEnd', { finalStart, finalEnd });
    manager_qb.andWhere('cash.date BETWEEN :finalStart AND :finalEnd', { finalStart, finalEnd });
    accountant_qb.andWhere('cash.date BETWEEN :finalStart AND :finalEnd', { finalStart, finalEnd });
    boss_qb.andWhere('cash.date BETWEEN :finalStart AND :finalEnd', { finalStart, finalEnd });

    let resultData;

    if (filial_id === '#dealers') {
      const [result, manager_result, accountant_result] = await Promise.all([
        qb.getRawOne(),
        manager_qb.getRawOne(),
        accountant_qb.getRawOne(),
      ]);

      resultData = {
        totals: {
          total_sum: Number(result.total_sum),
          total_profit_sum: Number(result.total_profit_sum),
          total_kv: Number(result.total_kv),
          total_count: Number(result.total_count),
        },
        manager: {
          id: manager.id,
          income: Number(manager_result.total_income),
          expense: Number(manager_result.total_expense),
        },
        accountant: {
          id: accountant.id,
          income: Number(accountant_result.total_income),
          expense: Number(accountant_result.total_expense),
        },
        order: { total_sum: 0, total_profit_sum: 0, total_kv: 0, total_count: 0 },
        debt_order: {
          total_kv: Number(result.total_kv),
          total_sum: Number(result.total_sum),
          total_count: Number(result.total_count),
          total_profit_sum: Number(result.total_profit_sum),
        },
        boss: {
          total_expense: 0,
          boss_expense: 0,
        },
      };
    } else {
      const [result, order_result, manager_result, accountant_result, boss_result] = await Promise.all([
        qb.getRawOne(),
        order_qb.getRawOne(),
        manager_qb.getRawOne(),
        accountant_qb.getRawOne(),
        boss_qb.getRawOne(),
      ]);

      resultData = {
        totals: {
          total_sum: +((Number(result.total_sum) + Number(order_result.total_sum)).toFixed(2)),
          total_profit_sum: +((Number(result.total_profit_sum) + Number(order_result.total_profit_sum)).toFixed(2)),
          total_kv: +((Number(result.total_kv) + Number(order_result.total_kv)).toFixed(2)),
          total_count: +((Number(result.total_count) + Number(order_result.total_count)).toFixed(2)),
        },
        manager: {
          id: manager.id,
          income: Number(manager_result.total_income),
          expense: Number(manager_result.total_expense),
        },
        accountant: {
          id: accountant.id,
          income: Number(accountant_result.total_income),
          expense: Number(accountant_result.total_expense),
        },
        order: {
          total_sum: Number(order_result.total_sum),
          total_profit_sum: Number(order_result.total_profit_sum),
          total_kv: Number(order_result.total_kv),
          total_count: Number(order_result.total_count),
          total_discount_sum: Number(order_result.total_discount_sum),
          total_return: Number(order_result.total_return),
          total_return_kv: Number(order_result.total_return_kv),
        },
        debt_order: {
          total_kv: +((Number(result.total_kv) + Number(order_result.total_debt_kv)).toFixed(2)),
          total_sum: +((Number(result.total_sum) + Number(order_result.total_debt_sum)).toFixed(2)),
          total_count: +((Number(result.total_count) + Number(order_result.total_debt_count)).toFixed(2)),
          total_profit_sum: +((Number(result.total_profit_sum) + Number(order_result.total_debt_profit_sum)).toFixed(2)),
        },
        boss: {
          total_expense: Number(boss_result?.total_expense),
          boss_expense: Number(boss_result?.boss_expense),
        },
      };
    }

    await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', cacheTTL);
    return resultData;
  }

  async bossCurrLeft({ filialId, month, year }) {
    const cacheKey = `bossCurrentLeft:${filialId || 'all'}:${month}:${year}`;
    const cacheTTL = 180; // 3 minutes in seconds

    // 1. Try to get from cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }


    const dealer_qb = this.filialRepository
      .createQueryBuilder('filial')
      .select([
        `COALESCE(SUM(filial.owed), 0)::NUMERIC(20, 2) as total_owed,
         COALESCE(SUM(filial.given), 0)::NUMERIC(20, 2) as total_give`,
      ])
      .where('filial.type = :type', { type: FilialType.DEALER })
      .andWhere('filial.isActive = true');

    const latestPriceSubQuery = this.dataSource
      .createQueryBuilder()
      .select('DISTINCT ON (cp."collectionId") cp."collectionId"', 'collectionId')
      .addSelect('cp."priceMeter"', 'priceMeter')
      .addSelect('cp."comingPrice"', 'comingPrice')
      .from('collection-price', 'cp')
      .where(`cp.type = 'filial'`)
      .orderBy('cp."collectionId"')
      .addOrderBy('cp."date"', 'DESC');

    const baseWhere = [
      'p.count > 0',
      'p.y > 0.1',
      'p.is_deleted = false',
      `f.type != 'dealer'`,
    ];

    let dateFilter: Date | null = null;
    if (month && year) {
      // JS months are 0-based, so month + 1 then day 0 gives last day of desired month
      dateFilter = new Date(+year, +month, 0, 23, 59, 59);
    }

    if (filialId) baseWhere.push('p."filialId" = :filialId');
    if (dateFilter) baseWhere.push('p.date <= :dateFilter');

    const product_qb = this.productRepo
      .createQueryBuilder('p')
      .select([
        `COALESCE(SUM(s.x * p.y * p.count), 0)::NUMERIC(20, 2) as "totalKv"`,
        `COALESCE(SUM(p.count), 0) as "totalCount"`,
        `COALESCE(SUM(s.x * p.count * p.y * lp."priceMeter"), 0)::NUMERIC(20, 2) as "totalPrice"`,
        `COALESCE(SUM(s.x * p.count * p.y * lp."comingPrice"), 0)::NUMERIC(20, 2) as "comingPrice"`,
      ])
      .innerJoin('p.bar_code', 'q')
      .innerJoin('q.size', 's')
      .innerJoin('q.collection', 'c')
      .innerJoin(`(${latestPriceSubQuery.getQuery()})`, 'lp', 'c.id = lp."collectionId"')
      .innerJoin('p.filial', 'f')
      .where(baseWhere.join(' AND '))
      .setParameters({
        ...latestPriceSubQuery.getParameters(),
        filialId,
        dateFilter,
      });

    const kents_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE
               WHEN cash.type = 'Приход'
                   THEN price
               ELSE 0 END)::NUMERIC(20, 2) AS total_sum,
       SUM(CASE
               WHEN cash.type = 'Расход'
                   THEN price
               ELSE 0 END)::NUMERIC(20, 2) AS total_expense
      `)
      .leftJoin('cash.cashflow_type', 'cashflow_type')
      .where('cashflow_type.slug = :slug', { slug: 'dolg' });

    const qb = this.packageTransfer.createQueryBuilder('pt')
      .select([
        'COALESCE(SUM(pt.total_sum), 0)::NUMERIC(20, 2) AS total_sum',
        'COALESCE(SUM(pt.total_profit_sum), 0)::NUMERIC(20, 2) AS total_profit_sum',
        'COALESCE(SUM(pt.total_kv), 0)::NUMERIC(20, 2) AS total_kv',
        'COALESCE(SUM(pt.total_count), 0)::NUMERIC(20, 2) AS total_count',
      ])
      .where('pt.status = :status', { status: PackageTransferEnum.Accept });

    const order_qb = this.orderRepo.createQueryBuilder('ord')
      .leftJoin('ord.bar_code', 'bar_code')
      .leftJoin('ord.kassa', 'kassa')
      .select([
        `COALESCE(SUM(ord.price + ord.plasticSum), 0)::NUMERIC(20, 2) AS total_sum`,
        `COALESCE(SUM(ord.kv), 0)::NUMERIC(20, 2) AS total_kv`,
        `COALESCE(SUM(ord.netProfitSum), 0)::NUMERIC(20, 2) AS total_profit_sum`,
        `
      SUM(CASE
        WHEN bar_code.isMetric = true THEN 1
        ELSE ord.x
      END)::NUMERIC(20, 2) as total_count
      `,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.price ELSE 0 END), 0)::NUMERIC(20, 2) as total_debt_sum`,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.kv ELSE 0 END), 0)::NUMERIC(20, 2) as total_debt_kv`,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.netProfitSum ELSE 0 END), 0)::NUMERIC(20, 2) as total_debt_profit_sum`,
        `
      SUM(CASE
        WHEN ord.isDebt = true THEN CASE WHEN bar_code.isMetric = true THEN 1 ELSE ord.x END
        ELSE 0
      END)::NUMERIC(20, 2) as total_debt_count
      `,
      ])
      .where('ord.status = :status', { status: OrderEnum.Accept });

    const [dealer_totals, product_totals, kents_result, result, order_result] = await Promise.all([
      dealer_qb.getRawOne(),
      product_qb.getRawOne(),
      kents_qb.getRawOne(),
      qb.getRawOne(),
      order_qb.getRawOne(),
    ]);

    const resultData = {
      totals: {
        total_sum: +((Number(result.total_sum) + Number(order_result.total_sum)).toFixed(2)),
        total_profit_sum: +((Number(result.total_profit_sum) + Number(order_result.total_profit_sum)).toFixed(2)),
        total_kv: +((Number(result.total_kv) + Number(order_result.total_kv)).toFixed(2)),
        total_count: +((Number(result.total_count) + Number(order_result.total_count)).toFixed(2)),
      },
      dealer: {
        total_give: Number(dealer_totals?.total_give),
        total_owed: Number(dealer_totals?.total_owed),
      },
      product: {
        total_kv: Number(product_totals.totalKv),
        total_sum: Number(product_totals.totalPrice),
        total_profit_sum: Number(product_totals.comingPrice),
        total_count: Number(product_totals.totalCount),
      },
      kents: {
        income: Number(kents_result.total_sum),
        expense: Number(kents_result.total_expense),
        debt_balance: Number((Number(kents_result.total_sum) - Number(kents_result.total_expense)).toFixed(2)),
      },
      filial_plan_totals: null,
      user_plan_totals: null,
    };

    await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', cacheTTL);


    return resultData;
  }

  async expense_cashflow({ filial_id, year, month, cashflow_type, page = 1, limit = 10 }) {
    const offset = (page - 1) * limit;

    const cacheKey = `bossCurrentMontExpense:${filial_id || 'all'}:${month}:${year}:${cashflow_type}:${page}`;
    const cacheTTL = 180; // 3 minutes in seconds

    // 1. Try to get from cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    if (filial_id === '#dealers') {
      return {
        items: [],
        meta: {
          total: 0,
          page,
          lastPage: Math.ceil(0 / limit),
          limit,
        },
        totals: {
          boss: 0,
          kassa: 0,
          business: 0,
        },
      };
    }

    const cashflow_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select([
        'cash.id',
        'cash.price',
        'cash.type',
        'cash.tip',
        'cash.comment',
        'cash.title',
        'cash.date',
        'cash.is_online',
      ])
      .addSelect([
        'cashflow_type.id',
        'cashflow_type.title',
        'cashflow_type.slug',
        'cashflow_type.type',
      ])
      .leftJoin('cash.cashflow_type', 'cashflow_type')
      .addSelect([
        'createdBy.id',
        'createdBy.firstName',
        'createdBy.lastName',
      ])
      .leftJoin('cash.createdBy', 'createdBy')
      .addSelect([
        'avatar.id',
        'avatar.path',
        'avatar.mimetype',
        'avatar.name',
      ])
      .leftJoin('createdBy.avatar', 'avatar')
      .where('cash.type = :type', { type: 'Расход' })
      .andWhere('cash.tip != :tip', { tip: 'order' })
      .offset(offset)
      .limit(limit)
      .orderBy('cash.date', 'DESC');

    const total_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(COALESCE(cash.price, 0)) FILTER (WHERE cash_type.slug NOT IN ('Bos', 'manager', 'bugalter'))::NUMERIC(20,2) AS business_expense,
      SUM(COALESCE(cash.price, 0)) FILTER (WHERE cash_type.slug = 'Bos')::NUMERIC(20,2) AS boss_expense,
      SUM(COALESCE(cash.price, 0)) FILTER (WHERE cash_type.slug IN ('manager', 'bugalter'))::NUMERIC(20,2) AS kassa_expense
    `)
      .leftJoin('cash.cashflow_type', 'cash_type')
      .where('cash_type.slug NOT IN (:...excluded)', { excluded: ['factory', 'tamojnya', 'navar'] })
      .andWhere('cash.type = :type', { type: 'Расход' })
      .andWhere('cash.tip != :tip', { tip: 'order' });

    if (filial_id) {
      cashflow_qb.andWhere('cash.filialId = :filial_id', { filial_id });
      total_qb.andWhere('cash.filialId = :filial_id', { filial_id });
    }

    if (cashflow_type) {
      cashflow_qb.andWhere('cashflow_type.id = :cashflow_type', { cashflow_type });
      total_qb.andWhere('cash_type.id = :cashflow_type', { cashflow_type });
    }

    if (month) {
      const currentYear = dayjs().year();
      const y = year ? Number(year) : currentYear;

      const startDate = dayjs(`${y}-${month}-01`).startOf('month').toDate();
      const endDate = dayjs(`${y}-${month}-01`).endOf('month').toDate();

      cashflow_qb.andWhere(`cash.date BETWEEN :startDate AND :endDate`, { startDate, endDate });
      total_qb.andWhere(`cash.date BETWEEN :startDate AND :endDate`, { startDate, endDate });
    }

    const [[items, total], totals] = await Promise.all([
      cashflow_qb.getManyAndCount(),
      total_qb.getRawOne(),
    ]);

    const resultData = {
      items,
      meta: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        itemCount: limit,
      },
      totals: {
        boss: Number(totals.boss_expense || 0),
        kassa: Number(totals.kassa_expense || 0),
        business: Number(totals.business_expense || 0),
      },
    };

    await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', cacheTTL);

    return resultData;
  }

  async expense_managers({ filial_id, user_id, type, cashflow_type, month, year, page, limit }) {
    const cacheKey = `bossCurrentMonthManagers:${filial_id || 'all'}:${user_id}:${month}:${year}:${type}:${cashflow_type}:${page}`;
    const cacheTTL = 180;

    // 1. Try to get from cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const offset = (page - 1) * limit;

    const cashflow_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select([
        'cash.id',
        'cash.price',
        'cash.type',
        'cash.tip',
        'cash.comment',
        'cash.title',
        'cash.date',
        'cash.is_online',
      ])
      .addSelect([
        'cashflow_type.id',
        'cashflow_type.title',
        'cashflow_type.slug',
        'cashflow_type.type',
      ])
      .leftJoin('cash.cashflow_type', 'cashflow_type')
      .addSelect([
        'createdBy.id',
        'createdBy.firstName',
        'createdBy.lastName',
      ])
      .leftJoin('cash.createdBy', 'createdBy')
      .addSelect([
        'avatar.id',
        'avatar.path',
        'avatar.mimetype',
        'avatar.name',
      ])
      .leftJoin('createdBy.avatar', 'avatar')
      .leftJoin('cash.filial', 'filial')
      .where('createdBy.id = :user_id', { user_id })
      .offset(offset)
      .limit(limit)
      .orderBy('cash.date', 'DESC');

    const total_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.type = 'Приход' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_income,
      SUM(CASE WHEN cash.type = 'Расход' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_expense
    `)
      .leftJoin('cash.cashflow_type', 'cashflow_type')
      .leftJoin('cash.filial', 'filial')
      .where('cash.createdById = :user_id', { user_id });

    if (type) {
      cashflow_qb.andWhere('cash.type = :type', { type });
      total_qb.andWhere('cash.type = :type', { type });
    }

    if (cashflow_type) {
      cashflow_qb.andWhere('cashflow_type.id = :cashflow_type', { cashflow_type });
      total_qb.andWhere('cashflow_type.id = :cashflow_type', { cashflow_type });
    }

    if (month) {
      const currentYear = dayjs().year();
      const y = year ? Number(year) : currentYear;

      const startDate = dayjs(`${y}-${month}-01`).startOf('month').toDate();
      const endDate = dayjs(`${y}-${month}-01`).endOf('month').toDate();

      cashflow_qb.andWhere(`cash.date BETWEEN :startDate AND :endDate`, { startDate, endDate });
      total_qb.andWhere(`cash.date BETWEEN :startDate AND :endDate`, { startDate, endDate });
    }

    if (filial_id === '#dealers') {
      cashflow_qb.andWhere('filial.type = :type', { type: 'dealer' });
      total_qb.andWhere('filial.type = :type', { type: 'dealer' });
    } else if (filial_id) {
      cashflow_qb.andWhere('cash.filialId = :filial_id', { filial_id });
      total_qb.andWhere('cash.filialId = :filial_id', { filial_id });
    }


    const [[items, total], totals] = await Promise.all([
      cashflow_qb.getManyAndCount(),
      total_qb.getRawOne(),
    ]);

    const resultData = {
      items,
      meta: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        itemCount: limit,
      },
      totals: {
        total_income: Number(totals.total_income || 0),
        total_expense: Number(totals.total_expense || 0),
      },
    };

    await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', cacheTTL);

    return resultData;
  }

  async kents({ debt_id, type, month, year, page = 1, limit = 20 }) {
    const cacheKey = `bossCurrentLeftKents:${debt_id || 'all'}:${month}:${year}:${type}:${page}`;
    const cacheTTL = 180;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const offset = (page - 1) * limit;

    // Year handling
    const y = year ? Number(year) : dayjs().year();

    let startDate: Date = null;
    let endDate: Date = null;

    if (month) {
      startDate = dayjs(`${y}-${month}-01`).startOf('month').toDate();
      endDate = dayjs(`${y}-${month}-01`).endOf('month').toDate();
    }

    const cashflow_qb = this.cashflowRepository
      .createQueryBuilder('cash')
      .select([
        'cash.id',
        'cash.price',
        'cash.type',
        'cash.tip',
        'cash.comment',
        'cash.title',
        'cash.date',
        'cash.is_online',
      ])
      .leftJoin('cash.cashflow_type', 'cashflow_type')
      .addSelect(['cashflow_type.id', 'cashflow_type.title', 'cashflow_type.slug'])
      .leftJoin('cash.debt', 'debt')
      .addSelect(['createdBy.id', 'createdBy.firstName', 'createdBy.lastName'])
      .leftJoin('cash.createdBy', 'createdBy')
      .addSelect(['avatar.id', 'avatar.path', 'avatar.mimetype', 'avatar.name'])
      .leftJoin('createdBy.avatar', 'avatar')
      .addSelect(['debt.id', 'debt.fullName'])
      .where('cashflow_type.slug = :slug', { slug: 'dolg' })
      .orderBy('cash.date', 'DESC')
      .offset(offset)
      .limit(limit);

    if (debt_id) {
      cashflow_qb.andWhere('debt.id = :debt_id', { debt_id });
    } else {
      cashflow_qb.andWhere('debt.id IS NOT NULL');
    }

    if (startDate && endDate) {
      cashflow_qb.andWhere('cash.date BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    }

    if (type) {
      cashflow_qb.andWhere('cash.type = :type', { type });
    }

    const total_qb = this.cashflowRepository
      .createQueryBuilder('cash')
      .select(`
        SUM(CASE WHEN cash.type = 'Приход' THEN cash.price ELSE 0 END)::NUMERIC(20,2) AS total_income,
        SUM(CASE WHEN cash.type = 'Расход' THEN cash.price ELSE 0 END)::NUMERIC(20,2) AS total_expense
    `)
      .leftJoin('cash.cashflow_type', 'cashflow_type')
      .leftJoin('cash.debt', 'debt')
      .where('cashflow_type.slug = :slug', { slug: 'dolg' });

    if (debt_id) {
      total_qb.andWhere('debt.id = :debt_id', { debt_id });
    } else {
      total_qb.andWhere('debt.id IS NOT NULL');
    }

    if (startDate && endDate) {
      total_qb.andWhere('cash.date BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    }

    if (type) {
      total_qb.andWhere('cash.type = :type', { type });
    }

    const [[items, total], totals] = await Promise.all([
      cashflow_qb.getManyAndCount(),
      total_qb.getRawOne(),
    ]);

    const resultData = {
      items,
      meta: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        itemCount: limit,
      },
      totals: {
        total_income: Number(totals.total_income || 0),
        total_expense: Number(totals.total_expense || 0),
        kents_balance: Number(
          (Number(totals.total_income || 0) - Number(totals.total_expense || 0)).toFixed(2),
        ),
      },
    };

    await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', cacheTTL);

    return resultData;
  }

  async prodaja({ filial, month, type, year, page, limit }) {
    const cacheKey = `bossCurrentLeftProdaja:${filial || 'all'}:${month || 'auto'}:${year || 'auto'}:${type}:${page}`;
    const cacheTTL = 180;
    const offset = (page - 1) * limit;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // ---------------------------
    //  Default month / year
    // ---------------------------
    const now = dayjs();
    const y = year ? Number(year) : now.year();
    const m = month ? Number(month) : now.month() + 1;

    const startDate = dayjs(`${y}-${m}-01`).startOf('month').toDate();
    const endDate = dayjs(`${y}-${m}-01`).endOf('month').toDate();

    // ---------------------------
    // Dealers special route
    // ---------------------------
    if (filial === '#dealers') {
      const resultData = await this.getByPackage({
        mode: 'list',
        month: m,
        year: y,
        package_id: null,
        page,
        limit,
        toId: null,
        search: null,
      });

      // await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', cacheTTL);

      return resultData;
    }

    // ---------------------------
    //  MAIN LIST QUERY
    // ---------------------------
    const orders_qb = this.orderRepo.createQueryBuilder('o')
      .select([
        'o.id',
        'o.date',
        'o.x',
        'o.price',
        'o.plasticSum',
        'o.isDebt',
        'seller.id',
        'seller.firstName',
        'seller.lastName',
        'createdBy.id',
        'createdBy.firstName',
        'createdBy.lastName',
        's_avatar.id',
        's_avatar.path',
        's_avatar.mimetype',
        's_avatar.name',
        'c_avatar.id',
        'c_avatar.path',
        'c_avatar.mimetype',
        'c_avatar.name',
        'product.id',
        'product.y',
        'bar_code.id',
        'bar_code.isMetric',
        'bar_code.code',
        'col.id',
        'col.title',
        'm.id',
        'm.title',
        'sz.id',
        'sz.title',
        'cl.id',
        'cl.title',
      ])
      .leftJoin('o.seller', 'seller')
      .leftJoin('seller.avatar', 's_avatar')
      .leftJoin('o.createdBy', 'createdBy')
      .leftJoin('createdBy.avatar', 'c_avatar')
      .leftJoin('o.product', 'product')
      .leftJoin('o.bar_code', 'bar_code')
      .leftJoin('bar_code.collection', 'col')
      .leftJoin('bar_code.model', 'm')
      .leftJoin('bar_code.size', 'sz')
      .leftJoin('bar_code.color', 'cl')
      .leftJoin('o.kassa', 'k')
      .where('o.status = :status', { status: 'accepted' })
      .andWhere('o.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('o.date', 'DESC')
      .offset(offset)
      .limit(limit);

    if (filial) {
      orders_qb.andWhere('k.filialId = :filial', { filial });
    }

    if (type === 'debt') {
      orders_qb.andWhere('o.isDebt = true');
    } else if (type === 'order') {
      orders_qb.andWhere('o.isDebt = false');
    }

    // ---------------------------
    // TOTALS QUERY
    // ---------------------------
    const order_qb_totals = this.orderRepo.createQueryBuilder('o')
      .select([
        `COALESCE(SUM(o.price + o.plasticSum), 0)::NUMERIC(20,2) AS total_sum`,
        `COALESCE(SUM(o.netProfitSum), 0)::NUMERIC(20,2) AS total_profit_sum`,
        `COALESCE(SUM(o.kv), 0)::NUMERIC(20,2) AS total_kv`,
        `COALESCE(SUM(o.additionalProfitSum), 0)::NUMERIC(20,2) AS total_additional_profit_sum`,
        `COALESCE(SUM(CASE WHEN bar_code.isMetric = TRUE THEN 1 ELSE o.x END), 0)::NUMERIC(20, 2) AS total_count`,
      ])
      .leftJoin('o.bar_code', 'bar_code')
      .leftJoin('o.kassa', 'k')
      .where('o.status = :status', { status: 'accepted' })
      .andWhere('o.date BETWEEN :startDate AND :endDate', { startDate, endDate });

    if (filial) {
      order_qb_totals.andWhere('k.filialId = :filial', { filial });
    }

    if (type === 'debt') {
      order_qb_totals.andWhere('o.isDebt = true');
    } else if (type === 'order') {
      order_qb_totals.andWhere('o.isDebt = false');
    }

    // ---------------------------
    // EXECUTE QUERIES
    // ---------------------------
    const [[items, total], totals] = await Promise.all([
      orders_qb.getManyAndCount(),
      order_qb_totals.getRawOne(),
    ]);

    const result = {
      items,
      meta: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        itemCount: limit,
      },
      totals: {
        total_sum: Number(totals.total_sum || 0),
        total_count: Number(totals.total_count || 0),
        total_additional_profit_sum: Number(totals.total_additional_profit_sum || 0),
        total_profit_sum: Number(totals.total_profit_sum || 0),
        total_kv: Number(totals.total_kv || 0),
      },
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', cacheTTL);

    return result;
  }

  async getByPackage({
                       mode = 'list',
                       package_id,
                       toId,
                       page = 1,
                       limit = 10,
                       search,
                       month,
                       year,
                     }) {
    if (!['list', 'collection', 'country', 'factory'].includes(mode)) {
      throw new BadRequestException(`Invalid mode: ${mode}`);
    }
    const offset = (page - 1) * limit;

    const d_manager = await this.userRepository.findOne({
      where: { position: { role: UserRoleEnum.D_MANAGER } },
      relations: { avatar: true },
    });

    // Optional month/year filter
    let startOfMonth: Date | null = null;
    let endOfMonth: Date | null = null;
    let hasDateFilter = false;

    if (month && year) {
      hasDateFilter = true;
      const filterMonth = Number(month);
      const filterYear = Number(year);
      startOfMonth = dayjs(`${filterYear}-${filterMonth}-01`).startOf('month').toDate();
      endOfMonth = dayjs(startOfMonth).endOf('month').toDate();
    }

    // ============================================
    // MODE: LIST
    // ============================================
    if (mode === 'list') {
      const queryBuilder = this.transferRepository
        .createQueryBuilder('t')
        .leftJoinAndSelect('t.product', 'p')
        .leftJoinAndSelect('t.transferer', 'transferer')
        .leftJoinAndSelect('transferer.avatar', 'transferer_avatar')
        .leftJoinAndSelect('t.courier', 'courier')
        .leftJoinAndSelect('courier.avatar', 'courier_avatar')
        .leftJoinAndSelect('p.bar_code', 'b')
        .leftJoinAndSelect('b.size', 's')
        .leftJoinAndSelect('b.style', 'st')
        .leftJoinAndSelect('b.collection', 'c')
        .leftJoinAndSelect('b.country', 'cou')
        .leftJoinAndSelect('b.model', 'm')
        .leftJoinAndSelect('b.shape', 'sh')
        .leftJoinAndSelect('b.color', 'co')
        .leftJoin('t.package', 'pck')
        .leftJoinAndMapOne(
          't.manager', // -> result.manager
          User, // User entity
          'manager',
          'manager.id = :managerId',
          { managerId: d_manager.id },
        )
        .leftJoinAndMapOne(
          'manager.avatar', // -> result.manager.avatar
          Media, // avatar entity
          'manager_avatar',
          'manager_avatar.id = manager.avatarId',
        )
        .orderBy('t.date', 'DESC')
        .addOrderBy('t.order_index', 'ASC')
        .offset(offset)
        .limit(limit);

      // ---------------------------------------------
      // BUILD WHERE CONDITIONS CLEANLY
      // ---------------------------------------------
      const whereClauses: string[] = [];
      const params: any = {};

      // Progress filter
      whereClauses.push(`t.progress IN ('Processing', 'Accepted', 'Accepted_F')`);

      // Date filter
      if (hasDateFilter) {
        whereClauses.push(
          `t.date BETWEEN (:startOfMonth)::timestamp AND (:endOfMonth)::timestamp`,
        );
        params.startOfMonth = startOfMonth;
        params.endOfMonth = endOfMonth;
      }

      // Package filter
      if (package_id) {
        whereClauses.push(`t."packageId" = :package_id`);
        params.package_id = package_id;
      } else {
        whereClauses.push(`pck.status = 'accepted'`);
      }

      // ToId filter
      if (toId) {
        whereClauses.push(`t."toId" = :toId`);
        params.toId = toId;
      }

      // Apply WHERE
      queryBuilder.where(whereClauses.join(' AND '), params);

      // ---------------------------------------------
      // TOTALS QUERY (same filters, same params!)
      // ---------------------------------------------
      const totals_qb = this.transferRepository
        .createQueryBuilder('t')
        .select([
          `SUM(t.kv)::NUMERIC(20,2) AS "totalKv"`,
          `SUM(t."comingPrice" * t.kv)::NUMERIC(20,2) AS "total_sum"`,
          `COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" - t."oldComingPrice") * t.kv
            ELSE (t."comingPrice" - t."oldComingPrice") * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "total_profit_sum"`,
          `SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE t.count END) AS "total_count"`,
        ])
        .innerJoin('t.bar_code', 'q')
        .innerJoin('q.collection', 'c')
        .innerJoin(
          qb =>
            qb
              .select([
                'DISTINCT ON (cp."collectionId") cp."collectionId" AS "collectionId"',
                'cp."priceMeter" AS "priceMeter"',
              ])
              .from('collection-price', 'cp')
              .where(`cp.type = 'filial'`)
              .orderBy('cp."collectionId"')
              .addOrderBy('cp."date"', 'DESC'),
          'lp',
          `lp."collectionId" = c.id`,
        )
        // pck aliasni JOIN qildik, chunki whereClauses ichida ishlatiladi
        .leftJoin('t.package', 'pck')
        .where(whereClauses.join(' AND '), params);

      // ---------------------------------------------
      // EXECUTE BOTH QUERIES
      // ---------------------------------------------
      const [[items, total], totals] = await Promise.all([
        queryBuilder.getManyAndCount(),
        totals_qb.getRawOne(),
      ]);

      return {
        items,
        meta: {
          totalItems: total,
          itemCount: items.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          filterMonth: hasDateFilter ? month : null,
          filterYear: hasDateFilter ? year : null,
        },
        totals: {
          totalKv: Number(totals?.totalKv ?? 0),
          total_sum: Number(totals?.total_sum ?? 0),
          total_profit_sum: Number(totals?.total_profit_sum ?? 0),
          total_count: Number(totals?.total_count ?? 0),
        },
      };
    }

    // ============================================
    // MODE: COLLECTION
    // ============================================
    if (mode === 'collection') {
      const offset = (page - 1) * limit;

      const whereConditions = [`t.progres IN ('Processing', 'Accepted', 'Accepted_F')`];
      const params: any[] = [];
      let paramIndex = 1;

      if (hasDateFilter) {
        whereConditions.push(`t.date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
        params.push(startOfMonth, endOfMonth);
      }

      if (package_id) {
        whereConditions.push(`t."packageId" = $${paramIndex++}`);
        params.push(package_id);
      } else {
        whereConditions.push(`pck.status = 'accepted'`);
      }

      if (toId) {
        whereConditions.push(`t."toId" = $${paramIndex++}`);
        params.push(toId);
      }

      const whereSQL = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const rawQuery = `
      WITH latest_price AS (
        SELECT DISTINCT ON (cp."collectionId")
               cp."collectionId",
               cp."priceMeter",
               cp."comingPrice"
        FROM "collection-price" cp
        WHERE cp.type = 'filial'
        ORDER BY cp."collectionId", cp."date" DESC
      )
      SELECT
        c.id,
        c.title,
        json_build_object('id', c.id, 'title', c.title) as collection,
        SUM(COALESCE(t.kv, 0)) AS total_kv,
        SUM(
          COALESCE(
            CASE
              WHEN q."isMetric" = TRUE THEN 1
              ELSE t.count
            END,
            0
          )
        ) AS total_count,

        -- Total sum (based on comingPrice)
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            ELSE t."comingPrice" * t.kv
          END
        ), 0)::NUMERIC(20,2) AS total_sum,

        -- Profit sum with oldComingPrice check
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" -
                    (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                   ) * t.kv
            ELSE (t."comingPrice" -
                   (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                 ) * t.kv
          END
        ), 0)::NUMERIC(20,2) AS total_profit_sum,

        SUM(COALESCE(t.kv, 0)) AS "totalKv",
        SUM(
          COALESCE(
            CASE
              WHEN q."isMetric" = TRUE THEN 1
              ELSE t.count
            END,
            0
          )
        ) AS "totalCount",

        -- Total sum (based on comingPrice)
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            ELSE t."comingPrice" * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "totalPrice",

        -- Profit sum with oldComingPrice check
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" -
                    (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                   ) * t.kv
            ELSE (t."comingPrice" -
                   (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                 ) * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "totalNetProfitPrice",

        JSONB_AGG(DISTINCT cp) AS collection_prices
      FROM transfer t
        JOIN product p ON t."productId" = p.id
        LEFT JOIN package_transfer pck ON t."packageId" = pck.id
        LEFT JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN collection c ON q."collectionId" = c.id
        LEFT JOIN latest_price lp ON lp."collectionId" = c.id
        LEFT JOIN size s ON q."sizeId" = s.id
        LEFT JOIN "collection-price" cp
          ON c.id = cp."collectionId" AND cp.type = 'filial'
      ${whereSQL}
      GROUP BY c.id, c.title
      ORDER BY c.title
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

      const countQuery = `
      SELECT COUNT(DISTINCT c.id)
      FROM transfer t
        JOIN product p ON t."productId" = p.id
        LEFT JOIN package_transfer pck ON t."packageId" = pck.id
        LEFT JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN collection c ON q."collectionId" = c.id
      ${whereSQL}
    `;

      const queryParams = [...params, limit, offset];

      const [items, total, totals] = await Promise.all([
        this.dataSource.query(rawQuery, queryParams),
        this.dataSource.query(countQuery, params).then(res => Number(res[0]?.count || 0)),
        this.transferRepository
          .createQueryBuilder('t')
          .select([
            `SUM(t.kv)::NUMERIC(20,2) AS "totalKv"`,
            `SUM(t."comingPrice" * t.kv)::NUMERIC(20,2) AS "total_sum"`,
            `COALESCE(SUM(
            CASE
              WHEN t."comingPrice" = 0 THEN 0
              WHEN t."comingPrice" > lp."priceMeter"
                THEN (lp."priceMeter" - t."oldComingPrice") * t.kv
              ELSE (t."comingPrice" - t."oldComingPrice") * t.kv
            END
          ), 0)::NUMERIC(20,2) AS "total_profit_sum"`,
            `SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE t.count END) AS "total_count"`,
          ])
          .innerJoin('t.bar_code', 'q')
          .innerJoin('q.collection', 'c')
          .leftJoin('t.package', 'pck')
          .innerJoin(
            qb =>
              qb
                .select([
                  'DISTINCT ON (cp."collectionId") cp."collectionId" AS "collectionId"',
                  'cp."priceMeter" AS "priceMeter"',
                ])
                .from('collection-price', 'cp')
                .where(`cp.type = 'filial'`)
                .orderBy('cp."collectionId"')
                .addOrderBy('cp."date"', 'DESC'),
            'lp',
            'lp."collectionId" = c.id',
          )
          .where(`t.progress IN ('Processing', 'Accepted', 'Accepted_F')`)
          .andWhere(hasDateFilter ? 't.date BETWEEN :start AND :end' : '1=1', {
            start: startOfMonth,
            end: endOfMonth,
          })
          .andWhere(package_id ? 't."packageId" = :package_id' : '1=1', { package_id })
          .andWhere('pck.status = \'accepted\'')
          .andWhere(toId ? 't."toId" = :toId' : '1=1', { toId })
          .getRawOne(),
      ]);

      return {
        items,
        meta: {
          pagination: {
            limit,
            page,
            total,
            totalPages: Math.ceil(total / limit),
          },
          totalItems: total,
          itemCount: items.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          filterMonth: hasDateFilter ? month : null,
          filterYear: hasDateFilter ? year : null,
          totals: {
            totalKv: Number(totals?.totalKv ?? 0),
            totalPrice: Number(totals?.total_sum ?? 0),
            totalNetProfitPrice: Number(totals?.total_profit_sum ?? 0),
            totalCount: Number(totals?.total_count ?? 0),
          },
        },
        totals: {
          totalKv: Number(totals?.totalKv ?? 0),
          total_sum: Number(totals?.total_sum ?? 0),
          total_profit_sum: Number(totals?.total_profit_sum ?? 0),
          total_count: Number(totals?.total_count ?? 0),
        },
      };
    }

    // ============================================
    // MODE: COUNTRY
    // ============================================
    if (mode === 'country') {
      const offset = (page - 1) * limit;

      const whereConditions = [`t.progres IN ('Processing', 'Accepted', 'Accepted_F')`];
      const params: any[] = [];
      let paramIndex = 1;

      if (hasDateFilter) {
        whereConditions.push(`t.date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
        params.push(startOfMonth, endOfMonth);
      }

      if (package_id) {
        whereConditions.push(`t."packageId" = $${paramIndex++}`);
        params.push(package_id);
      } else {
        whereConditions.push(`pck.status = 'accepted'`);
      }

      if (toId) {
        whereConditions.push(`t."toId" = $${paramIndex++}`);
        params.push(toId);
      }

      const whereSQL = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const rawQuery = `
      WITH latest_price AS (
        SELECT DISTINCT ON (cp."collectionId")
               cp."collectionId",
               cp."priceMeter",
               cp."comingPrice"
        FROM "collection-price" cp
        WHERE cp.type = 'filial'
        ORDER BY cp."collectionId", cp."date" DESC
      )
      SELECT
        ct.id,
        ct.title,
        json_build_object('id', ct.id, 'title', ct.title) as country,
        SUM(COALESCE(t.kv, 0)) AS total_kv,
        SUM(COALESCE(t.kv, 0)) AS totalKv,
        SUM(
          COALESCE(
            CASE
              WHEN q."isMetric" = TRUE THEN 1
              ELSE t.count
            END,
            0
          )
        ) AS total_count,
        SUM(
          COALESCE(
            CASE
              WHEN q."isMetric" = TRUE THEN 1
              ELSE t.count
            END,
            0
          )
        ) AS "totalCount",

        -- Total sum (based on comingPrice)
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            ELSE t."comingPrice" * t.kv
          END
        ), 0)::NUMERIC(20,2) AS total_sum,
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            ELSE t."comingPrice" * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "totalPrice",

        -- Profit sum with oldComingPrice check
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" -
                    (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                   ) * t.kv
            ELSE (t."comingPrice" -
                   (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                 ) * t.kv
          END
        ), 0)::NUMERIC(20,2) AS total_profit_sum,
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" -
                    (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                   ) * t.kv
            ELSE (t."comingPrice" -
                   (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                 ) * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "totalNetProfitPrice"
      FROM transfer t
        JOIN product p ON t."productId" = p.id
        LEFT JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN package_transfer pck ON t."packageId" = pck.id
        LEFT JOIN collection c ON q."collectionId" = c.id
        LEFT JOIN country ct ON q."countryId" = ct.id
        LEFT JOIN latest_price lp ON lp."collectionId" = c.id
        LEFT JOIN size s ON q."sizeId" = s.id
        LEFT JOIN "collection-price" cp
          ON c.id = cp."collectionId" AND cp.type = 'filial'
      ${whereSQL}
      GROUP BY ct.id, ct.title
      ORDER BY ct.title
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

      const countQuery = `
      SELECT COUNT(DISTINCT ct.id)
      FROM transfer t
        JOIN product p ON t."productId" = p.id
        LEFT JOIN package_transfer pck ON t."packageId" = pck.id
        LEFT JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN collection c ON q."collectionId" = c.id
        LEFT JOIN country ct ON q."countryId" = ct.id
      ${whereSQL}
    `;

      const queryParams = [...params, limit, offset];

      const [items, total, totals] = await Promise.all([
        this.dataSource.query(rawQuery, queryParams),
        this.dataSource.query(countQuery, params).then(res => Number(res[0]?.count || 0)),
        this.transferRepository
          .createQueryBuilder('t')
          .select([
            `SUM(t.kv)::NUMERIC(20,2) AS "totalKv"`,
            `SUM(t."comingPrice" * t.kv)::NUMERIC(20,2) AS "total_sum"`,
            `COALESCE(SUM(
            CASE
              WHEN t."comingPrice" = 0 THEN 0
              WHEN t."comingPrice" > lp."priceMeter"
                THEN (lp."priceMeter" - t."oldComingPrice") * t.kv
              ELSE (t."comingPrice" - t."oldComingPrice") * t.kv
            END
          ), 0)::NUMERIC(20,2) AS "total_profit_sum"`,
            `SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE t.count END) AS "total_count"`,
          ])
          .innerJoin('t.bar_code', 'q')
          .innerJoin('q.collection', 'c')
          .leftJoin('t.package', 'pck')
          .innerJoin(
            qb =>
              qb
                .select([
                  'DISTINCT ON (cp."collectionId") cp."collectionId" AS "collectionId"',
                  'cp."priceMeter" AS "priceMeter"',
                ])
                .from('collection-price', 'cp')
                .where(`cp.type = 'filial'`)
                .orderBy('cp."collectionId"')
                .addOrderBy('cp."date"', 'DESC'),
            'lp',
            'lp."collectionId" = c.id',
          )
          .where(`t.progress IN ('Processing', 'Accepted', 'Accepted_F')`)
          .andWhere(hasDateFilter ? 't.date BETWEEN :start AND :end' : '1=1', {
            start: startOfMonth,
            end: endOfMonth,
          })
          .andWhere(package_id ? 't."packageId" = :package_id' : '1=1', { package_id })
          .andWhere('pck.status = \'accepted\'')
          .andWhere(toId ? 't."toId" = :toId' : '1=1', { toId })
          .getRawOne(),
      ]);

      return {
        items,
        meta: {
          pagination: {
            limit,
            page,
            total,
            totalPages: Math.ceil(total / limit),
          },
          totalItems: total,
          itemCount: items.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          filterMonth: hasDateFilter ? month : null,
          filterYear: hasDateFilter ? year : null,
          totals: {
            totalKv: Number(totals?.totalKv ?? 0),
            totalSellPrice: Number(totals?.total_sum ?? 0),
            totalPrice: Number(totals?.total_sum ?? 0),
            totalNetProfitPrice: Number(totals?.total_profit_sum ?? 0),
            totalCount: Number(totals?.total_count ?? 0),
          },
        },
      };
    }

    // ============================================
    // MODE: FACTORY
    // ============================================
    if (mode === 'factory') {
      const offset = (page - 1) * limit;

      const whereConditions = [`t.progres IN ('Processing', 'Accepted', 'Accepted_F')`];
      const params: any[] = [];
      let paramIndex = 1;

      if (hasDateFilter) {
        whereConditions.push(`t.date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
        params.push(startOfMonth, endOfMonth);
      }

      if (package_id) {
        whereConditions.push(`t."packageId" = $${paramIndex++}`);
        params.push(package_id);
      } else {
        whereConditions.push(`pck.status = 'accepted'`);
      }

      if (toId) {
        whereConditions.push(`t."toId" = $${paramIndex++}`);
        params.push(toId);
      }

      const whereSQL = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const rawQuery = `
      WITH latest_price AS (
        SELECT DISTINCT ON (cp."collectionId")
               cp."collectionId",
               cp."priceMeter",
               cp."comingPrice"
        FROM "collection-price" cp
        WHERE cp.type = 'filial'
        ORDER BY cp."collectionId", cp."date" DESC
      )
      SELECT
        fa.id,
        fa.title,
        json_build_object('id', fa.id, 'title', fa.title) as factory,
        SUM(COALESCE(t.kv, 0)) AS total_kv,
        SUM(
          COALESCE(
            CASE
              WHEN q."isMetric" = TRUE THEN 1
              ELSE t.count
            END,
            0
          )
        ) AS total_count,

        -- Total sum (based on comingPrice)
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            ELSE t."comingPrice" * t.kv
          END
        ), 0)::NUMERIC(20,2) AS total_sum,

        -- Profit sum with oldComingPrice check
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" -
                    (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                   ) * t.kv
            ELSE (t."comingPrice" -
                   (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                 ) * t.kv
          END
        ), 0)::NUMERIC(20,2) AS total_profit_sum,

        SUM(COALESCE(t.kv, 0)) AS "totalKv",
        SUM(
          COALESCE(
            CASE
              WHEN q."isMetric" = TRUE THEN 1
              ELSE t.count
            END,
            0
          )
        ) AS totalCount,

        -- Total sum (based on comingPrice)
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            ELSE t."comingPrice" * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "totalPrice",

        -- Profit sum with oldComingPrice check
        COALESCE(SUM(
          CASE
            WHEN t."comingPrice" = 0 THEN 0
            WHEN t."comingPrice" > lp."priceMeter"
              THEN (lp."priceMeter" -
                    (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                   ) * t.kv
            ELSE (t."comingPrice" -
                   (CASE WHEN t."oldComingPrice" < 1 THEN lp."comingPrice" ELSE t."oldComingPrice" END)
                 ) * t.kv
          END
        ), 0)::NUMERIC(20,2) AS "totalNetProfitPrice"
      FROM transfer t
        JOIN product p ON t."productId" = p.id
        LEFT JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN package_transfer pck ON t."packageId" = pck.id
        LEFT JOIN collection c ON q."collectionId" = c.id
        LEFT JOIN country ct ON q."countryId" = ct.id
        LEFT JOIN factory fa ON q."factoryId" = fa.id
        LEFT JOIN latest_price lp ON lp."collectionId" = c.id
        LEFT JOIN size s ON q."sizeId" = s.id
        LEFT JOIN "collection-price" cp
          ON c.id = cp."collectionId" AND cp.type = 'filial'
      ${whereSQL}
      GROUP BY fa.id, fa.title
      ORDER BY fa.title
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

      const countQuery = `
      SELECT COUNT(DISTINCT fa.id)
      FROM transfer t
        JOIN product p ON t."productId" = p.id
        LEFT JOIN package_transfer pck ON t."packageId" = pck.id
        LEFT JOIN qrbase q ON p."barCodeId" = q.id
        LEFT JOIN collection c ON q."collectionId" = c.id
        LEFT JOIN factory fa ON q."factoryId" = fa.id
      ${whereSQL}
    `;

      const queryParams = [...params, limit, offset];

      const [items, total, totals] = await Promise.all([
        this.dataSource.query(rawQuery, queryParams),
        this.dataSource.query(countQuery, params).then(res => Number(res[0]?.count || 0)),
        this.transferRepository
          .createQueryBuilder('t')
          .select([
            `SUM(t.kv)::NUMERIC(20,2) AS "totalKv"`,
            `SUM(t."comingPrice" * t.kv)::NUMERIC(20,2) AS "total_sum"`,
            `COALESCE(SUM(
            CASE
              WHEN t."comingPrice" = 0 THEN 0
              WHEN t."comingPrice" > lp."priceMeter"
                THEN (lp."priceMeter" - t."oldComingPrice") * t.kv
              ELSE (t."comingPrice" - t."oldComingPrice") * t.kv
            END
          ), 0)::NUMERIC(20,2) AS "total_profit_sum"`,
            `SUM(CASE WHEN q."isMetric" = true THEN 1 ELSE t.count END) AS "total_count"`,
          ])
          .innerJoin('t.bar_code', 'q')
          .innerJoin('q.collection', 'c')
          .leftJoin('t.package', 'pck')
          .innerJoin(
            qb =>
              qb
                .select([
                  'DISTINCT ON (cp."collectionId") cp."collectionId" AS "collectionId"',
                  'cp."priceMeter" AS "priceMeter"',
                ])
                .from('collection-price', 'cp')
                .where(`cp.type = 'filial'`)
                .orderBy('cp."collectionId"')
                .addOrderBy('cp."date"', 'DESC'),
            'lp',
            'lp."collectionId" = c.id',
          )
          .where(`t.progress IN ('Processing', 'Accepted', 'Accepted_F')`)
          .andWhere(hasDateFilter ? 't.date BETWEEN :start AND :end' : '1=1', {
            start: startOfMonth,
            end: endOfMonth,
          })
          .andWhere(package_id ? 't."packageId" = :package_id' : '1=1', { package_id })
          .andWhere('pck.status = \'accepted\'')
          .andWhere(toId ? 't."toId" = :toId' : '1=1', { toId })
          .getRawOne(),
      ]);

      return {
        items,
        meta: {
          pagination: {
            limit,
            page,
            total,
            totalPages: Math.ceil(total / limit),
          },
          totalItems: total,
          itemCount: items.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          filterMonth: hasDateFilter ? month : null,
          filterYear: hasDateFilter ? year : null,
          totals: {
            totalKv: Number(totals?.totalKv ?? 0),
            totalSellPrice: Number(totals?.total_sum ?? 0),
            totalPrice: Number(totals?.total_sum ?? 0),
            totalNetProfitPrice: Number(totals?.total_profit_sum ?? 0),
            totalCount: Number(totals?.total_count ?? 0),
          },
        },
      };
    }
  }

  async prodajaVDolg({ filial, month, type, year, page, limit }) {
    const cacheKey = `bossCurrentLeftSellDebt:${filial || 'all'}:${month || 'auto'}:${year || 'auto'}:${type}:${page}`;
    const cacheTTL = 180;
    const offset = (page - 1) * limit;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // ---------------------------
    //  Default month / year
    // ---------------------------
    const now = dayjs();
    const y = year ? Number(year) : now.year();
    const m = month ? Number(month) : now.month() + 1;

    const startDate = dayjs(`${y}-${m}-01`).startOf('month').toDate();
    const endDate = dayjs(`${y}-${m}-01`).endOf('month').toDate();

    // ---------------------------
    // Dealers special route
    // ---------------------------
    if (filial === '#dealers') {
      const resultData = await this.getByPackage({
        mode: 'list',
        month: m,
        year: y,
        package_id: null,
        page,
        limit,
        toId: null,
        search: null,
      });

      await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', cacheTTL);

      return resultData;
    }

    // ---------------------------
    //  MAIN LIST QUERY
    // ---------------------------
    const orders_qb = this.orderRepo.createQueryBuilder('o')
      .select([
        'o.id',
        'o.date',
        'o.x',
        'o.price',
        'o.plasticSum',
        'seller.id',
        'seller.firstName',
        'seller.lastName',
        'createdBy.id',
        'createdBy.firstName',
        'createdBy.lastName',
        's_avatar.id',
        's_avatar.path',
        's_avatar.mimetype',
        's_avatar.name',
        'c_avatar.id',
        'c_avatar.path',
        'c_avatar.mimetype',
        'c_avatar.name',
        'product.id',
        'product.y',
        'bar_code.id',
        'bar_code.isMetric',
        'bar_code.code',
        'col.id',
        'col.title',
        'm.id',
        'm.title',
        'sz.id',
        'sz.title',
        'cl.id',
        'cl.title',
      ])
      .leftJoin('o.seller', 'seller')
      .leftJoin('seller.avatar', 's_avatar')
      .leftJoin('o.createdBy', 'createdBy')
      .leftJoin('createdBy.avatar', 'c_avatar')
      .leftJoin('o.product', 'product')
      .leftJoin('o.bar_code', 'bar_code')
      .leftJoin('bar_code.collection', 'col')
      .leftJoin('bar_code.model', 'm')
      .leftJoin('bar_code.size', 'sz')
      .leftJoin('bar_code.color', 'cl')
      .leftJoin('o.kassa', 'k')
      .where('k.month = :month', { month })
      .andWhere('k.year = :year', { year })
      .orderBy('o.date', 'DESC')
      .offset(offset)
      .limit(limit);

    if (filial) {
      orders_qb.andWhere('k.filialId = :filial', { filial });
    }


    if (type === 'canceled') {
      orders_qb.andWhere('o.status = :status', { status: 'canceled' });
    } else if (type === 'debt') {
      orders_qb.andWhere('o.isDebt = true');
    } else {
      orders_qb.andWhere('o.status = :status', { status: 'canceled' });
      orders_qb.andWhere('o.isDebt = true');
    }

    // ---------------------------
    // TOTALS QUERY
    // ---------------------------
    const order_qb_totals = this.orderRepo.createQueryBuilder('o')
      .select([
        `COALESCE(SUM(o.price + o.plasticSum), 0)::NUMERIC(20,2) AS total_sum`,
        `COALESCE(SUM(o.netProfitSum), 0)::NUMERIC(20,2) AS total_profit_sum`,
        `COALESCE(SUM(o.additionalProfitSum), 0)::NUMERIC(20,2) AS total_additional_profit_sum`,
        `COALESCE(SUM(CASE WHEN bar_code.isMetric = TRUE THEN 1 ELSE o.x END), 0)::NUMERIC(20, 2) AS total_count`,
      ])
      .leftJoin('o.bar_code', 'bar_code')
      .leftJoin('o.kassa', 'k')
      .where('k.month = :month', { month })
      .andWhere('k.year = :year', { year })
      .andWhere(type === 'debt' ? 'o.isDebt = true' : '1=1');

    if (filial) {
      order_qb_totals.andWhere('k.filialId = :filial', { filial });
    }

    if (type === 'canceled') {
      order_qb_totals.andWhere('o.status = :status', { status: 'canceled' });
    } else if (type === 'debt') {
      order_qb_totals.andWhere('o.isDebt = true');
    } else {
      order_qb_totals.andWhere('o.status = :status', { status: 'canceled' });
      order_qb_totals.andWhere('o.isDebt = true');
    }

    // ---------------------------
    // EXECUTE QUERIES
    // ---------------------------
    const [[items, total], totals] = await Promise.all([
      orders_qb.getManyAndCount(),
      order_qb_totals.getRawOne(),
    ]);

    const result = {
      items,
      meta: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        itemCount: limit,
      },
      totals: {
        total_sum: Number(totals.total_sum || 0),
        total_count: Number(totals.total_count || 0),
        total_additional_profit_sum: Number(totals.total_additional_profit_sum || 0),
        total_profit_sum: Number(totals.total_profit_sum || 0),
      },
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', cacheTTL);

    return result;
  }

// service ichida

  async bossMonthReport({ month, year, filialId }) {
    const { normalizedYear, startDate, endDate } = this.getYearAndDateRange(month, year);

    const cacheKey = `bossCurrentMonthAllReport:${filialId || 'all'}:${month || 'all'}:${normalizedYear}`;
    const cacheTTL = 180;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // --- Typelar ---
    type PriceKv = { price: number; kv: number };

    // Dealer package transfer
    const dealer_qb = this.packageTransfer.createQueryBuilder('pt')
      .select([
        'COALESCE(SUM(pt.total_sum), 0)::NUMERIC(20, 2) AS total_sum',
        'COALESCE(SUM(pt.total_profit_sum), 0)::NUMERIC(20, 2) AS total_profit_sum',
        'COALESCE(SUM(pt.total_kv), 0)::NUMERIC(20, 2) AS total_kv',
        'COALESCE(SUM(pt.total_count), 0)::NUMERIC(20, 2) AS total_count',
      ])
      .where('pt.status = :status', { status: PackageTransferEnum.Accept });

    // Orderlar bo'yicha oborot
    const order_qb = this.orderRepo.createQueryBuilder('ord')
      .leftJoin('ord.bar_code', 'bar_code')
      .leftJoin('ord.kassa', 'kassa')
      .select([
        `COALESCE(SUM(ord.price + ord."plasticSum"), 0)::NUMERIC(20, 2) AS total_sum`,
        `COALESCE(SUM(ord.kv), 0)::NUMERIC(20, 2) AS total_kv`,
        `COALESCE(SUM(ord.netProfitSum), 0)::NUMERIC(20, 2) AS total_profit_sum`,
        `COALESCE(SUM(ord.discountSum), 0)::NUMERIC(20, 2) AS total_discount`,
        `
      SUM(
        CASE WHEN bar_code.isMetric = true THEN 1 ELSE ord.x END
      )::NUMERIC(20, 2) as total_count
      `,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.price ELSE 0 END), 0)::NUMERIC(20, 2) as total_debt_sum`,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.kv ELSE 0 END), 0)::NUMERIC(20, 2) as total_debt_kv`,
        `COALESCE(SUM(CASE WHEN ord.isDebt = true then ord.netProfitSum ELSE 0 END), 0)::NUMERIC(20, 2) as total_debt_profit_sum`,
        `
      SUM(
        CASE WHEN ord.isDebt = true THEN (CASE WHEN bar_code.isMetric = true THEN 1 ELSE ord.x END)
        ELSE 0 END
      )::NUMERIC(20, 2) as total_debt_count
      `,
      ])
      .where('ord.status IN(:...status)', { status: [OrderEnum.Accept, OrderEnum.Cancel] });

    // Dealer kassa (naqd/online)
    const dealer_cash_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.is_online = FALSE THEN price ELSE 0 end) as cash,
      SUM(CASE WHEN cash.is_online = TRUE THEN price ELSE 0 end) as online
    `)
      .leftJoin('cash.cashflow_type', 'ct')
      .where(`ct.slug = 'delaer'`);

    // Filial kassadan chiqim (manager + buxgalter)
    const kassa_cash_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .leftJoin('cash.kassa', 'k')
      .where(`ct.slug IN ('manager', 'bugalter') AND cash.type = 'Расход'`);

    // Kassa (plastik, inkassa, opening, in_hand, qaytishlar, qo'shimcha foyda)
    const plastic_cash_and_opening_qb = this.kassaRepo.createQueryBuilder('k')
      .select(`
      SUM("plasticSum") as price,
      SUM("cash_collection") as cash_collection,
      SUM("opening_balance") as opening_balance,
      SUM(in_hand) as in_hand,
      SUM("additionalProfitTotalSum") as add_profit,
      SUM("totalSaleReturn") as return_sale,
      SUM("totalSaleSizeReturn") as return_size
    `)
      .where(`k."filialType" = 'filial'`);

    // Opening balance (Balance turi)
    const opening_balance_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .leftJoin('cash.kassa', 'k')
      .where(`ct.slug = 'Balance' AND cash.type = 'Приход'`);

    // Qarzdan tushgan pul (qarz, qarzdanKelgan)
    const coming_debt_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .leftJoin('cash.kassa', 'k')
      .where(`ct.slug IN ('qarz', 'qarzdanKelgan') AND cash.type = 'Приход'`);

    // Boss (boshlik) bo'yicha kirim/chiqim
    const boss_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.type = 'Приход' THEN price ELSE 0 END) as income,
      SUM(CASE WHEN cash.type = 'Расход' THEN price ELSE 0 END) as expense
    `)
      .leftJoin('cash.cashflow_type', 'ct')
      .leftJoin('cash.kassa', 'k')
      .where(`ct.slug = 'Bos'`);

    // Kent (dolg)
    const kent_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.type = 'Приход' THEN price ELSE 0 END) as income,
      SUM(CASE WHEN cash.type = 'Расход' THEN price ELSE 0 END) as expense
    `)
      .leftJoin('cash.cashflow_type', 'ct')
      .where(`ct.slug IN ('dolg')`);

    // Business xarajatlar
    const business_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .leftJoin('cash.kassa', 'k')
      .where(
        `ct.slug IN ('bank', 'logistika', 'kredit', 'karta', 'prochee', 'nalog', 'Аренда', 'shop')
       AND cash.type = 'Расход'`,
      );

    // Factory
    const factory_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .where(`ct.slug = 'factory' AND cash.type = 'Расход'`);

    // Tamojnya
    const customs_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .where(`ct.slug = 'tamojnya' AND cash.type = 'Расход'`);

    // Qo'shimcha foyda xarajatga ketgan qismi (navar, Расход)
    const add_profit_exp_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`SUM(price) as cash`)
      .leftJoin('cash.cashflow_type', 'ct')
      .leftJoin('cash.kassa', 'k')
      .where(`ct.slug = 'navar' AND cash.type = 'Расход'`);

    // pt.updatedAt bo'yicha yil/oy
    this.applyDateRangeFilter(dealer_qb, 'pt.updatedAt', startDate, endDate);

    this.applyDateRangeFilter(dealer_cash_qb, 'cash.date', startDate, endDate);

    this.applyDateRangeFilter(kassa_cash_qb, 'k.startDate', startDate, endDate);

    this.applyDateRangeFilter(kent_qb, 'cash.date', startDate, endDate);
    this.applyDateRangeFilter(factory_qb, 'cash.date', startDate, endDate);
    this.applyDateRangeFilter(customs_qb, 'cash.date', startDate, endDate);

    this.applyDateRangeFilter(add_profit_exp_qb, 'k.startDate', startDate, endDate);

    this.applyKassaMonthYearFilter(order_qb, 'kassa', month, normalizedYear);
    this.applyKassaMonthYearFilter(business_qb, 'k', month, normalizedYear);
    this.applyKassaMonthYearFilter(coming_debt_qb, 'k', month, normalizedYear);
    this.applyKassaMonthYearFilter(opening_balance_qb, 'k', month, normalizedYear);
    this.applyKassaMonthYearFilter(plastic_cash_and_opening_qb, 'k', month, normalizedYear);

    let resultData: {
      turnover: PriceKv;
      debt_trading: PriceKv;
      discount: PriceKv;
      profit: PriceKv;
      cash: PriceKv;
      terminal: PriceKv;
      cash_collection: PriceKv;
      dealer_cash: PriceKv;
      dealer_terminal: PriceKv;
      owed_debt: PriceKv;
      opening_balance: PriceKv;
      filial_balance: PriceKv;
      boss_income: PriceKv;
      kent_income: PriceKv;
      kent_expense: PriceKv;
      boss_expense: PriceKv;
      business_expense: PriceKv;
      factory: PriceKv;
      return_orders: PriceKv;
      tamojniy: PriceKv;
      navar_expense: PriceKv;
      navar_income: PriceKv;
    };

    if (filialId === '#dealers') {
      const [result, dealer_cashs] = await Promise.all([
        dealer_qb.getRawOne(),
        dealer_cash_qb.getRawOne(),
      ]);

      resultData = {
        turnover: {
          price: Number(result?.total_sum ?? 0),
          kv: 0,
        },
        debt_trading: {
          price: Number(result?.total_sum ?? 0),
          kv: 0,
        },
        discount: { price: 0, kv: 0 },
        profit: {
          price: Number(result?.total_profit_sum ?? 0),
          kv: 0,
        },
        cash: { price: 0, kv: 0 },
        terminal: { price: 0, kv: 0 },
        cash_collection: { price: 0, kv: 0 },
        dealer_cash: {
          price: Number(dealer_cashs?.cash ?? 0),
          kv: 0,
        },
        dealer_terminal: {
          price: Number(dealer_cashs?.online ?? 0),
          kv: 0,
        },
        owed_debt: { price: 0, kv: 0 },
        opening_balance: { price: 0, kv: 0 },
        filial_balance: { price: 0, kv: 0 },
        boss_income: { price: 0, kv: 0 },
        kent_income: { price: 0, kv: 0 },
        kent_expense: { price: 0, kv: 0 },
        boss_expense: { price: 0, kv: 0 },
        business_expense: { price: 0, kv: 0 },
        factory: { price: 0, kv: 0 },
        return_orders: { price: 0, kv: 0 },
        tamojniy: { price: 0, kv: 0 },
        navar_expense: { price: 0, kv: 0 },
        navar_income: { price: 0, kv: 0 },
      };
    }

    else if (filialId) {
      // here for excel ->
      this.applyDateRangeFilter(boss_qb, 'k.startDate', startDate, endDate);
      boss_qb.andWhere('cash.filialId = :filialId', { filialId });

      // filial kesimlari
      business_qb.andWhere('k.filialId = :filialId', { filialId });
      order_qb.andWhere('kassa.filialId = :filialId', { filialId });
      kassa_cash_qb.andWhere('cash.filialId = :filialId', { filialId });
      coming_debt_qb.andWhere('k.filialId = :filialId', { filialId });
      kent_qb.andWhere('cash.filialId = :filialId', { filialId });
      factory_qb.andWhere('cash.filialId = :filialId', { filialId });
      customs_qb.andWhere('cash.filialId = :filialId', { filialId });
      opening_balance_qb.andWhere('k.filialId = :filialId', { filialId });
      add_profit_exp_qb.andWhere('cash.filialId = :filialId', { filialId });
      plastic_cash_and_opening_qb.andWhere('k.filialId = :filialId', { filialId });

      const [
        order_totals,
        kassa_cash,
        plastic_cash_and_opening,
        coming_debt,
        boss,
        business,
        customs,
        add_profit_exp,
        opening_balance,
      ] = await Promise.all([
        order_qb.getRawOne(),
        kassa_cash_qb.getRawOne(),
        plastic_cash_and_opening_qb.getRawOne(),
        coming_debt_qb.getRawOne(),
        boss_qb.getRawOne(),
        business_qb.getRawOne(),
        customs_qb.getRawOne(),
        add_profit_exp_qb.getRawOne(),
        opening_balance_qb.getRawOne(),
      ]);

      resultData = {
        turnover: {
          price: Number(order_totals?.total_sum ?? 0),
          kv: Number(order_totals?.total_kv ?? 0),
        }, // savdo aylanmasi
        debt_trading: {
          price: Number(order_totals?.total_debt_sum ?? 0),
          kv: Number(order_totals?.total_debt_kv ?? 0),
        }, // Qarz savdosi
        discount: {
          price: Number(order_totals?.total_discount ?? 0),
          kv: 0,
        }, // chegirma
        profit: {
          price: Number(order_totals?.total_profit_sum ?? 0),
          kv: 0,
        }, // foyda hisobi
        cash: {
          price: Number(kassa_cash?.cash ?? 0),
          kv: 0,
        }, // naqr kassa
        terminal: {
          price: Number(plastic_cash_and_opening?.price ?? 0),
          kv: 0,
        }, // terminal va perechesleniya
        cash_collection: {
          price: Number(plastic_cash_and_opening?.cash_collection ?? 0),
          kv: 0,
        }, // inkassatsiya
        dealer_cash: { price: 0, kv: 0 },
        dealer_terminal: { price: 0, kv: 0 },
        owed_debt: {
          price: Number(coming_debt?.cash ?? 0),
          kv: 0,
        }, // kelgan qarzlar
        opening_balance: {
          price: Number(opening_balance?.cash ?? 0),
          kv: 0,
        }, // oldingi oydan o'tgan pul
        filial_balance: {
          price: Number(plastic_cash_and_opening?.in_hand ?? 0),
          kv: 0,
        }, // filial balansi
        boss_income: {
          price: Number(boss?.income ?? 0),
          kv: 0,
        }, // boss prixod
        kent_income: { price: 0, kv: 0 },
        kent_expense: { price: 0, kv: 0 },
        boss_expense: {
          price: Number(boss?.expense ?? 0),
          kv: 0,
        }, // boss rasxod
        business_expense: {
          price: Number(business?.cash ?? 0),
          kv: 0,
        }, // biznes rasxod
        factory: { price: 0, kv: 0 },
        return_orders: {
          price: Number(plastic_cash_and_opening?.return_sale ?? 0),
          kv: Number(plastic_cash_and_opening?.return_size ?? 0),
        }, // qaytgan tavarlar (vazvrat)
        tamojniy: {
          price: Number(customs?.cash ?? 0),
          kv: 0,
        },
        navar_expense: {
          price: Number(add_profit_exp?.cash ?? 0),
          kv: 0,
        }, // navar rasxod
        navar_income: {
          price: Number(plastic_cash_and_opening?.add_profit ?? 0),
          kv: 0,
        }, // navar
      };
    }

    else {
      // Bu yerda boss & business umumiy kesim -- cash.date bo'yicha
      this.applyDateRangeFilter(boss_qb, 'cash.date', startDate, endDate);
      this.applyDateRangeFilter(business_qb, 'cash.date', startDate, endDate);

      const [
        dealer_result,
        dealer_cashs,
        order_totals,
        kassa_cash,
        plastic_cash_and_opening,
        coming_debt,
        boss,
        kent,
        business,
        factory,
        customs,
      ] = await Promise.all([
        dealer_qb.getRawOne(),
        dealer_cash_qb.getRawOne(),
        order_qb.getRawOne(),
        kassa_cash_qb.getRawOne(),
        plastic_cash_and_opening_qb.getRawOne(),
        coming_debt_qb.getRawOne(),
        boss_qb.getRawOne(),
        kent_qb.getRawOne(),
        business_qb.getRawOne(),
        factory_qb.getRawOne(),
        customs_qb.getRawOne(),
      ]);

      resultData = {
        turnover: {
          price:
            Number(dealer_result?.total_sum ?? 0) +
            Number(order_totals?.total_sum ?? 0),
          kv:
            Number(dealer_result?.total_kv ?? 0) +
            Number(order_totals?.total_kv ?? 0),
        },
        debt_trading: {
          price:
            Number(dealer_result?.total_sum ?? 0) +
            Number(order_totals?.total_debt_sum ?? 0),
          kv:
            Number(dealer_result?.total_kv ?? 0) +
            Number(order_totals?.total_debt_kv ?? 0),
        },
        discount: {
          price: Number(order_totals?.total_discount ?? 0),
          kv: 0,
        },
        profit: {
          price:
            Number(dealer_result?.total_profit_sum ?? 0) +
            Number(order_totals?.total_profit_sum ?? 0),
          kv: 0,
        },
        cash: {
          price: Number(kassa_cash?.cash ?? 0),
          kv: 0,
        },
        terminal: {
          price: Number(plastic_cash_and_opening?.price ?? 0),
          kv: 0,
        },
        cash_collection: {
          price: Number(plastic_cash_and_opening?.cash_collection ?? 0),
          kv: 0,
        },
        dealer_cash: {
          price: Number(dealer_cashs?.cash ?? 0),
          kv: 0,
        },
        dealer_terminal: {
          price: Number(dealer_cashs?.online ?? 0),
          kv: 0,
        },
        owed_debt: {
          price: Number(coming_debt?.cash ?? 0),
          kv: 0,
        },
        opening_balance: {
          price: Number(plastic_cash_and_opening?.opening_balance ?? 0),
          kv: 0,
        },
        filial_balance: {
          price: Number(plastic_cash_and_opening?.in_hand ?? 0),
          kv: 0,
        },
        boss_income: {
          price: Number(boss?.income ?? 0),
          kv: 0,
        },
        kent_income: {
          price: Number(kent?.income ?? 0),
          kv: 0,
        },
        kent_expense: {
          price: Number(kent?.expense ?? 0),
          kv: 0,
        },
        boss_expense: {
          price: Number(boss?.expense ?? 0),
          kv: 0,
        },
        business_expense: {
          price: Number(business?.cash ?? 0),
          kv: 0,
        },
        factory: {
          price: Number(factory?.cash ?? 0),
          kv: 0,
        },
        return_orders: {
          price: Number(plastic_cash_and_opening?.return_sale ?? 0),
          kv: Number(plastic_cash_and_opening?.return_size ?? 0),
        },
        tamojniy: {
          price: Number(customs?.cash ?? 0),
          kv: 0,
        },
        navar_expense: { price: 0, kv: 0 },
        navar_income: { price: 0, kv: 0 },
      };
    }

    await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', cacheTTL);
    return resultData;
  }

// =============================
// ====== HELPERS (modular) ====
// =============================

  private getYearAndDateRange(
    month?: number | string,
    year?: number | string,
  ): { normalizedYear: number; startDate: Date; endDate: Date } {
    const currentYear = dayjs().year();
    const normalizedYear = year ? Number(year) : currentYear;

    let startDate: Date;
    let endDate: Date;

    if (month) {
      startDate = dayjs(`${normalizedYear}-${month}-01`).startOf('month').toDate();
      endDate = dayjs(`${normalizedYear}-${month}-01`).endOf('month').toDate();
    } else {
      startDate = dayjs(`${normalizedYear}-01-01`).startOf('year').toDate();
      endDate = dayjs(`${normalizedYear}-12-31`).endOf('year').toDate();
    }

    return { normalizedYear, startDate, endDate };
  }

  /**
   * Kassa month / year bo'yicha filter
   * - month bo'lsa: alias.month = :month AND alias.year = :year
   * - month bo'lmasa: faqat alias.year = :year
   */
  private applyKassaMonthYearFilter(
    qb: any,
    alias: string,
    month: number | string | null | undefined,
    year: number,
  ) {
    if (month) {
      qb.andWhere(`${alias}.month = :month`, { month });
    }
    qb.andWhere(`${alias}.year = :year`, { year });
  }

  /**
   * column BETWEEN :startDate AND :endDate
   */
  private applyDateRangeFilter(
    qb: any,
    column: string,
    startDate: Date,
    endDate: Date,
  ) {
    qb.andWhere(`${column} BETWEEN :startDate AND :endDate`, {
      startDate,
      endDate,
    });
  }

  async calcReport(month, year, type?: 'calc' | 'do') {
    const report = await this.reportRepo.findOne({
      where: {
        year,
        month,
        filialType: FilialType.FILIAL,
      },
    });

    const d_report = await this.reportRepo.findOne({
      where: {
        year,
        month,
        filialType: FilialType.DEALER,
      },
    });

    const [accountant, manager] = await Promise.all([
      this.userRepository.findOne({ where: { isActive: true, position: { role: UserRoleEnum.ACCOUNTANT } } }),
      this.userRepository.findOne({ where: { isActive: true, position: { role: UserRoleEnum.M_MANAGER } } }),
    ]);

    const accountant_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.type = 'Приход' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_income,
      SUM(CASE WHEN cash.type = 'Расход' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_expense
    `)
      .leftJoin('cash.cashflow_type', 'c_t')
      .where('cash.createdById = :accountant', { accountant: accountant.id })
      .andWhere('cash.reportId = :id', { id: report.id })
      .andWhere('c_t.slug != :type', { type: 'онлайн' });

    const manager_qb = this.cashflowRepository.createQueryBuilder('cash')
      .select(`
      SUM(CASE WHEN cash.type = 'Приход' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_income,
      SUM(CASE WHEN cash.type = 'Расход' THEN cash.price ELSE 0 END)::NUMERIC(20, 2) AS total_expense
    `)
      .leftJoin('cash.cashflow_type', 'c_t')
      .where('cash.createdById = :manager', { manager: manager.id })
      .andWhere('cash.reportId = :id', { id: report.id });

    const data = {
      totalSellCount: 0,
      additionalProfitTotalSum: 0,
      netProfitTotalSum: 0,
      totalSize: 0,
      totalPlasticSum: 0,
      totalInternetShopSum: 0,
      totalSale: 0,
      totalSaleReturn: 0,
      totalCashCollection: 0,
      totalDiscount: 0,
      totalIncome: 0,
      totalExpense: 0,
      managerSum: 0,
      accountantSum: 0,
    };

    const f_kassas = await this.kassaRepo.find({ where: { report: { id: report.id } } });
    const d_kassas = await this.kassaRepo.find({ where: { report: { id: d_report.id } } });

    const income_expense = this.cashflowRepository.createQueryBuilder('cash').select(
      `
      SUM(CASE WHEN type = 'Приход' THEN price ELSE 0 END)::NUMERIC(20, 2) as income,
    SUM(CASE WHEN type = 'Расход' THEN price ELSE 0 END)::NUMERIC(20, 2) as expense
      `,
    ).where('cash.reportId = :id', { id: report.id });

    const [{ income, expense }, manager_result, accountant_result] = await Promise.all([
      income_expense.getRawOne(),
      manager_qb.getRawOne(),
      accountant_qb.getRawOne(),
    ]);

    data.totalIncome = income ?? 0;
    data.totalExpense = expense ?? 0;
    data.accountantSum = (Number(accountant_result?.total_income) || 0) - (Number(accountant_result?.total_expense) || 0);
    data.managerSum = (Number(manager_result?.total_income) || 0) - (Number(manager_result?.total_expense) || 0);

    for (const k of f_kassas) {
      data.totalSellCount += k.totalSellCount;
      data.additionalProfitTotalSum += k.additionalProfitTotalSum;
      data.netProfitTotalSum += k.netProfitTotalSum;
      data.totalSize += k.totalSize;
      data.totalPlasticSum += k.plasticSum;
      data.totalSale += k.sale;
      data.totalSaleReturn += k.totalSaleReturn;
      data.totalCashCollection += k.cash_collection;
      data.totalDiscount += k.discount;
      data.accountantSum += k.plasticSum;
    }

    for (const k of d_kassas) {
      data.totalSellCount += k.totalSellCount;
      data.additionalProfitTotalSum += k.additionalProfitTotalSum;
      data.netProfitTotalSum += k.netProfitTotalSum;
      data.totalSize += k.totalSize;
      data.totalPlasticSum += k.plasticSum;
      data.totalSale += k.sale;
      data.totalSaleReturn += k.totalSaleReturn;
      data.totalCashCollection += k.cash_collection;
      data.totalDiscount += k.discount;
      data.accountantSum += k.plasticSum;
    }

    if (type === 'do') {
      await this.reportRepo.update({ id: report.id }, data);

      return { data, message: 'fixed data' };
    }

    return { data, message: 'calced data', report, d_report };
  }

  /**
   * Filial bo'yicha barcha Report larning yig'indisi (Ежемесячный отчет yuqori qismi).
   */
  async getReportTotalsByFilial(filialId: string) {
    const reports = await this.reportRepo.find({
      where: { filial: { id: filialId } },
    });

    if (!reports.length) return {};

    return reports.reduce(
      (acc, r) => ({
        totalIncome: +(acc.totalIncome + (r.totalIncome || 0)).toFixed(2),
        totalSale: +(acc.totalSale + (r.totalSale || 0)).toFixed(2),
        totalPlasticSum: +(acc.totalPlasticSum + (r.totalPlasticSum || 0)).toFixed(2),
        additionalProfitTotalSum: +(acc.additionalProfitTotalSum + (r.additionalProfitTotalSum || 0)).toFixed(2),
        totalExpense: +(acc.totalExpense + (r.totalExpense || 0)).toFixed(2),
        totalSaleReturn: +(acc.totalSaleReturn + (r.totalSaleReturn || 0)).toFixed(2),
        totalCashCollection: +(acc.totalCashCollection + (r.totalCashCollection || 0)).toFixed(2),
        totalDiscount: +(acc.totalDiscount + (r.totalDiscount || 0)).toFixed(2),
        in_hand: +(acc.in_hand + (r.in_hand || 0)).toFixed(2),
        totalSize: +(acc.totalSize + (r.totalSize || 0)).toFixed(2),
        debt_sum: +(acc.debt_sum + (r.debt_sum || 0)).toFixed(2),
        netProfitTotalSum: +(acc.netProfitTotalSum + (r.netProfitTotalSum || 0)).toFixed(2),
      }),
      {
        totalIncome: 0, totalSale: 0, totalPlasticSum: 0,
        additionalProfitTotalSum: 0, totalExpense: 0, totalSaleReturn: 0,
        totalCashCollection: 0, totalDiscount: 0, in_hand: 0,
        totalSize: 0, debt_sum: 0, netProfitTotalSum: 0,
      },
    );
  }
}
